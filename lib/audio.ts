/** In-memory microphone recording. Never sends or persists microphone data. */
export type RecordingOptions = {
  onLevel?: (level: number) => void;
  onTime?: (seconds: number) => void;
  /** Called after the recorder has begun stopping at its hard duration limit. */
  onLimit?: () => void;
  maxSeconds?: number;
};

export type Recording = {
  /** Idempotent: repeated calls return the same, real 16 kHz mono PCM WAV. */
  stop: () => Promise<Blob>;
  /** Immediately releases the microphone and discards the recording. */
  cancel: () => void;
};

/** Area-average downsampling avoids simply relabelling the original sample rate. */
export function resampleMono(samples: Float32Array, sourceRate: number, targetRate = 16000): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) {
    throw new Error("INVALID_SAMPLE_RATE");
  }
  if (sourceRate === targetRate) return samples.slice();
  const length = Math.floor(samples.length * targetRate / sourceRate);
  const result = new Float32Array(length);
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < length; i++) {
    const start = i * ratio;
    if (ratio < 1) {
      const left = Math.floor(start);
      const right = Math.min(left + 1, samples.length - 1);
      result[i] = samples[left] * (1 - (start - left)) + samples[right] * (start - left);
    } else {
      const end = Math.min((i + 1) * ratio, samples.length);
      let sum = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        sum += samples[j] * (Math.min(j + 1, end) - Math.max(j, start));
      }
      result[i] = sum / (end - start);
    }
  }
  return result;
}

export function encodeWav(samples: Float32Array, sourceSampleRate: number, targetSampleRate = 16000): ArrayBuffer {
  const pcm = resampleMono(samples, sourceSampleRate, targetSampleRate);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM.
  view.setUint16(22, 1, true); // One channel.
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const value = Math.max(-1, Math.min(1, Number.isFinite(pcm[i]) ? pcm[i] : 0));
    view.setInt16(44 + i * 2, Math.round(value < 0 ? value * 32768 : value * 32767), true);
  }
  return buffer;
}

// Worklet batches frames to reduce UI-thread traffic and returns any final partial batch on stop.
const processorSource = `
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.length = 0;
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this.flush();
        this.active = false;
        this.port.postMessage({type: 'stopped'});
      }
    };
  }
  flush() {
    if (this.length) {
      const samples = this.buffer.slice(0, this.length);
      this.port.postMessage({type: 'samples', samples}, [samples.buffer]);
      this.length = 0;
    }
  }
  process(inputs) {
    if (!this.active) return false;
    const channels = inputs[0];
    if (channels && channels.length && channels[0].length) {
      for (let i = 0; i < channels[0].length; i++) {
        let mono = 0;
        for (let c = 0; c < channels.length; c++) mono += channels[c][i];
        this.buffer[this.length++] = mono / channels.length;
        if (this.length === this.buffer.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('absurdly-voice-capture', VoiceCapture);
`;

export async function startRecording(options: RecordingOptions = {}): Promise<Recording> {
  if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("MICROPHONE_UNAVAILABLE");
  }
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor || typeof AudioWorkletNode === "undefined") throw new Error("AUDIO_UNSUPPORTED");
  // Hard upper bound applies even if a caller supplies a larger value.
  const maxSeconds = Math.max(0.25, Math.min(options.maxSeconds ?? 30, 30));
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: AudioWorkletNode | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  let finished = false;
  let parts: Float32Array[] = [];
  let totalSamples = 0;
  let stopPromise: Promise<Blob> | undefined;
  let flushResolve: (() => void) | undefined;
  const release = () => {
    if (tick) clearInterval(tick);
    if (deadline) clearTimeout(deadline);
    stream.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    processor?.disconnect();
    if (processor) processor.port.close();
    if (context && context.state !== "closed") void context.close().catch(() => {});
    options.onLevel?.(0);
  };
  try {
    context = new AudioContextConstructor();
    if (!context.audioWorklet) throw new Error("AUDIO_UNSUPPORTED");
    const moduleUrl = URL.createObjectURL(new Blob([processorSource], { type: "text/javascript" }));
    try {
      await context.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
    await context.resume();
    source = context.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(context, "absurdly-voice-capture", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    });
    const sampleRate = context.sampleRate;
    const maximumSamples = Math.floor(sampleRate * maxSeconds);
    processor.port.onmessage = (event: MessageEvent<{ type: string; samples?: Float32Array }>) => {
      if (event.data.type === "stopped") { flushResolve?.(); return; }
      if (cancelled || finished || !event.data.samples) return;
      const samples = event.data.samples.slice(0, Math.max(0, maximumSamples - totalSamples));
      if (!samples.length) return;
      parts.push(samples);
      totalSamples += samples.length;
      let power = 0;
      for (let i = 0; i < samples.length; i++) power += samples[i] * samples[i];
      options.onLevel?.(Math.min(1, Math.sqrt(power / samples.length) * 5));
    };
    // The worklet writes zeroes to its output; connecting it makes browsers process it without microphone feedback.
    source.connect(processor);
    processor.connect(context.destination);
    const startedAt = performance.now();
    options.onTime?.(0);
    tick = setInterval(() => options.onTime?.(Math.min(maxSeconds, (performance.now() - startedAt) / 1000)), 100);
    const stop = (): Promise<Blob> => {
      if (stopPromise) return stopPromise;
      stopPromise = (async () => {
        if (cancelled) throw new Error("RECORDING_CANCELLED");
        if (tick) clearInterval(tick);
        if (deadline) clearTimeout(deadline);
        try {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 400);
            flushResolve = () => { clearTimeout(timeout); resolve(); };
            processor?.port.postMessage("stop");
          });
          if (cancelled) throw new Error("RECORDING_CANCELLED");
          finished = true;
          if (totalSamples < sampleRate * 0.12) throw new Error("EMPTY_RECORDING");
          const samples = new Float32Array(totalSamples);
          let offset = 0;
          for (const part of parts) { samples.set(part, offset); offset += part.length; }
          return new Blob([encodeWav(samples, sampleRate)], { type: "audio/wav" });
        } finally {
          parts = [];
          release();
        }
      })();
      return stopPromise;
    };
    deadline = setTimeout(() => {
      // Swallow here so an unattended recorder never creates an unhandled rejection;
      // callers receive the same promise (including its error) through stop().
      void stop().catch(() => {});
      options.onTime?.(maxSeconds);
      options.onLimit?.();
    }, maxSeconds * 1000);
    return {
      stop,
      cancel: () => {
        cancelled = true;
        parts = [];
        flushResolve?.();
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}

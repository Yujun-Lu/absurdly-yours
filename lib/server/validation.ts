import type { GenerationRequest, Locale, ResultText } from "../types.ts";
import { ServiceError } from "./errors.ts";

export const MAX_TEXT_LENGTH = 1200;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export function getLocale(value: unknown): Locale { return value === "zh" ? "zh" : "en"; }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ServiceError("INVALID_INPUT");
  return value as Record<string, unknown>;
}
function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw new ServiceError("INVALID_INPUT");
  return value.trim();
}
export function parseGenerationRequest(value: unknown): GenerationRequest {
  const data = record(value);
  if (typeof data.text !== "string" || !data.text.trim()) throw new ServiceError("INVALID_INPUT");
  if (data.text.length > MAX_TEXT_LENGTH) throw new ServiceError("REQUEST_TOO_LARGE", 413);
  if (!["rewrite", "poetry", "bulletin", "diary", "reply"].includes(data.mode as string)
    || ![1, 2, 3].includes(data.flair as number) || !["en", "zh"].includes(data.locale as string)) {
    throw new ServiceError("INVALID_INPUT");
  }
  if (data.bulletinStyle !== undefined && !["bulletin", "award"].includes(data.bulletinStyle as string)) throw new ServiceError("INVALID_INPUT");
  if (data.styleExamples !== undefined && (!Array.isArray(data.styleExamples) || data.styleExamples.length > 3 || data.styleExamples.some(v => typeof v !== "string" || v.length > 1500))) {
    throw new ServiceError("INVALID_INPUT");
  }
  return {
    text: data.text.trim(), mode: data.mode as GenerationRequest["mode"], flair: data.flair as GenerationRequest["flair"], locale: data.locale as Locale,
    bulletinStyle: data.bulletinStyle as GenerationRequest["bulletinStyle"],
    recipient: optionalString(data.recipient, 80), intent: optionalString(data.intent, 80), incomingMessage: optionalString(data.incomingMessage, 800),
    styleExamples: (data.styleExamples as string[] | undefined)?.filter(v => v.trim()).slice(0, 3),
  };
}
export function parseModelResult(content: unknown): ResultText {
  if (typeof content !== "string" || content.length > 6000) throw new ServiceError("INVALID_OUTPUT", 502);
  let parsed: Record<string, unknown>;
  try { parsed = record(JSON.parse(content)); } catch { throw new ServiceError("INVALID_OUTPUT", 502); }
  const limits = { title: 180, body: 1200, footer: 300 };
  for (const key of ["title", "body", "footer"] as const) {
    if (typeof parsed[key] !== "string" || (parsed[key] as string).length > limits[key]) throw new ServiceError("INVALID_OUTPUT", 502);
  }
  if (!(parsed.body as string).trim()) throw new ServiceError("INVALID_OUTPUT", 502);
  return { title: (parsed.title as string).trim(), body: (parsed.body as string).trim(), footer: (parsed.footer as string).trim() };
}

/** Parse chunks rather than assuming a fixed 44-byte header. No format relabelling. */
export function validateWav(bytes: Buffer): { sampleRate: number; duration: number } {
  if (bytes.length > MAX_AUDIO_BYTES) throw new ServiceError("REQUEST_TOO_LARGE", 413);
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new ServiceError("INVALID_AUDIO");
  let offset = 12, sampleRate = 0, byteRate = 0, dataStart = 0, dataLength = 0;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw new ServiceError("INVALID_AUDIO");
    if (chunk === "fmt ") {
      if (length < 16 || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 || bytes.readUInt16LE(start + 14) !== 16 || bytes.readUInt16LE(start + 12) !== 2) throw new ServiceError("INVALID_AUDIO");
      sampleRate = bytes.readUInt32LE(start + 4); byteRate = bytes.readUInt32LE(start + 8);
    } else if (chunk === "data") { dataStart = start; dataLength = length; }
    offset = start + length + (length % 2);
  }
  if (sampleRate < 8000 || sampleRate > 48000 || byteRate !== sampleRate * 2 || dataLength % 2) throw new ServiceError("INVALID_AUDIO");
  const duration = dataLength / byteRate;
  if (!dataStart || duration < 0.2) throw new ServiceError("EMPTY_AUDIO");
  if (duration > 30.5) throw new ServiceError("INVALID_AUDIO");
  let energy = 0;
  for (let i = dataStart; i < dataStart + dataLength; i += 2) energy += (bytes.readInt16LE(i) / 32768) ** 2;
  if (Math.sqrt(energy / (dataLength / 2)) < 0.0003) throw new ServiceError("EMPTY_AUDIO");
  return { sampleRate, duration };
}

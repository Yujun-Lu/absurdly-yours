import { serverConfig } from "@/lib/server/config";
import { checkOrigin, errorResponse, ServiceError } from "@/lib/server/errors";
import { getLocale, MAX_AUDIO_BYTES, validateWav } from "@/lib/server/validation";
import { postUpstream, withUpstream } from "@/lib/server/upstream";
import type { Locale } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let locale: Locale = "en";
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 65536) throw new ServiceError("REQUEST_TOO_LARGE", 413);
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new ServiceError("INVALID_AUDIO");
    let form: FormData;
    try { form = await request.formData(); } catch { throw new ServiceError("INVALID_AUDIO"); }
    locale = getLocale(form.get("locale"));
    const file = form.get("audio");
    if (!(file instanceof Blob) || !["audio/wav", "audio/x-wav", "audio/wave"].includes(file.type.toLowerCase())) throw new ServiceError("INVALID_AUDIO");
    if (file.size > MAX_AUDIO_BYTES) throw new ServiceError("REQUEST_TOO_LARGE", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { sampleRate } = validateWav(bytes);
    const config = serverConfig();
    if (!config.configured) throw new ServiceError("NOT_CONFIGURED", 503);
    const text = await withUpstream(request.signal, config.timeoutMs, async signal => {
      const data = await postUpstream(config.asrUrl, config.key, {
        model: config.asrModel,
        input: { messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: `data:audio/wav;base64,${bytes.toString("base64")}` } }] }] },
        parameters: { format: "wav", sample_rate: String(sampleRate) },
      }, signal);
      const output = data.output;
      const transcription = output?.text || output?.sentence?.text || (Array.isArray(output?.sentences) ? output.sentences.map((s: { text?: string }) => s.text || "").join("") : "");
      if (typeof transcription !== "string" || !transcription.trim()) throw new ServiceError("NO_SPEECH", 422);
      if (transcription.length > 4000) throw new ServiceError("INVALID_OUTPUT", 502);
      return transcription.trim();
    });
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, locale); }
}

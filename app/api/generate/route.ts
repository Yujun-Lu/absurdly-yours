import { serverConfig } from "@/lib/server/config";
import { checkOrigin, errorResponse, ServiceError } from "@/lib/server/errors";
import { FACT_REVIEW_PROMPT, SYSTEM_PROMPT, userPrompt } from "@/lib/server/prompt";
import { getLocale, parseGenerationRequest, parseModelResult } from "@/lib/server/validation";
import { postUpstream, withUpstream } from "@/lib/server/upstream";
import type { Locale } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "absurdly_yours_creation", strict: true,
    schema: {
      type: "object", additionalProperties: false,
      properties: { title: { type: "string" }, body: { type: "string" }, footer: { type: "string" } },
      required: ["title", "body", "footer"],
    },
  },
};

export async function POST(request: Request) {
  let locale: Locale = "en";
  try {
    checkOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new ServiceError("INVALID_INPUT");
    if (Number(request.headers.get("content-length") || 0) > 20000) throw new ServiceError("REQUEST_TOO_LARGE", 413);
    const raw = await request.text();
    if (raw.length > 20000) throw new ServiceError("REQUEST_TOO_LARGE", 413);
    let data;
    try { data = JSON.parse(raw); } catch { throw new ServiceError("INVALID_INPUT"); }
    locale = getLocale(data?.locale);
    const input = parseGenerationRequest(data);
    const config = serverConfig();
    if (!config.configured) throw new ServiceError("NOT_CONFIGURED", 503);
    const result = await withUpstream(request.signal, config.timeoutMs, async signal => {
      let repairsUsed = 0;
      const structured = async (messages: { role: string; content: string }[], temperature: number) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const output = await postUpstream(`${config.baseUrl}/chat/completions`, config.key, {
            model: config.textModel, messages, response_format: responseFormat,
            enable_thinking: false, stream: false, temperature, max_tokens: 700,
          }, signal);
          const content = output.choices?.[0]?.message?.content;
          try { return parseModelResult(content); }
          catch (error) {
            if (repairsUsed >= 1) throw error;
            repairsUsed++;
            if (typeof content === "string" && content.length <= 6000) messages.push({ role: "assistant", content });
            messages.push({ role: "user", content: "Repair the response structure once. Return only the required JSON object with title, body, footer as strings. Body must be nonempty, at most 1200 characters; title at most 180; footer at most 300. Preserve all facts and the originally requested mode and language." });
          }
        }
        throw new ServiceError("INVALID_OUTPUT", 502);
      };
      const draft = await structured([
        { role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt(input) },
      ], 0.85);
      // A separate low-temperature pass addresses observed factual drift in comic bulletins.
      // Both calls and the single shared structural repair stay within one timeout budget.
      return structured([
        { role: "system", content: FACT_REVIEW_PROMPT },
        { role: "user", content: JSON.stringify({ task: JSON.parse(userPrompt(input)), proposedText: draft }) },
      ], 0.1);
    });
    return Response.json({ ...result, source: "live", locale: input.locale, mode: input.mode, flair: input.flair, bulletinStyle: input.bulletinStyle }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, locale); }
}

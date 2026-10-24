import assert from "node:assert/strict";
import test from "node:test";
import { serverConfig } from "../lib/server/config.ts";
import { parseGenerationRequest, parseModelResult, validateWav } from "../lib/server/validation.ts";
import { checkOrigin, errorResponse, ServiceError } from "../lib/server/errors.ts";
import { SYSTEM_PROMPT, userPrompt } from "../lib/server/prompt.ts";
import { withUpstream } from "../lib/server/upstream.ts";

const valid = { text: "Six meetings, no work done.", mode: "rewrite", flair: 1, locale: "en" };
test("validate inputs before paid requests, including preference sample bounds", () => {
  assert.equal(parseGenerationRequest(valid).mode, "rewrite");
  for (const invalid of [{ ...valid, mode: "unknown" }, { ...valid, flair: "1" }, { ...valid, locale: "fr" }, { ...valid, text: " " }, { ...valid, styleExamples: ["a", "b", "c", "d"] }]) assert.throws(() => parseGenerationRequest(invalid), ServiceError);
  assert.throws(() => parseGenerationRequest({ ...valid, text: "a".repeat(1201) }), /REQUEST_TOO_LARGE/);
});
test("output parser rejects incomplete schemas and HTML remains inert text", () => {
  assert.deepEqual(parseModelResult('{"title":"","body":"<b>A joke</b>","footer":""}'), { title: "", body: "<b>A joke</b>", footer: "" });
  for (const text of ['{"body":"x"}', '{"title":"","body":[],"footer":""}', '{"title":"","body":" ","footer":""}', '```json\n{}\n```']) assert.throws(() => parseModelResult(text), /INVALID_OUTPUT/);
});
test("endpoint defaults stay in configured region and respect workspace alias", () => {
  const beijing = serverConfig({ DASHSCOPE_API_KEY: "test" });
  assert.equal(beijing.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  const sg = serverConfig({ DASHSCOPE_API_KEY: "test", DASHSCOPE_REGION: "ap-southeast-1", DASHSCOPE_WORKSPACE_ID: "workspace-123" });
  assert.equal(sg.asrUrl, "https://workspace-123.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
  assert.equal(serverConfig({ DASHSCOPE_API_KEY: "test", AY_SAMPLE_MODE: "true" }).configured, false);
  assert.equal(serverConfig({ DASHSCOPE_API_KEY: "your_api_key" }).configured, false);
  assert.throws(() => serverConfig({ SFM_WORKSPACE_ID: "bad/path" }));
});
function wav(seconds: number, silent = false): Buffer {
  const count = Math.floor(seconds * 16000), buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF"); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(count * 2, 40);
  if (!silent) for (let i = 0; i < count; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 0.1) * 5000), 44 + i * 2);
  return buffer;
}
test("audio validation checks actual encoding, silence, duration and truncation", () => {
  assert.equal(validateWav(wav(2)).duration, 2);
  assert.throws(() => validateWav(Buffer.from("fake webm renamed.wav")), /INVALID_AUDIO/);
  assert.throws(() => validateWav(wav(1, true)), /EMPTY_AUDIO/);
  assert.throws(() => validateWav(wav(31)), /INVALID_AUDIO/);
  assert.throws(() => validateWav(wav(1).subarray(0, 50)), /INVALID_AUDIO/);
});
test("mode prompt distinguishes all five modes without accepting rule changes", () => {
  for (const mode of ["rewrite", "poetry", "bulletin", "diary", "reply"] as const) {
    const prompt = JSON.parse(userPrompt({ ...parseGenerationRequest(valid), mode }));
    assert.equal(prompt.mode, mode); assert.ok(prompt.task.length > 30);
  }
  assert.match(SYSTEM_PROMPT, /untrusted/);
  assert.match(SYSTEM_PROMPT, /six meetings must remain six/);
});
test("sanitized errors and same-origin guard do not expose provider data", async () => {
  const response = errorResponse(new Error("secret credential"), "zh");
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret/);
  assert.throws(() => checkOrigin(new Request("http://localhost:3000/api/generate", { headers: { origin: "http://other.example" } })), /FORBIDDEN/);
  assert.doesNotThrow(() => checkOrigin(new Request("http://localhost:3000/api/generate", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } })));
  assert.throws(() => checkOrigin(new Request("http://localhost:3000/api/generate", { headers: { host: "127.0.0.1:3000", origin: "http://localhost:3000" } })), /FORBIDDEN/);
  assert.throws(() => checkOrigin(new Request("http://localhost:3000/api/generate", { headers: { host: "127.0.0.1:3000", origin: "null" } })), /FORBIDDEN/);
});
test("a cancelled browser request aborts its upstream work", async () => {
  const controller = new AbortController();
  const work = withUpstream(controller.signal, 30000, signal => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
  controller.abort();
  await assert.rejects(work, /CANCELLED/);
});

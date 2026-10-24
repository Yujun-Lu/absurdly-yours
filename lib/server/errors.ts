import type { Locale } from "../types.ts";

export type ErrorCode = "INVALID_INPUT" | "NOT_CONFIGURED" | "AUTH_FAILED" | "RATE_LIMITED" | "TIMEOUT" | "NETWORK_ERROR" | "MODEL_UNAVAILABLE" | "INVALID_OUTPUT" | "INVALID_AUDIO" | "EMPTY_AUDIO" | "NO_SPEECH" | "REQUEST_TOO_LARGE" | "CANCELLED" | "FORBIDDEN";
const messages: Record<ErrorCode, Record<Locale, string>> = {
  INVALID_INPUT: { en: "Please check your text and options, then try again.", zh: "请检查原话和选项后重试。" },
  NOT_CONFIGURED: { en: "Custom creations are not connected yet. Choose a sample to explore, or type and keep your own words.", zh: "自定义创作服务尚未连接。请选择样例体验，或继续输入并保留你的原话。" },
  AUTH_FAILED: { en: "The service could not authenticate. Check the server's API key, region and workspace. Your words are safe here.", zh: "服务鉴权失败，请检查服务端密钥、地域和业务空间。你的原话仍在。" },
  RATE_LIMITED: { en: "The service is busy or its quota is unavailable. Please wait a moment and retry, or view a sample.", zh: "服务暂时限流或额度不可用。请稍后重试，或查看样例。" },
  TIMEOUT: { en: "That took too long. Your words are still here; please try again or view a sample.", zh: "请求超时。原话已保留，请重试或查看样例。" },
  NETWORK_ERROR: { en: "We could not reach the service. Check your connection and retry, or view a sample.", zh: "暂时无法连接服务。请检查网络后重试，或查看样例。" },
  MODEL_UNAVAILABLE: { en: "The configured model is unavailable for this account. Check the server's model access, then retry.", zh: "当前账号暂时无法使用配置的模型，请检查服务端模型权限后重试。" },
  INVALID_OUTPUT: { en: "The service returned an incomplete creation. Your previous result is kept; please try another take.", zh: "服务返回了不完整的成品。上次结果已保留，请再试一次。" },
  INVALID_AUDIO: { en: "Please record again. This demo accepts genuine mono, 16-bit PCM WAV recordings, up to 30 seconds.", zh: "请重新录音。本演示支持最长 30 秒的真实单声道 16-bit PCM WAV 音频。" },
  EMPTY_AUDIO: { en: "We did not capture any sound. Check your microphone and record again.", zh: "没有录到有效声音，请检查麦克风后再试。" },
  NO_SPEECH: { en: "No words were recognized. Please speak a little closer to the microphone, or type instead.", zh: "没有识别到话语，请靠近麦克风再说一次，或直接打字。" },
  REQUEST_TOO_LARGE: { en: "That recording or text is too large. Keep recordings under 30 seconds and text under 1,200 characters.", zh: "录音或文字过大，请将录音控制在 30 秒内、原话控制在 1200 字符内。" },
  CANCELLED: { en: "Request cancelled. Your words are still here.", zh: "请求已取消，原话仍在。" },
  FORBIDDEN: { en: "This request could not be accepted. Open the demo directly and try again.", zh: "无法接受此请求，请直接打开演示页面后重试。" },
};

export class ServiceError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, status = 400) {
    super(code);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export function errorResponse(error: unknown, locale: Locale): Response {
  const known = error instanceof ServiceError ? error : new ServiceError("NETWORK_ERROR", 502);
  return Response.json({ error: messages[known.code][locale], code: known.code }, {
    status: known.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function checkOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let suppliedOrigin: URL;
  try { suppliedOrigin = new URL(origin); } catch { throw new ServiceError("FORBIDDEN", 403); }
  const requestUrl = new URL(request.url);
  // Next.js can normalize Request.url to localhost even when the browser used
  // 127.0.0.1. Host is the actual authority of this direct local HTTP request.
  const authority = request.headers.get("host") || requestUrl.host;
  if (suppliedOrigin.host !== authority || suppliedOrigin.protocol !== requestUrl.protocol || suppliedOrigin.username || suppliedOrigin.password) {
    throw new ServiceError("FORBIDDEN", 403);
  }
}

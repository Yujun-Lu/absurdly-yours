import { ServiceError } from "./errors.ts";

export async function withUpstream<T>(requestSignal: AbortSignal, timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (requestSignal.aborted) cancel();
  requestSignal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try { return await run(controller.signal); }
  catch (error) {
    if (timedOut) throw new ServiceError("TIMEOUT", 504);
    if (requestSignal.aborted) throw new ServiceError("CANCELLED", 499);
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("NETWORK_ERROR", 502);
  } finally {
    clearTimeout(timer);
    requestSignal.removeEventListener("abort", cancel);
  }
}

export async function postUpstream(url: string, key: string, body: unknown, signal: AbortSignal): Promise<Record<string, any>> {
  const response = await fetch(url, {
    method: "POST", signal, cache: "no-store",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let data: Record<string, any> = {};
  try { data = JSON.parse(raw); } catch { if (response.ok) throw new ServiceError("INVALID_OUTPUT", 502); }
  if (!response.ok || data.code || data.error) {
    // Provider errors can contain credentials, input text and endpoint details. Never return or log them.
    const code = String(data.code || data.error?.code || "").toLowerCase();
    if ([401, 403].includes(response.status) || /invalidapikey|invalid_api_key|accessdenied|unauthorized|forbidden/.test(code)) throw new ServiceError("AUTH_FAILED", 502);
    if ([402, 429].includes(response.status) || /throttl|quota|limit|arrear|balance/.test(code)) throw new ServiceError("RATE_LIMITED", 429);
    if ([408, 504].includes(response.status)) throw new ServiceError("TIMEOUT", 504);
    if (response.status === 404 || /modelnotfound|model_not_found|unsupportedmodel|modelaccess/.test(code)) throw new ServiceError("MODEL_UNAVAILABLE", 502);
    throw new ServiceError(response.status >= 500 ? "NETWORK_ERROR" : "MODEL_UNAVAILABLE", 502);
  }
  return data;
}

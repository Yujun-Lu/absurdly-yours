type Env = Record<string, string | undefined>;

export function serverConfig(env: Env = process.env) {
  const region = env.DASHSCOPE_REGION?.trim() || "cn-beijing";
  const workspace = (env.SFM_WORKSPACE_ID || env.DASHSCOPE_WORKSPACE_ID || "").trim();
  // Workspace ID is opaque: never infer it by decoding or slicing an API key.
  if (workspace && !/^[a-zA-Z0-9-]+$/.test(workspace)) throw new Error("Invalid workspace configuration");
  if (!["cn-beijing", "ap-southeast-1"].includes(region)) throw new Error("Unsupported region configuration");
  const host = workspace
    ? `${workspace}.${region}.maas.aliyuncs.com`
    : region === "cn-beijing" ? "dashscope.aliyuncs.com" : "dashscope-intl.aliyuncs.com";
  const key = env.DASHSCOPE_API_KEY?.trim() || "";
  const configured = env.AY_SAMPLE_MODE !== "true" && !!key && !/^(your|replace|placeholder|sk-your)/i.test(key);
  const baseUrl = (env.DASHSCOPE_BASE_URL?.trim() || `https://${host}/compatible-mode/v1`).replace(/\/$/, "");
  const asrUrl = env.ASR_API_URL?.trim() || `https://${host}/api/v1/services/aigc/multimodal-generation/generation`;
  for (const endpoint of [baseUrl, asrUrl]) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid endpoint configuration");
  }
  const timeoutValue = Number(env.API_TIMEOUT_MS || "30000");
  return {
    key, configured, baseUrl, asrUrl,
    textModel: env.TEXT_MODEL?.trim() || "qwen3.8-flash",
    asrModel: env.ASR_MODEL?.trim() || "qwen-audio-3.1-asr-flash",
    timeoutMs: Number.isFinite(timeoutValue) ? Math.min(120000, Math.max(1000, timeoutValue)) : 30000,
  };
}

# Backend verification

Verified on 2026-10-24 using the bundled Node.js v24.19.0. No credential values are included in this report.

## Official interface checks

- [ASR HTTP reference](https://help.aliyun.com/zh/model-studio/fun-asr-flash-recorded-speech-recognition-http-api) documents Base64 WAV input, `parameters.format`, optional `sample_rate`, non-streaming `output.text`, and continued support for the legacy regional DashScope hosts.
- [Qwen3.8-Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash) and [structured output](https://help.aliyun.com/zh/model-studio/qwen-structured-output) confirm JSON Schema support.
- [Thinking control](https://help.aliyun.com/zh/model-studio/deep-thinking) documents `enable_thinking: false`.
- A workspace ID was not provided. The app therefore uses the documented Beijing legacy host, rather than inferring an ID from the key. Supplying `SFM_WORKSPACE_ID` selects the workspace-specific hostname. There is no automatic region or endpoint switching after failures.

## Real account checks

- Text request: HTTP 200 with `qwen3.8-flash`, non-thinking mode, using the supplied account configuration.
- ASR request: HTTP 200 with `qwen-audio-3.1-asr-flash`. A locally synthesized 4.075-second, 16 kHz, mono PCM16 WAV was validated and sent through the real HTTP API and the shared upstream adapter. Exact transcript: “I had six meetings today and got no work done.”
- Eight initial live content requests covered all five modes, both bulletin templates, Chinese and English. All returned valid JSON Schema results.
- The initial bulletin draft invented an unmentioned washing-machine process. A separate low-temperature factual editing pass was added within the same total timeout budget. It removed the invented process while retaining the humorous personification. This improves fidelity but does not guarantee every future model response will be perfect.
- Rechecked acceptance A: “今日赴会六场，工作未受惊扰。”
- Rechecked acceptance C: “谢邀。本周五居家静养，暂不对外营业；下周再约，届时重新开张。” Gratitude, Friday, staying home, rest and proposing next week are preserved.
- Rechecked acceptance D: “今日心情略沉，已开启静音模式。世界请暂且绕行，我先与安静对坐片刻。” Sadness and the request for quiet remain.
- Poetry check: “一蓑烟雨任平生，电脑不行。”
- Diary check preserved oversleeping, homework, evening instant noodles and three minutes.

Sanitized example outputs are recorded in `api-verification.json`. These are test-run observations, not promises of deterministic wording.

## Automated checks

- Seven backend tests passed: input bounds, schema parsing, region/workspace selection, actual WAV validation, mode mapping, error sanitization/origin checks, and upstream cancellation.
- TypeScript check passed after backend integration.
- Initial route integration correctly returned localized `AUTH_FAILED` because the shell inherited an older `DASHSCOPE_API_KEY`, which Next.js prioritizes over `.env.local`. A safe boolean comparison confirmed the mismatch without printing either key. The launcher now explicitly loads `.env.local` over inherited values. After restart, the ASR route and all eight generation checks returned HTTP 200. Responses took approximately 2–5.2 seconds in this batch.
- Invalid audio content labelled as WAV returns HTTP 400 / `INVALID_AUDIO`; blank generation input returns HTTP 400 / `INVALID_INPUT` before any paid request.
- The end-to-end HTTP path uploaded the WAV to `/api/transcribe`, then appended an edit (“I want a short break.”) to the recognized text and generated from that edited original. This verifies the two-stage route contract.
- Browser testing revealed that Next.js normalizes `Request.url` to localhost even when the browser uses `127.0.0.1`. The origin check now compares the actual Host header and protocol. Regression assertions accept matching browser Origin/Host 127.0.0.1 and reject cross-host/null origins. A live Origin-header generation request returned HTTP 200 after this fix.
- A final live three-level comparison returned visibly different rhetoric: level 1 dry understatement (“actual work remains unbothered”), level 2 personified absurdity (“my brain’s hamster negotiate a severance package”), level 3 mock royal proclamation (“six councils convened…brief ceremonial intermission”). Each retained six meetings, no completed work and a brief break.

## Limits of these checks

The ASR fixture is synthesized speech, not a human speaking into the browser microphone. Browser capture, permissions, clipboard, system voice availability, mobile layout and production build must be recorded separately by the primary implementation/QA pass. No public deployment or cloud resources were created.

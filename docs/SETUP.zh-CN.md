# Absurdly Yours · 骚有介事

**生活照常，措辞离谱。 / Ordinary life. Outrageously well put.**

以语音为入口的幽默表达工具：说出日常，把它写成克制的妙语、荒诞的小传，或一本正经的胡说公报。这里的“骚”是从容、机智、反差和自我表达。

Absurdly Yours turns everyday speech into witty, wonderfully overdramatic writing. Choose your level of flair, keep the lines that feel like you, and read them with a straight face.

## 在 Windows 上运行

```powershell
.\run.ps1
```

打开 **http://127.0.0.1:3000**。`run.ps1` 会选择可用的 Node.js 22.13+；如本机已安装 Codex 附带的兼容 Node，也可使用该运行时。请先安装现代 Node.js 和 npm，按 `Ctrl+C` 停止。

首次使用先安装依赖，之后可以构建或检查：

```powershell
.\run.ps1 install
.\run.ps1 typecheck
.\run.ps1 test
.\run.ps1 build
.\run.ps1 start
```

其他电脑先安装 **Node.js 22.13+ 和 npm**，然后：

```sh
npm ci
npm run dev
```

可用命令：`npm run build`、`npm start`、`npm run typecheck`、`npm test`。Next.js + React + TypeScript，无数据库或账号服务。

## 模型配置

将 `.env.example` 复制为 `.env.local`，填入服务端配置。仓库不会包含真实密钥，请在本机单独配置。

```dotenv
DASHSCOPE_API_KEY=your-key
DASHSCOPE_REGION=cn-beijing
ASR_MODEL=qwen-audio-3.1-asr-flash
TEXT_MODEL=qwen3.8-flash
API_TIMEOUT_MS=30000
```

`SFM_WORKSPACE_ID` 可选，兼容别名 `DASHSCOPE_WORKSPACE_ID`。有 Workspace ID 时使用 `https://{WorkspaceId}.{region}.maas.aliyuncs.com`；未提供时使用官方仍支持的同地域 DashScope 地址。北京为 `dashscope.aliyuncs.com`，新加坡为 `dashscope-intl.aliyuncs.com`。项目测试使用北京默认地址。不会通过解析 API Key 猜 Workspace，也不会跨地域重试。

可设置 `DASHSCOPE_BASE_URL` 和 `ASR_API_URL` 覆盖为同地域 HTTPS 接口。密钥、业务空间和 endpoint 的地域必须对应。修改配置后重启服务器。

**启动器明确让本项目 `.env.local` 覆盖进程中继承的同名配置**，避免桌面环境中其他项目的 Key 干扰。直接运行 `next` 则沿用 Next.js 原本的环境变量优先级。

密钥仅在服务端使用，`.env.local` 已被 `.gitignore` 排除；不要把它复制到 `NEXT_PUBLIC_*`。`GET /api/status` 只返回两个能力布尔值，配置存在不代表实时鉴权一定成功，实际请求失败会显示错误。

## 样例模式

无 Key 时，界面持续显示 **Sample Demo Mode / 样例演示模式**。点击 **Try an example / 试试样例**，显式载入匹配的输入与预置成品。五种玩法都有中英文样例；换挡有三档，公报有两种模板。样例始终标注来源，联网模式也能主动查看样例。

修改样例原文或回复上下文后，自定义生成需要真实服务。失败不会静默换成预置句子。录音功能可以体验，但没有 ASR 时不会假装完成转写。

即使已经配置 Key，也可单独运行强制样例版：

```powershell
.\run.ps1 build
.\run.ps1 sample
```

或 `npm run build` 后 `npm run demo:sample`，在 **http://127.0.0.1:3001** 打开。也可在 `.env.local` 设置 `AY_SAMPLE_MODE=true` 后运行常规开发服务器。

## 演示顺序（约 90 秒）

1. 默认英文，点击麦克风，说 “I had six meetings today and got no work done.”，再次点击结束。转写完成后可编辑原话，再点击 **Give it flair**。
2. 点击 **More flair**，对比克制与夸张的表达。**Tone it down** 回退一档，**Another take** 重新创作。它们始终使用输入区原话。
3. 切换中文，选 **正经胡说公报 → 试试样例**；原话是洗三桶衣服、丢一只袜子。点击 **优雅地发疯** 展示真实创作，或切换 **日常加冕** 再选择对应样例。
4. 直接编辑成品，点击 **复制** 或 **这句是我**，再点击 **请严肃宣读**。朗读使用系统语音，点击停止可中断。
5. 打开 **我的妙句**，展示收藏的表达与清空入口。收藏最多五条，后续请求最多使用三条同语言表达作风格参考。

网络不稳时，可明确选择样例继续演示。每种玩法的样例按钮都可立即得到可复制、可收藏的结果。

## 实现与边界

- `app/page.tsx`：双语单页、五种玩法、可编辑结果、复制、收藏和系统朗读。
- `lib/audio.ts`：AudioWorklet 捕获真实音频，实际重采样为 16 kHz 单声道 16-bit PCM WAV。最长 30 秒，结束、取消、异常与卸载时释放麦克风。
- `app/api/transcribe`：最多 5 MB、检查真实 WAV 编码/时长/静音，以 base64 音频调用 ASR HTTP 接口。
- `app/api/generate`：字段校验、JSON Schema 生成、一次事实复核、至多一次结构修复；各调用共享默认 30 秒超时。`enable_thinking=false`。
- 输入最多 1200 字符；不执行模型返回的 HTML。请求取消、改动输入、切换语言或玩法后，旧请求不会覆盖新状态。
- 原始录音仅在内存中，转写后释放。文本及音频在调用时发送给阿里云；主动收藏的成品保存在本机浏览器，最多五条。禁用 localStorage 时退回当前会话内存。无服务端持久化或日志记录原话。
- 麦克风需要 **localhost 或 HTTPS** 以及浏览器权限；AudioWorklet 需要现代浏览器。手机通过普通局域网 HTTP 打开可能无法录音，文字入口仍可用。
- 系统语音依赖设备安装的中英文音色。没有匹配音色时禁用播放；不自动播放，不调用云 TTS。
- 首次默认英文。切换语言保留原话和旧成品的原语言标记；新生成时才使用当前语言。
- 字体来自 Google Fonts，有完整系统字体回退；没有图片、音频素材或外部图标运行依赖。
- 完整应用默认仅绑定 `127.0.0.1`，适合本地演示。公开项目主页仅提供预置样例；若要公开提供实时 AI 服务，应另外增加访问控制和请求限额。
- 事实复核降低了日期、数量、请求丢失和凭空增加事件的概率；生成内容仍需用户在分享前查看。

## 验证

`qa/verification.md` 与 `qa/api-verification.json` 保存模型接口、真实转写与生成检查结果。浏览器验收记录及截图见 `qa/browser-verification.md` 与 `qa/screenshots/`。

已完成 production build、TypeScript 检查及 12 项实质测试，覆盖音频编码/重采样、样例匹配、输入与输出结构、WAV 校验、地域选择、错误脱敏、同源检查和取消传递。真实 ASR 使用合成语音 WAV 测试；浏览器录音管线也使用受控合成语音验证。**未声称已验证真人麦克风和现场声学环境**，上台前请用实际麦克风试说一句。

官方接入资料：

- [ASR HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-flash-recorded-speech-recognition-http-api)
- [Qwen Audio 3.1 ASR Flash](https://help.aliyun.com/zh/model-studio/qwen-audio-3-1-asr-flash)
- [Qwen3.8 Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)
- [结构化输出](https://help.aliyun.com/zh/model-studio/qwen-structured-output)
- [浏览器语音合成](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

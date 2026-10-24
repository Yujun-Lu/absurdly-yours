"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording } from "@/lib/audio";
import { findSampleResult, getSample } from "@/lib/samples";
import { resultPlainText } from "@/lib/types";
import type { BulletinStyle, Capabilities, Flair, GenerationRequest, GenerationResult, Locale, Mode, SavedResult } from "@/lib/types";

type IconName = "mic" | "arrow" | "copy" | "heart" | "sound" | "stop" | "close" | "check" | "spark" | "down";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
    sound: <><path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m5 12 4 4L20 5"/>,
    spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>,
    down: <path d="m6 9 6 6 6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Burst({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><path d="m50 1 7 31 24-22-15 29 33 3-30 13 25 22-32-7 2 29-15-26-18 25 4-32-31 8 24-22L0 41l33-4L16 10l26 21Z" fill="currentColor"/></svg>;
}

const modes: Mode[] = ["rewrite", "poetry", "bulletin", "diary", "reply"];
const modeNames = {
  en: { rewrite: "Dial up the flair", poetry: "Literary twist", bulletin: "Officially absurd", diary: "My day, dramatically", reply: "The witty reply" },
  zh: { rewrite: "骚气换挡", poetry: "古句急转弯", bulletin: "正经胡说公报", diary: "今日小传", reply: "社交回马枪" },
};
const modeDescriptions = {
  en: { rewrite: "Same meaning. Considerably more personality.", poetry: "A familiar line. A beautifully unexpected landing.", bulletin: "Small matters. Entirely excessive ceremony.", diary: "The everyday, worthy of a small biography.", reply: "Say what you mean. Leave a little sparkle." },
  zh: { rewrite: "意思还是那个意思，出场自带一点排场。", poetry: "前半句风雅，后半句忽然回到人间。", bulletin: "给鸡毛蒜皮，以隆重礼遇。", diary: "再普通的一天，也值得留下一笔。", reply: "把话说清楚，也把趣味留住。" },
};
const flairNames = { en: ["Understated", "Absurd", "Magnificent"], zh: ["雅骚", "抽象", "登疯骚极"] };
const flairHints = { en: ["A raised eyebrow", "A delightful detour", "An entrance, naturally"], zh: ["淡淡一句，余味很长", "逻辑拐弯，恰到好处", "隆重登场，从容失控"] };
const STORAGE = "absurdly-yours-favorites-v1";
type Phase = "idle" | "ready" | "recording" | "transcribing" | "generating" | "success" | "error";

function EditableText({ value, onChange, className, label, maxLength }: { value: string; onChange: (value: string) => void; className: string; label: string; maxLength: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = "0px"; ref.current.style.height = `${ref.current.scrollHeight}px`; } }, [value]);
  return <textarea ref={ref} className={className} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} rows={1} spellCheck={false}/>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [mode, setMode] = useState<Mode>("rewrite");
  const [flair, setFlair] = useState<Flair>(1);
  const [bulletinStyle, setBulletinStyle] = useState<BulletinStyle>("bulletin");
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("friend");
  const [intent, setIntent] = useState("free");
  const [incomingMessage, setIncomingMessage] = useState("");
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [resultInput, setResultInput] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<SavedResult[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [micStarting, setMicStarting] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const recordingSequence = useRef(0);
  const mounted = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRecordingRef = useRef<() => void>(() => {});
  const chinese = locale === "zh";
  const t = (en: string, zh: string) => chinese ? zh : en;
  const busy = phase === "generating" || phase === "transcribing";
  const isRecording = phase === "recording";
  const sample = getSample(mode, locale, bulletinStyle);
  const currentResultText = result ? resultPlainText(result) : "";
  const canRefine = !!result && resultInput === text && result.mode === mode && result.locale === locale && (mode !== "bulletin" || result.bulletinStyle === bulletinStyle);
  const saved = !!result && favorites.some((f) => f.locale === result.locale && resultPlainText(f) === currentResultText);
  const selectedVoice = result ? voices.find((v) => v.lang.toLowerCase().startsWith(result.locale === "zh" ? "zh" : "en")) : undefined;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const stopSpeech = useCallback(() => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  const invalidate = useCallback(() => {
    sequence.current += 1;
    request.current?.abort(); request.current = null;
    recordingSequence.current += 1;
    recorder.current?.cancel(); recorder.current = null;
    setMicStarting(false); setLevel(0); setError(""); setPhase("ready"); stopSpeech();
  }, [stopSpeech]);

  useEffect(() => {
    mounted.current = true;
    const statusController = new AbortController();
    fetch("/api/status", { signal: statusController.signal }).then((r) => { if (!r.ok) throw Error(); return r.json(); }).then((data: Capabilities) => setCapabilities(data)).catch((e) => { if (e.name !== "AbortError") setCapabilities({generation: false, transcription: false}); });
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      if (Array.isArray(raw)) setFavorites(raw.filter((v): v is SavedResult => !!v && typeof v === "object" && typeof v.id === "string" && typeof v.body === "string" && typeof v.title === "string" && typeof v.footer === "string" && ["en", "zh"].includes(v.locale) && modes.includes(v.mode) && [1,2,3].includes(v.flair) && v.body.length <= 2000 && v.title.length <= 300 && v.footer.length <= 500).slice(0, 5));
    } catch { setStorageAvailable(false); }
    if ("speechSynthesis" in window) {
      const refresh = () => setVoices(window.speechSynthesis.getVoices());
      refresh(); window.speechSynthesis.addEventListener("voiceschanged", refresh);
      return () => { mounted.current = false; statusController.abort(); request.current?.abort(); recordingSequence.current += 1; recorder.current?.cancel(); window.speechSynthesis.removeEventListener("voiceschanged", refresh); window.speechSynthesis.cancel(); if (toastTimer.current) clearTimeout(toastTimer.current); };
    }
    return () => { mounted.current = false; statusController.abort(); request.current?.abort(); recordingSequence.current += 1; recorder.current?.cancel(); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { stopSpeech(); }, [currentResultText, result?.locale, locale, stopSpeech]);

  function persist(next: SavedResult[]) {
    setFavorites(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { setStorageAvailable(false); }
  }
  function chooseSample() {
    invalidate(); setText(sample.input); setSelectedSample(sample.id);
    if (mode === "reply") { setRecipient("friend"); setIntent("free"); setIncomingMessage(""); }
    setResult({...sample.results[flair], source: "sample", locale, mode, flair, bulletinStyle}); setResultInput(sample.input); setPhase("success");
  }
  function changeLocale(next: Locale) { if (next === locale) return; invalidate(); setLocale(next); setSelectedSample(null); }
  function changeMode(next: Mode) { if (next === mode) return; invalidate(); setMode(next); setSelectedSample(null); }

  async function generate(nextFlair: Flair = flair) {
    if (!text.trim() || busy || isRecording || micStarting) return;
    invalidate();
    const id = sequence.current;
    setFlair(nextFlair); setPhase("generating");
    const payload: GenerationRequest = {text: text.trim(), mode, flair: nextFlair, locale, bulletinStyle, recipient, intent, incomingMessage, styleExamples: favorites.filter((f) => f.locale === locale).slice(0, 3).map((item) => resultPlainText(item).slice(0, 1500))};
    if (!capabilities?.generation) {
      const preset = selectedSample ? findSampleResult(payload) : null;
      if (preset) { setResult({...preset, source: "sample", locale, mode, flair: nextFlair, bulletinStyle}); setResultInput(text); setPhase("success"); }
      else { setError(t("Custom writing needs a connected service. Choose ‘Try an example’ to explore the sample demo.", "自定义创作需要连接生成服务。点击「试试样例」，体验已标记的演示内容。")); setPhase("error"); }
      return;
    }
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch("/api/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Something interrupted the writing. Please try again.", "创作暂时中断，请重试。"));
      if (id !== sequence.current || !mounted.current) return;
      setResult(data); setResultInput(text); setPhase("success");
    } catch (e) {
      if (id !== sequence.current || !mounted.current) return;
      setError(controller.signal.aborted ? t("The request took too long. Your words are still here; try again.", "请求超时了。原话还在，可以再次尝试。") : e instanceof Error ? e.message : t("Couldn't connect. Please try again.", "连接失败，请重试。")); setPhase("error");
    } finally { clearTimeout(timeout); if (request.current === controller) request.current = null; }
  }

  async function finishRecording() {
    if (!recorder.current) return;
    const active = recorder.current; recorder.current = null;
    const id = sequence.current;
    setPhase("transcribing"); setLevel(0);
    try {
      const audio = await active.stop();
      if (id !== sequence.current || !mounted.current) return;
      if (!capabilities?.transcription) throw new Error(t("Recording works; automatic transcription isn't connected in sample mode. Type your words or try an example.", "录音已完成；样例模式尚未连接自动转写。请打字或试试样例。"));
      const controller = new AbortController(); request.current = controller;
      const timeout = setTimeout(() => controller.abort(), 35000);
      try {
        const form = new FormData(); form.append("audio", audio, "voice.wav"); form.append("locale", locale);
        const response = await fetch("/api/transcribe", {method: "POST", body: form, signal: controller.signal});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("Couldn't transcribe this recording.", "这段录音暂时无法转写。"));
        if (id !== sequence.current || !mounted.current) return;
        setText(data.text); setSelectedSample(null); setPhase("ready");
        notify(t("Your words, transcribed. Edit them before adding flair.", "原话已转写，可以先编辑，再优雅地发疯。"));
      } finally { clearTimeout(timeout); if (request.current === controller) request.current = null; }
    } catch (e) {
      if (id !== sequence.current || !mounted.current) return;
      const message = e instanceof Error ? e.message : "";
      setError(message === "EMPTY_RECORDING" ? t("That recording was silent or too short. Give it another try.", "录音太短或没有声音，再试一次吧。") : message === "AbortError" || (e instanceof DOMException && e.name === "AbortError") ? t("Transcription timed out. Please record again.", "转写超时，请重新录音。") : message || t("Recording failed. You can still type your words.", "录音失败，你仍然可以打字输入。")); setPhase("error");
    }
  }
  finishRecordingRef.current = () => { void finishRecording(); };

  async function beginRecording() {
    if (busy || micStarting) return;
    invalidate(); setSeconds(0); setMicStarting(true);
    const id = recordingSequence.current;
    try {
      const active = await startRecording({onLevel: setLevel, onTime: setSeconds, onLimit: () => finishRecordingRef.current(), maxSeconds: 30});
      if (id !== recordingSequence.current || !mounted.current) { active.cancel(); return; }
      recorder.current = active; setPhase("recording"); setMicStarting(false);
    } catch (e) {
      if (id !== recordingSequence.current || !mounted.current) return;
      setMicStarting(false);
      const name = e instanceof Error ? e.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? t("Microphone access was declined. Allow it in your browser, or type below.", "麦克风权限未开启。可以在浏览器中允许访问，或直接打字。") : name === "NotFoundError" ? t("No microphone found. The keyboard is equally welcome.", "未找到麦克风。键盘同样欢迎你。") : t("Recording isn't available here. Use localhost or HTTPS, or simply type below.", "当前无法录音，请使用 localhost 或 HTTPS，也可以直接打字。")); setPhase("error");
    }
  }

  async function copyResult() {
    if (!currentResultText) return;
    try { await navigator.clipboard.writeText(currentResultText); notify(t("Elegance copied.", "优雅已进入剪贴板。")); }
    catch { notify(t("Clipboard unavailable. Select the result text to copy it.", "剪贴板暂不可用，请选中成品文字后复制。")); }
  }
  function toggleFavorite() {
    if (!result || !currentResultText) return;
    if (saved) { persist(favorites.filter((f) => !(f.locale === result.locale && resultPlainText(f) === currentResultText))); return; }
    persist([{...result, id: crypto.randomUUID()}, ...favorites.filter((f) => f.locale !== result.locale || resultPlainText(f) !== currentResultText)].slice(0,5));
    notify(t("A little more you. Expression remembered.", "这句很你。喜欢的表达已记住。"));
  }
  function speak() {
    if (speaking) { stopSpeech(); return; }
    if (!result || !selectedVoice || !currentResultText) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(currentResultText);
    utterance.voice = selectedVoice; utterance.lang = selectedVoice.lang; utterance.rate = 0.88; utterance.pitch = 0.95;
    utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => { setSpeaking(false); if (event.error !== "canceled" && event.error !== "interrupted") notify(t("System voice couldn't play. You can still copy this line.", "系统语音暂时无法播放，仍可复制这句话。")); };
    window.speechSynthesis.speak(utterance); setSpeaking(true);
  }
  function editResult(field: "title" | "body" | "footer", value: string) { stopSpeech(); setResult((previous) => previous ? {...previous, [field]: value} : null); }
  const status = phase === "recording" ? t("Listening. Take your time.", "正在听，慢慢说。") : phase === "transcribing" ? t("Putting your voice into words…", "正在把声音变成文字…") : phase === "generating" ? t("Finding the right kind of ridiculous…", "正在拿捏这份离谱…") : phase === "success" ? t("Quite you, isn't it?", "这句，有点像你。") : phase === "error" ? t("A small interruption. Entirely recoverable.", "小插曲，风度还在。") : text ? t("Your words. Ready for a little flair.", "原话就位，随时可以开骚。") : t("Speak freely. Small things count.", "随口说吧，小事也值得。") ;

  return <div className={`site ${chinese ? "locale-zh" : ""}`}>
    <header className="header shell">
      <a className="brand" href="/" aria-label="Absurdly Yours home"><Burst className="brand-mark"/><span>Absurdly Yours<span className="brand-chinese">骚有介事</span></span><span className="brand-period">™</span></a>
      <nav className="header-actions" aria-label={t("Page controls", "页面设置")}>
        <button className="saved-link" aria-label={t(`My lines (${favorites.length})`, `我的妙句（${favorites.length}）`)} onClick={() => setShowFavorites((v) => !v)} aria-expanded={showFavorites}><Icon name="heart" size={15}/><span>{t("My lines", "我的妙句")}</span><span className="saved-count">{favorites.length}</span></button>
        <div className="language-switch" aria-label={t("Language", "语言")}><button onClick={() => changeLocale("en")} aria-pressed={!chinese}>EN</button><span>/</span><button onClick={() => changeLocale("zh")} aria-pressed={chinese}>中文</button></div>
      </nav>
    </header>

    <main className="shell">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy"><div className="eyebrow"><span className="tiny-line"/>{t("A LITTLE WIT. A LOT OF YOU.", "一点幽默，很多个你。")}</div>
          <h1 id="hero-heading">{t("Ordinary life.", "生活照常，")}<br/><em>{t("Extraordinary lines.", "措辞离谱。")}</em><Burst className="hero-spark"/></h1>
          <p>{t("Say the everyday. We’ll give it an entrance.", "把日常说出来，让它体面地失控。")}<br/>{t("A voice-first playground for your wonderfully unreasonable side.", "给鸡毛蒜皮一点排场，也给真实的自己一点出场时间。")}</p>
        </div>
        <div className="hero-note"><div className="note-top">{t("A NOTE TO SELF", "致自己的一张便笺")}<span>↗</span></div><p>{t("The world can wait.", "世界可以等一等。")}<br/>{t("Your wit has the floor.", "先让你的趣味发言。")}</p><span className="note-signature">absurdly yours,</span><span className="note-foot">{t("WITH ENTIRELY EXCESSIVE FLAIR", "以全然过剩的风度")}</span></div>
      </section>

      <section className="workbench" aria-label={t("Your writing studio", "你的创作室")}>
        <div className="mode-bar"><span className="mode-caption">{t("MAKE IT", "今日玩法")}</span><div className="mode-tabs" role="tablist" aria-label={t("Writing mode", "文字玩法")}>{modes.map((item,i) => <button role="tab" aria-selected={mode === item} aria-controls="writing-panel" id={`tab-${item}`} className={mode === item ? "active" : ""} key={item} onClick={() => changeMode(item)} onKeyDown={(e) => { if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? modes[0] : e.key === "End" ? modes[4] : modes[(i + (e.key === "ArrowRight" ? 1 : 4)) % 5]; changeMode(next); document.getElementById(`tab-${next}`)?.focus(); }}><span className="tab-number">0{i+1}</span>{modeNames[locale][item]}</button>)}</div></div>
        <div className="studio-grid" id="writing-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
          <div className="input-panel">
            <div className="panel-heading"><span><span className="step-number">01</span>{t("THE ORDINARY", "你的日常")}</span><span className="panel-aside">{t("Your voice. Your words.", "原汁原味，随口就好。")}</span></div>
            <div className={`voice-box ${isRecording ? "recording" : ""}`}>
              <button className="record-button" onClick={() => isRecording ? void finishRecording() : void beginRecording()} disabled={busy || micStarting || capabilities === null} aria-label={isRecording ? t("Stop recording and transcribe", "结束录音并转写") : t("Start recording", "开始录音")}><Icon name={isRecording ? "stop" : "mic"} size={23}/></button>
              <div className="voice-copy"><strong>{micStarting ? t("Opening the microphone…", "正在打开麦克风…") : isRecording ? t("You have the floor.", "请开始你的表演。") : t("Go on. Say it.", "来，随口说一句。")}</strong><span>{isRecording ? `${Math.floor(seconds).toString().padStart(2,"0")} / 30 ${t("sec", "秒")}` : capabilities && !capabilities.transcription ? t("30 sec · transcription not connected", "最长 30 秒 · 自动转写尚未连接") : t("Tap to record · up to 30 seconds", "点击录音 · 最长 30 秒")}</span></div>
              <div className="waveform" aria-hidden="true">{Array.from({length:15},(_,i) => <i key={i} style={{height: `${isRecording ? 5 + Math.max(0.07, level) * 42 * (0.4 + Math.sin(i*1.7+seconds)*0.6) : 4 + Math.abs(Math.sin(i*1.3))*17}px`}}/>)}</div>
              {(isRecording || micStarting) && <button className="cancel-record" onClick={invalidate} aria-label={t("Cancel recording", "取消录音")}><Icon name="close" size={14}/></button>}
            </div>
            <div className="text-label"><label htmlFor="original-input">{t("OR, THE KEYBOARD IS YOURS", "或者，交给键盘")}</label><span>{text.length}<span className="muted"> / 1200</span></span></div>
            <textarea id="original-input" className="original-input" value={text} maxLength={1200} placeholder={t("Six meetings today. Somehow, the actual work remained completely undisturbed…", "今天开了六个会，什么都没干……")} onChange={(e) => {invalidate(); setText(e.target.value); setSelectedSample(null);}} disabled={isRecording || micStarting} spellCheck={false}/>
            <button className="sample-button" onClick={chooseSample} disabled={isRecording || micStarting}><Icon name="spark" size={14}/>{t("Try an example", "试试样例")}<span>↗</span></button>
            <div className="flair-heading"><label>{t("SET THE FLAIR", "拿捏骚气")}</label><span>{t("A matter of degree.", "分寸，自在你。")}</span></div>
            <div className="flair-options" role="group" aria-label={t("Flair level", "骚气档位")}>{([1,2,3] as Flair[]).map((value) => <button className={flair === value ? "selected" : ""} key={value} aria-pressed={flair === value} onClick={() => {invalidate(); setFlair(value);}}><span className="flair-top"><span className={`flair-symbol flair-symbol-${value}`}>{value === 1 ? "·" : value === 2 ? "✳" : "✺"}</span><span className="flair-index">0{value}</span></span><strong>{flairNames[locale][value-1]}</strong><small>{flairHints[locale][value-1]}</small></button>)}</div>
            {mode === "bulletin" && <div className="extra-options"><label htmlFor="bulletin-style">{t("A suitable occasion", "选择礼遇规格")}</label><select id="bulletin-style" value={bulletinStyle} onChange={(e) => {invalidate(); setBulletinStyle(e.target.value as BulletinStyle); setSelectedSample(null);}}><option value="bulletin">{t("Formal bulletin", "正式公报")}</option><option value="award">{t("Tiny triumph · an award", "日常加冕 · 颁奖")}</option></select></div>}
            {mode === "reply" && <div className="reply-options"><div className="reply-selects"><label>{t("To", "对象")}<select value={recipient} onChange={(e) => {invalidate(); setRecipient(e.target.value); setSelectedSample(null); setResultInput(null);}}>{["friend","roommate","coworker","other"].map((v,i) => <option value={v} key={v}>{(chinese ? ["朋友","室友","同事","其他"] : ["A friend","A roommate","A coworker","Someone else"])[i]}</option>)}</select></label><label>{t("To say", "意图")}<select value={intent} onChange={(e) => {invalidate(); setIntent(e.target.value); setSelectedSample(null); setResultInput(null);}}>{["free","invite","decline","remind","thank","wish"].map((v,i) => <option value={v} key={v}>{(chinese ? ["自由表达","邀请","婉拒","提醒","感谢","祝福"] : ["Something witty","An invitation","A gentle no","A reminder","Thank you","Best wishes"])[i]}</option>)}</select></label></div><label htmlFor="incoming-message" className="context-label">{t("What did they say? (optional)", "对方说了什么？（可选）")}</label><input id="incoming-message" value={incomingMessage} maxLength={800} onChange={(e) => {invalidate(); setIncomingMessage(e.target.value); setSelectedSample(null); setResultInput(null);}} placeholder={t("A little context, if you like.", "补充一点上下文。")}/></div>}
            <button className="generate-button" disabled={!text.trim() || busy || isRecording || micStarting || capabilities === null} onClick={() => void generate()}><span>{phase === "generating" ? <span className="spinner"/> : <Icon name="spark"/>}{phase === "generating" ? t("Composing with panache…", "正在优雅地发疯…") : t("Give it flair", "优雅地发疯")}</span><Icon name="arrow" size={21}/></button>
            <div className="status-line" aria-live="polite"><span className={busy || isRecording ? "status-dot working" : "status-dot"}/>{status}{busy && <button onClick={invalidate}>{t("Cancel", "取消")}</button>}</div>
            {error && <div className="error-box" role="alert"><p>{error}</p><div><button onClick={() => void generate()} disabled={busy || !text.trim()}>{t("Try again", "再试一次")} ↗</button><button onClick={chooseSample}>{t("View an example", "查看样例")}</button></div></div>}
          </div>

          <div className="output-panel">
            <div className="panel-heading"><span><span className="step-number">02</span>{t("THE EXTRAORDINARY", "有趣的你")}</span><span className="panel-aside">{t("Still you. Better dressed.", "还是你，只是换了身行头。")}</span></div>
            <div className={`result-card ${result?.mode === "bulletin" ? "bulletin-card" : ""} ${phase === "generating" ? "composing" : ""}`}>
              <div className="card-top"><span className="card-kicker">{result ? modeNames[result.locale][result.mode] : t("A LITTLE ROOM FOR PERSONALITY", "给你的趣味，留个位置")}</span><span className="edition">№ {result ? `0${result.flair}` : "01"}</span></div>
              {result ? <div className="result-content"><div className="result-meta"><span>{result.locale === "zh" ? "中文" : "ENGLISH"}</span><span>{result.source === "sample" ? t("PRESET SAMPLE", "预置样例") : t("FRESHLY COMPOSED", "即兴创作")}</span>{result.mode === "poetry" && <span>{t("CREATIVE ADAPTATION", "创作改写")}</span>}</div>{result.title && <EditableText value={result.title} onChange={(v) => editResult("title", v)} label={t("Edit result title", "编辑成品标题")} className="result-title" maxLength={300}/>}<EditableText value={result.body} onChange={(v) => editResult("body", v)} label={t("Edit result", "编辑成品")} className="result-body" maxLength={2000}/>{result.footer && <EditableText value={result.footer} onChange={(v) => editResult("footer", v)} label={t("Edit result closing", "编辑成品结语")} className="result-footer" maxLength={500}/>}<span className="edit-hint">{t("Yours to edit. Yours to keep.", "可以编辑，也值得留下。")}</span></div> : <div className="empty-result"><span className="quote-mark">“</span><h2>{t("Your day deserves", "再平凡的日常，")}<br/><em>{t("a better line.", "也配得上一句妙语。")}</em></h2><p>{t("A small frustration. A tiny triumph.", "一点疲惫，一件小事，")}<br/>{t("Start with whatever’s on your mind.", "就从你心里那句话开始。")}</p><Burst className="empty-spark"/></div>}
              <div className="card-bottom"><span className="card-signature">Absurdly yours,</span><span className="card-seal">AY<span>✳</span></span></div>
            </div>
            <div className="result-actions"><button onClick={() => void copyResult()} disabled={!currentResultText}><Icon name="copy"/>{t("Copy", "复制")}</button><button className={saved ? "is-saved" : ""} onClick={toggleFavorite} disabled={!currentResultText} aria-pressed={saved}><Icon name={saved ? "check" : "heart"}/>{t("That’s me", "这句是我")}</button><button onClick={speak} disabled={!currentResultText || !selectedVoice} title={!selectedVoice ? t("No matching system voice available", "当前没有匹配语言的系统语音") : t("System voice", "系统语音")}><Icon name={speaking ? "stop" : "sound"}/>{speaking ? t("Stop", "停止") : t("Read it seriously", "请严肃宣读")}</button></div>
            <div className="voice-source">{t("SYSTEM VOICE", "系统语音")}{!selectedVoice && result ? t(" · No voice available for this language", " · 暂无该语言的可用声音") : ""}</div>
            {result && <div className="refine-actions"><button onClick={() => void generate(Math.max(1,flair-1) as Flair)} disabled={!canRefine || flair === 1 || busy || isRecording || micStarting}>{t("Tone it down", "收着点")} <span>−</span></button><button onClick={() => void generate(flair)} disabled={!canRefine || !capabilities?.generation || busy || isRecording || micStarting}>{t("Another take", "换个说法")} <span>↻</span></button><button onClick={() => void generate(Math.min(3,flair+1) as Flair)} disabled={!canRefine || flair === 3 || busy || isRecording || micStarting}>{t("More flair", "再疯一点")} <span>+</span></button></div>}
          </div>
        </div>
        <div className="workbench-footer"><span className={`connection ${capabilities?.generation ? "live" : ""}`}><i/>{capabilities === null ? t("Connecting…", "连接中…") : capabilities.generation ? t("LIVE CREATIVE STUDIO", "即兴创作已连接") : t("SAMPLE DEMO MODE", "样例演示模式")}</span><p>{modeDescriptions[locale][mode]}</p><span className="privacy-note">{t("No account. No pressure. Just you.", "无需账号，不必正经，做你自己。")}</span></div>
      </section>

      <section className="manifesto"><span className="manifesto-index">A SMALL MANIFESTO / 001</span><p>{t("Life happens. Have the last word.", "生活自有安排，你有你的措辞。")}</p><span>{t("Ordinary life. Outrageously well put.", "大骚至简，至疯无声。")}</span></section>
    </main>
    <footer className="footer shell"><span>© 2026 ABSURDLY YOURS</span><span>{t("MADE FOR THE HUMAN IN THE ROOM.", "谨以此，献给那个有趣的自己。")}</span><span className="footer-sign">with a straight face. ↗</span></footer>
    {showFavorites && <div className="drawer-scrim" onClick={() => setShowFavorites(false)}><section className="favorites-drawer" role="dialog" aria-modal="true" aria-label={t("My lines", "我的妙句")} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {if(e.key === "Escape") setShowFavorites(false); if(e.key === "Tab") { const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")); const first = items[0], last = items[items.length-1]; if(e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();} else if(!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();} }}}><div className="drawer-heading"><h2>{t("Quite you.", "字里行间，都是你。")}</h2><button onClick={() => setShowFavorites(false)} aria-label={t("Close saved lines", "关闭收藏")} autoFocus><Icon name="close"/></button></div><p className="drawer-description">{t("Remember the expressions you like. Up to five little masterpieces.", "记住你喜欢的表达，最多留下五条妙句。")}{!storageAvailable && <span>{t(" Saved for this session only.", " 当前仅在本次会话保存。")}</span>}</p>{favorites.length ? <><div className="saved-list">{favorites.map((item) => <button key={item.id} onClick={() => {invalidate(); setResult(item); setResultInput(null); setShowFavorites(false); setPhase("success");}}><span>{modeNames[locale][item.mode]} · {item.locale === "en" ? "EN" : "中文"}</span><p>{resultPlainText(item)}</p><span>{t("Open this line", "打开这条妙句")} ↗</span></button>)}</div><button className="clear-favorites" onClick={() => persist([])}>{t("Clear remembered expressions", "清空喜欢的表达")}</button></> : <div className="favorites-empty"><Icon name="heart" size={32}/><p>{t("A line feels like you? Keep it.", "遇到像自己的那一句，就留下吧。")}</p></div>}</section></div>}
    {toast && <div className="toast" role="status"><Icon name="check" size={16}/>{toast}</div>}
  </div>;
}

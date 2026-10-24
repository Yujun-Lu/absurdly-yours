export type Locale = "en" | "zh";
export type Mode = "rewrite" | "poetry" | "bulletin" | "diary" | "reply";
export type Flair = 1 | 2 | 3;
export type BulletinStyle = "bulletin" | "award";
export type ResultText = { title: string; body: string; footer: string };
export type GenerationRequest = {
  text: string;
  mode: Mode;
  flair: Flair;
  locale: Locale;
  bulletinStyle?: BulletinStyle;
  recipient?: string;
  intent?: string;
  incomingMessage?: string;
  styleExamples?: string[];
};
export type GenerationResult = ResultText & {
  source: "live" | "sample";
  locale: Locale;
  mode: Mode;
  flair: Flair;
  bulletinStyle?: BulletinStyle;
};
export type SavedResult = GenerationResult & { id: string };
export type Capabilities = { generation: boolean; transcription: boolean };
export const resultPlainText = (result: ResultText) =>
  [result.title, result.body, result.footer].filter(Boolean).join("\n\n");

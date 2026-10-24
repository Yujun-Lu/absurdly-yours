import type { BulletinStyle, Flair, GenerationRequest, Locale, Mode, ResultText } from "./types";

export type Sample = {
  id: string;
  input: string;
  results: Record<Flair, ResultText>;
};

const line = (body: string): ResultText => ({ title: "", body, footer: "" });
const same = (result: ResultText): Record<Flair, ResultText> => ({ 1: result, 2: result, 3: result });

const samples: Record<Locale, Record<Mode | "award", Sample>> = {
  en: {
    rewrite: {
      id: "en-rewrite",
      input: "I had six meetings today and got absolutely nothing done.",
      results: {
        1: line("Six meetings today. The actual work remained entirely undisturbed."),
        2: line("Six meetings today. My to-do list has started attending them as a spectator sport."),
        3: line("I convened six councils today. The realm of actual work remains pristine, untouched by human achievement."),
      },
    },
    poetry: {
      id: "en-poetry",
      input: "I forgot my umbrella. I don't mind getting wet, but I'm worried about my laptop.",
      results: same(line("Into every life a little rain must fall. Preferably not into my laptop.")),
    },
    bulletin: {
      id: "en-bulletin",
      input: "I finally did three loads of laundry, but one sock has gone missing.",
      results: same({
        title: "Department of Domestic Affairs",
        body: "Three loads of laundry have been successfully restored to civilization. One sock remains unaccounted for.",
        footer: "Official guidance: hang the washing. Do not escalate to national security.",
      }),
    },
    award: {
      id: "en-award",
      input: "I finally washed all the clothes piled on my chair.",
      results: same({
        title: "The Order of the Liberated Chair",
        body: "Awarded for washing the clothes and restoring a chair to its original, long-forgotten purpose.",
        footer: "For distinguished service to sitting down.",
      }),
    },
    diary: {
      id: "en-diary",
      input: "I overslept, worked on homework all afternoon, then had instant noodles for dinner. I let them steep for three minutes.",
      results: same(line("My morning appearance was postponed. The afternoon was spent in negotiations with homework. Dinner was instant noodles, granted a full three-minute audience before being received.")),
    },
    reply: {
      id: "en-reply",
      input: "Thank my friend for the invitation, but say I'd like to rest at home this Friday. Suggest we meet next week instead.",
      results: same(line("Thanks for the invite! This Friday I'm staying home to rest; my sofa has requested a private audience. Let's get together next week instead.")),
    },
  },
  zh: {
    rewrite: {
      id: "zh-rewrite",
      input: "今天开了六个会，什么都没干。",
      results: {
        1: line("今日赴会六场，工作未受惊扰。"),
        2: line("今天开了六个会。待办清单旁听全程，工作本身没来。"),
        3: line("今日六度临朝，议事甚勤。实务寸步未动，足见本人对原始工作现场保护之周全。"),
      },
    },
    poetry: {
      id: "zh-poetry",
      input: "下雨没带伞，我倒无所谓，主要怕电脑淋坏。",
      results: same(line("一蓑烟雨任平生，电脑不行。")),
    },
    bulletin: {
      id: "zh-bulletin",
      input: "今天终于洗了三桶衣服，但是少了一只袜子。",
      results: same({
        title: "《本日家务奏报》",
        body: "衣三桶，皆净。袜一只，去向不明。",
        footer: "批示：先晾衣，暂不惊动朝廷。",
      }),
    },
    award: {
      id: "zh-award",
      input: "今天终于把椅子上堆的衣服洗了。",
      results: same({
        title: "纤维文明复兴勋章",
        body: "表彰你以一己之力，结束了椅背兼任衣柜的临时政权。",
        footer: "特此加冕，准予落座。",
      }),
    },
    diary: {
      id: "zh-diary",
      input: "早上睡过头，中午一直写作业，晚上吃了桶泡面，泡了三分钟。",
      results: same(line("晨起未遂，午与作业对峙。入夜以泡面设宴，盖子压满三分钟，礼数总算周全。")),
    },
    reply: {
      id: "zh-reply",
      input: "谢谢朋友邀请！这周五想在家休息，下周再约。",
      results: same(line("谢谢邀请！这周五已与沙发订下静养之约，我先在家休息，下周再隆重出山与你相聚。")),
    },
  },
};

export function getSample(mode: Mode, locale: Locale, bulletinStyle: BulletinStyle = "bulletin"): Sample {
  return samples[locale][mode === "bulletin" && bulletinStyle === "award" ? "award" : mode];
}

/** Exact prewritten matching only. Callers must also require explicit sample selection. */
export function findSampleResult(request: GenerationRequest): ResultText | null {
  const sample = getSample(request.mode, request.locale, request.bulletinStyle);
  return sample.input.trim() === request.text.trim() ? { ...sample.results[request.flair] } : null;
}

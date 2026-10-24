## Inspiration

Modern life gives us plenty of tools for getting more done. I wanted to make something for the part of us that is still funny, expressive, and a little unreasonable after the work is over.

The inspiration is a particular kind of humor: the world may be falling apart, but you can still straighten your collar and deliver an excellent line. It acknowledges the mess while preserving the freedom to respond with warmth, poise, and personality.

In Chinese, I think of this as “骚”: a mixture of wit, flair, playful absurdity, and elegant audacity. **Absurdly Yours · 骚有介事** turns that spirit into a voice-first creative playground. Small frustrations and tiny victories deserve a little ceremony. Sometimes, finding your own way to describe a day is a way of feeling like yourself again.

## What it does

Say something ordinary, review the transcription, and give it some flair. For example:

> “I had six meetings today and got absolutely nothing done.”
>
> “Six meetings today. The actual work remained entirely undisturbed.”

Five modes turn everyday speech into dry wit, literary twists, mock official bulletins, miniature memoirs, or ready-to-edit social replies. Three flair levels range from **Understated** to **Absurd** to **Magnificent**. A laundry day can become a Department of Domestic Affairs bulletin; clearing clothes off a chair can earn an entirely excessive award.

Users can switch between English and Chinese, edit the result, copy it, save favorite expressions, or ask a system voice to read it with a straight face. A keyboard input is always available.

## How we built it

I built a single-page application with **Next.js, React, TypeScript, and CSS**, with implementation assistance from **Codex**. The visual direction combines warm paper, restrained orange, serif typography, and generous space: an elegant setting for occasionally unhinged language.

The browser captures short recordings through the Web Audio API and AudioWorklet, then actually resamples them into mono PCM WAV. A server-side route sends the recording to **Alibaba Cloud DashScope’s Qwen ASR**. Users can correct the transcript before a second route sends their words to **Qwen3.8-Flash** for creative writing.

JSON Schema keeps results structured as a title, body, and closing. A separate factual editing pass checks the draft against the original. API credentials stay on the server. Browser speech synthesis handles playback, while localStorage remembers up to five expressions the user explicitly chooses.

## Challenges we ran into

The hardest problem was making language more ridiculous without making the facts less reliable. An early laundry bulletin invented a washing-machine detail. I tightened the prompts and added a factual review pass, separating welcome imaginary grandeur from unwanted invented events.

Humor also changes across languages. A Chinese literary pun rarely survives literal translation, so each language is written independently from the original meaning.

On the engineering side, I had to handle real audio encoding, microphone failures, request cancellation, and an environment-variable conflict that caused the server to use an older credential. I also built an explicitly labeled sample mode so a missing connection never masquerades as a successful AI response.

## Accomplishments that we're proud of

I’m proud of connecting the full journey: voice capture, editable transcription, creative output, and sharing. The five modes feel like different ways to express yourself while sharing one simple interface.

The prototype supports both languages and mobile layouts, with real cloud transcription and generation verified. Production builds and 12 focused tests pass. I also validated the browser recording pipeline with controlled synthetic speech, including its 30-second recording limit.

Most of all, the product makes room for personality. Rest can remain rest. Sadness can remain sadness. Neither has to become a motivational speech to deserve an interesting sentence.

## What we learned

Good humor starts with attention: the missing sock, the untouched task, the three minutes spent waiting for noodles. Specific details carry more personality than a pile of dramatic adjectives.

I also learned that creative control matters. Being able to edit, turn the flair down, or keep a favorite line helps the output feel like something the user owns. Reliable state handling and honest failure messages make that creative experience easier to trust.

## What's next for Absurdly Yours · 骚有介事

Next, I want to test with people using their own microphones, expressions, and everyday situations. I would use their feedback to improve comedic timing, preserve meaning more consistently, and make English and Chinese styles feel equally natural.

Other next steps include exportable quote cards, more precise tone controls, and a hosted version of the full voice-and-AI experience with appropriate access controls and usage limits. The guiding idea stays the same: give ordinary life a little more personality, and give the person living it the final word.

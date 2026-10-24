# Browser and delivery verification

Checked 2026-10-24 in the Codex in-app Chromium browser, against the running local app and the final Next.js production build.

## Passed

- English page opens by default. Chinese switch updates controls and examples while preserving the original input and the older result's actual language label.
- Live generation succeeds from the UI. The previous editable result remains visible during generation and failed requests.
- Starting a new generation and immediately changing language cancels the old request. Its eventual result does not overwrite the previous result.
- Edited output is the exact text copied to the clipboard and remembered by the preference button.
- Bulletin copying includes its title, body and closing, with no interface labels.
- System speech enters the playing state, returns to idle after completion, and supports an explicit Stop click. Source is labelled System voice.
- All five modes and both bulletin templates have working explicitly chosen samples. Rewrite samples differ at all three levels; maximum/minimum gear buttons disable correctly.
- Forced sample mode identifies itself. After editing a sample's input, custom generation shows the expected unavailable-service message and retains the prior result.
- Saved expressions deduplicate, retain at most five after six distinct selections, and survive reload. The clear button removes the saved expressions.
- A controlled `Storage.prototype.setItem` quota failure caused the app to continue with session-only saved expressions and accurately explain that status. Reload removed the temporary test override.
- A controlled `NotAllowedError` from the microphone API showed the permission-denied explanation and kept keyboard/sample paths available. No physical microphone permission was granted during testing.
- The real AudioWorklet capture pipeline received a synthetic spoken fixture through a temporary browser media-stream test source. It encoded an actual WAV, submitted it to the live transcription route and received recognized text in the editable input. Editing that transcript and generating a result succeeded.
- A second synthetic capture was left running: the 30-second hard limit automatically stopped recording and submitted transcription. The repeated fixture's recognized speech appeared in the input.
- Reload removed all temporary microphone/storage test substitutions. QA-created saved expressions were cleared; no fixture stream or playback was left running.
- Desktop 1440px and phone 390px/320px layouts checked. One 5px horizontal overflow at the smallest English width was traced to the decorative star and corrected. Final narrow-screen measurements have matching document/client widths.
- The final production server serves on `http://127.0.0.1:3000`. Production build, TypeScript and 12 substantive tests pass. A scan of client assets and QA reports found no supplied credential.

## Evidence

- `screenshots/desktop-en.png`: English desktop layout with live generated result.
- `screenshots/desktop-zh.png`: Chinese official-bulletin layout.
- `screenshots/mobile-zh.png`: narrow mobile layout with the same editable result.
- Backend calls and content checks are detailed in `verification.md` and `api-verification.json`.

## Scope of audio verification

The spoken fixture was synthesized locally. It tests real browser capture, WAV conversion, HTTP upload, cloud ASR and the following editing/generation flow. A person speaking into a physical microphone and the acoustic conditions at the hackathon have **not** been tested. Before presenting, allow the site's microphone and try one short sentence with the actual device. No public deployment was performed.

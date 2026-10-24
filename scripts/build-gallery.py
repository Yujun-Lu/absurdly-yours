"""Build truthful, Devpost-ready 3:2 media from actual captured app screens.

Run with the bundled Python runtime (Pillow). Screenshots are never retouched;
they are fitted inside a simple editorial frame. GIF captions explain each step.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "qa" / "local-gallery-frames"
OUTPUT = ROOT / "devpost" / "gallery"
DOC_ASSETS = ROOT / "docs" / "assets"
W, H = 1200, 800
CREAM = "#f8f6f0"
INK = "#272821"
MUTED = "#717568"
ORANGE = "#dc5934"
LINE = "#d9ddce"
WINDOW = "#fcfbf7"
FONTS = Path("C:/Windows/Fonts")


def font(size: int, face: str = "sans") -> ImageFont.FreeTypeFont:
    filename = {"sans": "arial.ttf", "bold": "arialbd.ttf", "serif": "georgia.ttf",
                "italic": "georgiai.ttf", "chinese": "msyh.ttc"}[face]
    return ImageFont.truetype(str(FONTS / filename), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        current = ""
        for word in paragraph.split():
            candidate = f"{current} {word}".strip()
            if current and draw.textlength(candidate, font=face) > width:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines


def paragraph(draw, text: str, xy, face, width: int, fill=INK, leading: float = 1.4):
    x, y = xy
    for line in wrap(draw, text, face, width):
        draw.text((x, y), line, font=face, fill=fill)
        y += round(face.size * leading)
    return y


def star(draw, cx: int, cy: int, radius: int, fill=ORANGE):
    points = []
    for index in range(24):
        angle = index * math.pi / 12 - math.pi / 2
        length = radius if index % 2 == 0 else radius * 0.37
        points.append((cx + math.cos(angle) * length, cy + math.sin(angle) * length))
    draw.polygon(points, fill=fill)


def base() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    canvas = Image.new("RGB", (W, H), CREAM)
    return canvas, ImageDraw.Draw(canvas)


def make_cover() -> Image.Image:
    canvas, draw = base()
    star(draw, 81, 70, 23)
    draw.text((119, 42), "Absurdly Yours", font=font(35, "serif"), fill=INK)
    draw.text((121, 85), "骚有介事", font=font(15, "chinese"), fill=MUTED)
    draw.text((922, 55), "VOICE IN.", font=font(12, "bold"), fill=MUTED)
    draw.text((922, 76), "PERSONALITY OUT.", font=font(12, "bold"), fill=MUTED)
    draw.line((60, 121, 1140, 121), fill=LINE, width=1)
    draw.text((62, 155), "Ordinary life.", font=font(68, "serif"), fill=INK)
    draw.text((60, 236), "Outrageously well put.", font=font(62, "italic"), fill=ORANGE)
    star(draw, 1093, 189, 28)
    draw.text((63, 330), "A voice-first playground for your wonderfully unreasonable side.",
              font=font(21), fill=MUTED)

    left = (60, 401, 552, 637)
    right = (594, 401, 1140, 637)
    draw.rounded_rectangle(left, radius=9, fill="#eeefe5", outline=LINE, width=1)
    draw.rounded_rectangle(right, radius=9, fill=WINDOW, outline="#c5cdb7", width=1)
    draw.text((83, 425), "THE ORDINARY", font=font(11, "bold"), fill=MUTED)
    draw.text((618, 425), "THE EXTRAORDINARY", font=font(11, "bold"), fill=MUTED)
    paragraph(draw, "I had six meetings today and got nothing done.", (84, 474),
              font(28, "serif"), 427, leading=1.45)
    paragraph(draw, "Six meetings today. The actual work remained entirely undisturbed.",
              (618, 465), font(30, "serif"), 494, leading=1.38)
    draw.text((560, 507), "→", font=font(28), fill=ORANGE)
    draw.text((63, 660), "ILLUSTRATIVE EXAMPLE · FROM THE PROJECT'S SELECTED PRESETS",
              font=font(10), fill=MUTED)
    draw.line((60, 704, 1140, 704), fill=LINE, width=1)
    draw.text((63, 734), "VOICE-FIRST", font=font(12, "bold"), fill=INK)
    draw.text((270, 734), "ENGLISH + CHINESE", font=font(12, "bold"), fill=INK)
    draw.text((560, 734), "FIVE WAYS TO EXPRESS YOURSELF", font=font(12, "bold"), fill=INK)
    draw.text((970, 729), "with a straight face.", font=font(17, "italic"), fill=ORANGE)
    return canvas


def compose_screen(capture: Image.Image, title: str, subtitle: str, step: int, total: int,
                   source: str) -> Image.Image:
    canvas, draw = base()
    star(draw, 63, 49, 16)
    draw.text((90, 30), "Absurdly Yours", font=font(21, "serif"), fill=INK)
    source_width = draw.textlength(source, font=font(11))
    draw.text((W - 43 - source_width, 37), source, font=font(11), fill=MUTED)
    draw.text((43, 73), title, font=font(32, "serif"), fill=INK)
    draw.text((44, 115), subtitle, font=font(14), fill=MUTED)

    # A neutral display frame; all content inside is an actual app screenshot.
    draw.rounded_rectangle((40, 150, 1162, 722), radius=8, fill="#e6e8dc")
    draw.rounded_rectangle((38, 147, 1160, 719), radius=8, fill=WINDOW, outline=LINE, width=1)
    draw.rounded_rectangle((39, 148, 1159, 175), radius=7, fill="#eceee4")
    draw.rectangle((39, 162, 1159, 175), fill="#eceee4")
    for x, color in [(54, "#d1b4a4"), (69, "#d6cba4"), (84, "#b5c2a0")]:
        draw.ellipse((x, 157, x + 6, 163), fill=color)
    draw.text((105, 154), "ABSURDLY YOURS · PRODUCT DEMO", font=font(8), fill="#8f967e")
    image = ImageOps.contain(capture.convert("RGB"), (1118, 541), Image.Resampling.LANCZOS)
    canvas.paste(image, (40 + (1118 - image.width) // 2, 176 + (541 - image.height) // 2))

    bar_left, bar_right, y = 43, 1158, 748
    gap = 8
    segment = (bar_right - bar_left - gap * (total - 1)) / total
    for index in range(total):
        x = round(bar_left + index * (segment + gap))
        draw.rounded_rectangle((x, y, x + round(segment), y + 3), radius=1,
                               fill=ORANGE if index == step - 1 else "#dce0d0")
    draw.text((43, 765), f"{step:02d} / {total:02d}", font=font(10, "bold"), fill=ORANGE)
    draw.text((110, 764), "Ordinary life. Outrageously well put.", font=font(12, "italic"), fill=MUTED)
    end = "ABSURDLY YOURS · 骚有介事"
    draw.text((950, 765), end, font=font(10, "chinese"), fill=MUTED)
    return canvas


def load_frames(prefix: str, count: int) -> list[Image.Image]:
    paths = [CAPTURES / f"{prefix}-{index:02d}.png" for index in range(1, count + 1)]
    missing = [str(path.relative_to(ROOT)) for path in paths if not path.exists()]
    if missing:
        raise SystemExit("Missing captured app frames: " + ", ".join(missing))
    return [Image.open(path).convert("RGB") for path in paths]


def gif_palette(frames: list[Image.Image], colors: int) -> Image.Image:
    # A common palette avoids a distracting palette flash between app screens.
    swatches = Image.new("RGB", (300 * len(frames), 200), CREAM)
    for index, frame in enumerate(frames):
        swatches.paste(frame.resize((300, 200), Image.Resampling.LANCZOS), (index * 300, 0))
    return swatches.quantize(colors=colors, method=Image.Quantize.MEDIANCUT)


def make_gif(path: Path, screens: list[Image.Image]) -> tuple[int, int]:
    # The opening state is the finished screen, so the GIF is useful even when
    # an uploader freezes it on its first frame. Steps then tell the real story.
    sequence = [screens[-1], *screens]
    for colors, fades in [(128, 3), (96, 2), (64, 0)]:
        timeline: list[Image.Image] = []
        durations: list[int] = []
        for index, screen in enumerate(sequence):
            if index and fades:
                for fade in range(1, fades + 1):
                    timeline.append(Image.blend(sequence[index - 1], screen, fade / (fades + 1)))
                    durations.append(80)
            timeline.append(screen)
            durations.append(1300 if index == 0 else 2500 if len(screens) == 4 else 3200)
        palette = gif_palette(sequence, colors)
        indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in timeline]
        indexed[0].save(path, save_all=True, append_images=indexed[1:], duration=durations,
                        loop=0, optimize=True, disposal=1)
        if path.stat().st_size < 5_000_000:
            return len(indexed), sum(durations)
    raise RuntimeError(f"GIF remains over the upload limit: {path.name}")


def mirror(path: Path):
    DOC_ASSETS.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, DOC_ASSETS / path.name)


def file_record(path: Path, caption: str, source: str) -> dict:
    with Image.open(path) as image:
        frame_count = getattr(image, "n_frames", 1)
        duration = 0
        for index in range(frame_count):
            image.seek(index)
            duration += image.info.get("duration", 0)
        record = {
            "file": path.name, "caption": caption, "source": source,
            "width": image.width, "height": image.height, "ratio": "3:2",
            "bytes": path.stat().st_size, "mbDecimal": round(path.stat().st_size / 1_000_000, 3),
            "frames": frame_count, "durationMs": duration,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    assert (record["width"], record["height"]) == (W, H)
    assert record["bytes"] < 5_000_000
    return record


def contact_sheet(images: list[tuple[str, Image.Image]]) -> Image.Image:
    canvas, draw = base()
    draw.text((20, 5), "DEVPOST GALLERY · UPLOAD ORDER", font=font(12, "bold"), fill=MUTED)
    for index, (label, image) in enumerate(images):
        x = 20 + (index % 2) * 590
        y = 31 + (index // 2) * 382
        thumb = image.resize((570, 380), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y))
        draw.rectangle((x, y + 351, x + 570, y + 380), fill=INK)
        draw.text((x + 12, y + 358), label, font=font(12), fill="#fffaf1")
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cover-only", action="store_true")
    parser.add_argument("--flair-source", choices=["live", "preset"], default="preset")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    cover = make_cover()
    cover_path = OUTPUT / "hero.png"
    cover.save(cover_path, optimize=True)
    mirror(cover_path)
    records = [file_record(cover_path, "Ordinary life. Outrageously well put.", "Illustrative example from project presets")]
    previews = [("00 · Cover", cover)]
    if not args.cover_only:
        definitions = [
            ("voice", 4, "gallery-01-voice", "Your voice. Your words. Your wit.",
             ["Speak a little ordinary", "Review the transcript", "Give it flair", "Keep the line that feels like you"],
             "Recorded demo · synthesized speech"),
            ("flair", 3, "gallery-02-flair", "Same meaning. Three degrees of flair.",
             ["Understated · a raised eyebrow", "Absurd · a delightful detour", "Magnificent · an entrance, naturally"],
             "Live generated examples" if args.flair_source == "live" else "Selected preset examples"),
            ("bulletin", 3, "gallery-03-bulletin", "Small matters. Entirely excessive ceremony.",
             ["A formal bulletin for a missing sock", "An award for liberating a chair", "The same playful spirit, in Chinese"],
             "Selected preset examples"),
        ]
        for prefix, count, basename, title, steps, source in definitions:
            captured = load_frames(prefix, count)
            screens = [compose_screen(capture, title, steps[index], index + 1, count, source)
                       for index, capture in enumerate(captured)]
            gif_path = OUTPUT / f"{basename}.gif"
            make_gif(gif_path, screens)
            fallback = OUTPUT / f"{basename}.png"
            screens[-1].save(fallback, optimize=True)
            mirror(gif_path)
            mirror(fallback)
            records += [file_record(gif_path, title, source), file_record(fallback, title, source)]
            previews.append((f"0{len(previews)} · {title}", screens[-1]))
        sheet = contact_sheet(previews)
        sheet_path = OUTPUT / "_preview-contact-sheet.jpg"
        sheet.save(sheet_path, quality=92, optimize=True)
    manifest = {
        "recommendedUploadOrder": ["hero.png", "gallery-01-voice.gif", "gallery-02-flair.gif", "gallery-03-bulletin.gif"],
        "requirements": {"width": W, "height": H, "ratio": "3:2", "maxBytesPerFile": 5_000_000},
        "notes": "GIFs use actual captured product screens; synthesized voice and preset examples are labelled. PNG files are upload fallbacks.",
        "files": records,
    }
    (OUTPUT / "gallery-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps([{key: item[key] for key in ["file", "bytes", "frames", "durationMs"]} for item in records], indent=2))


if __name__ == "__main__":
    main()

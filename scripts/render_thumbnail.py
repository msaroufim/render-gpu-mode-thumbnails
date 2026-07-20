#!/usr/bin/env python3
"""Render a GPU MODE YouTube thumbnail from a small JSON request."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps


WIDTH = 1280
HEIGHT = 720
BACKGROUND = "#FFFFFF"
FOREGROUND = "#0F0D0C"
SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOGO = SKILL_ROOT / "assets" / "gpu-mode-logo-black.png"
FONT_CANDIDATES = (
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/Library/Fonts/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render an exact 1280x720 GPU MODE speaker thumbnail."
    )
    parser.add_argument("--config", required=True, type=Path, help="JSON request path")
    parser.add_argument("--output", required=True, type=Path, help="Output PNG path")
    parser.add_argument("--font", type=Path, help="Optional bold TrueType/OpenType font")
    return parser.parse_args()


def load_request(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Config file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Config is not valid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Config must contain a JSON object")
    title = payload.get("title")
    speakers = payload.get("speakers")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Config field 'title' must be a non-empty string")
    if not isinstance(speakers, list) or not 1 <= len(speakers) <= 3:
        raise ValueError("Config field 'speakers' must contain one to three speakers")

    for index, speaker in enumerate(speakers, start=1):
        if not isinstance(speaker, dict):
            raise ValueError(f"Speaker {index} must be an object")
        if not isinstance(speaker.get("name"), str) or not speaker["name"].strip():
            raise ValueError(f"Speaker {index} needs a non-empty name")
        photo = speaker.get("photo")
        if not isinstance(photo, str) or not photo:
            raise ValueError(f"Speaker {index} needs an absolute photo path")
        photo_path = Path(photo).expanduser()
        if not photo_path.is_absolute():
            raise ValueError(f"Speaker {index} photo path must be absolute: {photo}")
        if not photo_path.is_file():
            raise ValueError(f"Speaker {index} photo does not exist: {photo_path}")
        for key in ("focal_x", "focal_y"):
            value = speaker.get(key, 0.5)
            if not isinstance(value, (int, float)) or not 0.0 <= float(value) <= 1.0:
                raise ValueError(f"Speaker {index} {key} must be between 0.0 and 1.0")

    subtitle = payload.get("subtitle", "")
    if subtitle is not None and not isinstance(subtitle, str):
        raise ValueError("Config field 'subtitle' must be a string when provided")
    return payload


def resolve_font(requested: Path | None) -> Path:
    if requested:
        path = requested.expanduser().resolve()
        if not path.is_file():
            raise ValueError(f"Font does not exist: {path}")
        return path
    for candidate in FONT_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise ValueError("No supported bold sans-serif font found; pass --font /path/font.ttf")


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def fitted_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: Path,
    max_width: int,
    max_size: int,
    min_size: int,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -1):
        font = ImageFont.truetype(str(font_path), size=size)
        if text_size(draw, text, font)[0] <= max_width:
            return font
    raise ValueError(f"Text is too long for the template: {text!r}")


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: str = FOREGROUND,
    center_x: int = WIDTH // 2,
) -> None:
    left, top, right, _ = draw.textbbox((0, 0), text, font=font)
    text_width = right - left
    x = center_x - text_width // 2 - left
    draw.text((x, y - top), text, font=font, fill=fill)


def square_portrait(path: Path, size: int, focal_x: float, focal_y: float) -> Image.Image:
    with Image.open(path) as source:
        source = ImageOps.exif_transpose(source).convert("RGB")
        return ImageOps.fit(
            source,
            (size, size),
            method=Image.Resampling.LANCZOS,
            centering=(focal_x, focal_y),
        )


def speaker_layout(count: int) -> tuple[int, int, int]:
    if count == 1:
        return 400, 440, 0
    if count == 2:
        return 360, 240, 80
    return 330, 100, 45


def render(payload: dict[str, Any], output: Path, font_path: Path) -> None:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(canvas)

    title = payload["title"].strip()
    subtitle = (payload.get("subtitle") or "").strip()
    title_font = fitted_font(draw, title, font_path, 1160, 92, 48)
    draw_centered_text(draw, title, 44, title_font)

    if subtitle:
        subtitle_font = fitted_font(draw, subtitle, font_path, 920, 32, 22)
        draw_centered_text(draw, subtitle, 138, subtitle_font)

    speakers = payload["speakers"]
    photo_size, start_x, gap = speaker_layout(len(speakers))
    photo_y = 190
    name_y = photo_y + photo_size + 23

    for index, speaker in enumerate(speakers):
        x = start_x + index * (photo_size + gap)
        portrait = square_portrait(
            Path(speaker["photo"]).expanduser(),
            photo_size,
            float(speaker.get("focal_x", 0.5)),
            float(speaker.get("focal_y", 0.5)),
        )
        canvas.paste(portrait, (x, photo_y))
        name = speaker["name"].strip()
        name_font = fitted_font(draw, name, font_path, photo_size + 45, 46, 27)
        draw_centered_text(
            draw,
            name,
            name_y,
            name_font,
            center_x=x + photo_size // 2,
        )

    if not DEFAULT_LOGO.is_file():
        raise ValueError(f"Bundled GPU MODE logo is missing: {DEFAULT_LOGO}")
    with Image.open(DEFAULT_LOGO) as logo_source:
        logo = logo_source.convert("RGBA")
        logo.thumbnail((180, 105), Image.Resampling.LANCZOS)
        logo_x = 28
        logo_y = HEIGHT - logo.height - 24
        canvas.paste(logo, (logo_x, logo_y), logo)

    output = output.expanduser()
    if not output.is_absolute():
        raise ValueError(f"Output path must be absolute: {output}")
    if output.suffix.lower() != ".png":
        raise ValueError("Output filename must end in .png")
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG", optimize=True)


def main() -> int:
    args = parse_args()
    try:
        payload = load_request(args.config.expanduser())
        font_path = resolve_font(args.font)
        render(payload, args.output, font_path)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(json.dumps({"output": str(args.output.expanduser()), "width": WIDTH, "height": HEIGHT}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

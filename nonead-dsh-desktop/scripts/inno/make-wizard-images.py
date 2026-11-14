"""Generate Inno Setup wizard artwork from build/app-icon.png.

Inno accepts BMP only, so the launcher logo is composited onto the wizard's white panel:
  * inno-wizard-image.bmp       164x314  (classic/modern left banner)
  * inno-wizard-small.bmp        55x55   (top-right small logo)
Run: python scripts/inno/make-wizard-images.py
"""
from pathlib import Path

from PIL import Image

BUILD = Path(__file__).resolve().parents[2] / "build"
SOURCE = BUILD / "app-icon.png"
BANNER = BUILD / "inno-wizard-image.bmp"
SMALL = BUILD / "inno-wizard-small.bmp"

# Inno draws the banner on a white panel; matching that keeps the logo edges clean.
BACKGROUND = (255, 255, 255)


def fit(logo: Image.Image, box: int) -> Image.Image:
    scale = box / max(logo.size)
    size = (max(1, round(logo.width * scale)), max(1, round(logo.height * scale)))
    return logo.resize(size, Image.LANCZOS)


def compose(canvas_size: tuple[int, int], box: int) -> Image.Image:
    canvas = Image.new("RGB", canvas_size, BACKGROUND)
    logo = fit(Image.open(SOURCE).convert("RGBA"), box)
    left = (canvas_size[0] - logo.width) // 2
    # Banner art sits in the upper third; the small logo is centred.
    top = round(canvas_size[1] * 0.18) if canvas_size[1] > canvas_size[0] else (canvas_size[1] - logo.height) // 2
    canvas.paste(logo, (left, top), logo)
    return canvas


def main() -> None:
    compose((164, 314), 132).save(BANNER, format="BMP")
    compose((55, 55), 48).save(SMALL, format="BMP")
    for path in (BANNER, SMALL):
        with Image.open(path) as image:
            print(f"{path.name}: {image.size[0]}x{image.size[1]} {image.mode} {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()

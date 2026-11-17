"""Generate the NSIS welcome/finish artwork from build/app-icon.png.

NSIS (Modern UI 2) accepts BMP only:
  * nsis-sidebar.bmp   164x314  (welcome/finish page banner, also the uninstaller banner)
  * nsis-header.bmp    150x57   (header image above the page body)

Both are white so the logo edges blend into the wizard panel.
Run: <bundled-python> scripts/nsis/make-nsis-images.py
"""
from pathlib import Path

from PIL import Image

BUILD = Path(__file__).resolve().parents[2] / "build"
SOURCE = BUILD / "app-icon.png"
SIDEBAR = BUILD / "nsis-sidebar.bmp"
HEADER = BUILD / "nsis-header.bmp"

BACKGROUND = (255, 255, 255)


def fit(logo: Image.Image, box: int) -> Image.Image:
    scale = box / max(logo.size)
    size = (max(1, round(logo.width * scale)), max(1, round(logo.height * scale)))
    return logo.resize(size, Image.LANCZOS)


def compose(canvas_size: tuple[int, int], box: int, top_ratio: float | None) -> Image.Image:
    canvas = Image.new("RGB", canvas_size, BACKGROUND)
    logo = fit(Image.open(SOURCE).convert("RGBA"), box)
    left = (canvas_size[0] - logo.width) // 2
    if top_ratio is None:
        top = (canvas_size[1] - logo.height) // 2
    else:
        top = round(canvas_size[1] * top_ratio)
    canvas.paste(logo, (left, top), logo)
    return canvas


def main() -> None:
    compose((164, 314), 132, 0.18).save(SIDEBAR, format="BMP")
    compose((150, 57), 46, None).save(HEADER, format="BMP")
    for path in (SIDEBAR, HEADER):
        with Image.open(path) as image:
            print(f"{path.name}: {image.size[0]}x{image.size[1]} {image.mode} {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()

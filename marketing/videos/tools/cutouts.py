"""Cut Hospedín poses out of the reference sheets and remove their background.

Run with: uv run --with 'rembg[cpu]' --with pillow python tools/cutouts.py
"""

from pathlib import Path

from PIL import Image, ImageChops
from rembg import new_session, remove

from marketing_paths import CHARACTER_DIR, PUBLIC_DIR

SRC = CHARACTER_DIR
OUT = PUBLIC_DIR / "hospedin"
PREVIEW = OUT / "_preview"

# (name, source file, crop box or None for the whole image). Boxes exclude the text labels.
POSES = [
    ("main", "personaje.png", None),
    ("saludando", "acciones.png", (90, 10, 270, 258)),
    ("senalando", "acciones.png", (375, 20, 560, 258)),
    ("te-explico", "acciones.png", (640, 20, 840, 258)),
    ("descubri", "acciones.png", (930, 20, 1110, 258)),
    ("es-facil", "acciones.png", (1185, 20, 1385, 258)),
    ("enumerando", "acciones.png", (105, 285, 285, 518)),
    ("vamos", "acciones.png", (355, 280, 525, 518)),
    ("pensando", "acciones.png", (665, 280, 805, 518)),
    ("lamparita", "acciones.png", (630, 545, 850, 762)),
    ("telefono", "acciones.png", (925, 545, 1090, 762)),
]

PAD = 6
UPSCALE = 3


def saturation_mask(img: Image.Image) -> Image.Image:
    """Alpha mask that is opaque on clearly colored pixels and transparent on white/grey."""
    sat = img.convert("HSV").getchannel("S")
    # Ramp from S=40 (transparent) to S=90 (opaque); background and soft shadows sit below 40.
    return sat.point(lambda s: max(0, min(255, (s - 40) * 255 // 50)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use")
    for name, src, box in POSES:
        img = Image.open(SRC / src).convert("RGB")
        if box:
            img = img.crop(box)
            # Sheet poses are tiny; upscaling first gives the model more to work with.
            img = img.resize((img.width * UPSCALE, img.height * UPSCALE), Image.LANCZOS)
        cut = remove(img, session=session)
        # The model drops thin or detached saturated parts (the sun, outstretched arms).
        # Every saturated pixel belongs to the character, so union them into the mask.
        # rembg zeroes the RGB of discarded pixels, so take color from the source image.
        alpha = ImageChops.lighter(cut.getchannel("A"), saturation_mask(img))
        cut = img.convert("RGBA")
        cut.putalpha(alpha)
        bbox = cut.getbbox()
        if bbox:
            x0, y0, x1, y1 = bbox
            cut = cut.crop((max(0, x0 - PAD), max(0, y0 - PAD), min(cut.width, x1 + PAD), min(cut.height, y1 + PAD)))
        cut.save(OUT / f"{name}.png")
        for label, color in (("dark", (13, 43, 62)), ("white", (255, 255, 255))):
            bg = Image.new("RGBA", cut.size, (*color, 255))
            bg.alpha_composite(cut)
            bg.convert("RGB").save(PREVIEW / f"{name}-{label}.png")
        print(f"{name}: {cut.size}")


if __name__ == "__main__":
    main()

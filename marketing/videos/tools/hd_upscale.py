"""Step 1: Real-ESRGAN anime 6B upscale of each pose crop. Usage: hd_upscale.py <outdir>"""
import sys
from pathlib import Path
import numpy as np, torch
from PIL import Image
from spandrel import ModelLoader
from hd_poses import POSES, SRC
from marketing_paths import MODELS_DIR

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(12)
model = ModelLoader().load_from_file(str(MODELS_DIR / "RealESRGAN_x4plus_anime_6B.pth")).eval()

def sr(img, tile=192, pad=16):
    a = torch.from_numpy(np.asarray(img).astype(np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = a.shape
    o = torch.zeros(1, 3, h * 4, w * 4)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1, x1 = min(h, y + tile + pad), min(w, x + tile + pad)
            with torch.no_grad():
                r = model(a[:, :, y0:y1, x0:x1])
            cy, cx = (y - y0) * 4, (x - x0) * 4
            th, tw = min(tile, h - y), min(tile, w - x)
            o[:, :, y * 4:(y + th) * 4, x * 4:(x + tw) * 4] = r[:, :, cy:cy + th * 4, cx:cx + tw * 4]
    return Image.fromarray((o[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype(np.uint8))

for name, f, box, scale in POSES:
    img = Image.open(f"{SRC}/{f}").convert("RGB")
    if box: img = img.crop(box)
    up = sr(img)  # 4x
    if scale == 2: up = up.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    up.save(out / f"{name}.png"); print(name, up.size, flush=True)

"""Step 2: raw rembg alpha per model per pose. Usage: hd_alphas.py <updir> <outdir> <model> [<model>...]"""
import sys
from pathlib import Path
from PIL import Image
from rembg import new_session, remove
from hd_poses import POSES

up, out, models = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
for m in models:
    (out / m).mkdir(parents=True, exist_ok=True)
    s = new_session(m)
    for name, *_ in POSES:
        img = Image.open(up / f"{name}.png").convert("RGB")
        remove(img, session=s).getchannel("A").save(out / m / f"{name}.png")
        print(m, name, flush=True)

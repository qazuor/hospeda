"""Where the generated marketing assets live: OUTSIDE the repo.

Mirrors config/asset-paths.ts. Override the root with HOSPEDA_MARKETING_ASSETS_DIR.
"""
import os
from pathlib import Path

ASSETS_DIR = Path(os.environ.get("HOSPEDA_MARKETING_ASSETS_DIR", "/home/qazuor/projects/WEBS/marketing"))
LAB_DIR = ASSETS_DIR / "video-lab"
PUBLIC_DIR = LAB_DIR / "public"
MODELS_DIR = LAB_DIR / "tools" / "models"
CHECK_DIR = LAB_DIR / "tools" / "audio" / "_check"
CHARACTER_DIR = ASSETS_DIR / "personaje"

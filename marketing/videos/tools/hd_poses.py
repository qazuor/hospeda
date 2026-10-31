"""Shared pose table for the HD cutout pipeline."""
from marketing_paths import CHARACTER_DIR

SRC = str(CHARACTER_DIR)
POSES = [
    ("main", "personaje.png", None, 2),
    ("saludando", "acciones.png", (90, 10, 270, 258), 4),
    ("senalando", "acciones.png", (375, 20, 560, 258), 4),
    ("te-explico", "acciones.png", (640, 20, 840, 258), 4),
    ("descubri", "acciones.png", (930, 20, 1110, 258), 4),
    ("es-facil", "acciones.png", (1185, 20, 1385, 258), 4),
    ("enumerando", "acciones.png", (105, 285, 285, 518), 4),
    ("vamos", "acciones.png", (355, 280, 525, 518), 4),
    ("pensando", "acciones.png", (665, 280, 805, 518), 4),
    ("lamparita", "acciones.png", (630, 545, 850, 762), 4),
    ("telefono", "acciones.png", (925, 545, 1090, 762), 4),
]

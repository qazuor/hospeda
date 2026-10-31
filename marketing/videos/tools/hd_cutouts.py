"""Step 3: build HD cutouts, split the sun, emit layers.json + previews.

Usage: hd_cutouts.py <updir> <alphadir> <outdir> <model> [pose ...]
Inputs come from hd_upscale.py (RGB) and hd_alphas.py (raw rembg alpha per model).
"""
import json, sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image
from hd_poses import POSES

UP, ALPHA, OUT, MODEL = (Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
ONLY = set(sys.argv[5:])
PREV = OUT / "_preview"
PREV.mkdir(parents=True, exist_ok=True)
PAD = 4


def ell(k):
    k = max(1, int(round(k)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))


def fill_holes(b, max_frac):
    """Fill background-colored islands fully enclosed by the mask (white sleeves), up to a size cap."""
    h, w = b.shape
    inv = np.pad((b == 0).astype(np.uint8), 1, constant_values=1)
    ff = inv.copy()
    cv2.floodFill(ff, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 2)
    holes = (ff[1:-1, 1:-1] == 1).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(holes, connectivity=4)
    cap = max_frac * int(b.sum())
    out = b.copy()
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] <= cap:
            out[lab == i] = 1
    return out


def comps(b, min_frac):
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, connectivity=8)
    if n <= 1:
        return b
    big = st[1:, cv2.CC_STAT_AREA].max()
    keep = np.zeros_like(b)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= min_frac * big:
            keep[lab == i] = 1
    return keep


def soften(b, s):
    a = cv2.erode(b, ell(max(1, s / 4)))
    return cv2.GaussianBlur(a.astype(np.float32) * 255, (0, 0), 0.9 * s / 4).clip(0, 255).astype(np.uint8)


def decontaminate(rgb, b, s):
    core = cv2.erode(b, ell(2 * s / 4))
    band = cv2.dilate(b, ell(3 * s / 4)) & (1 - core)
    return cv2.inpaint(rgb, (band * 255).astype(np.uint8), 3, cv2.INPAINT_TELEA)


def find_sun(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    m = ((hsv[..., 0] >= 8) & (hsv[..., 0] <= 20) & (hsv[..., 1] > 140) & (hsv[..., 2] > 170)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return None
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    core = (lab == i).astype(np.uint8)
    # close the highlight spots inside the disc
    return fill_holes(cv2.morphologyEx(core, cv2.MORPH_CLOSE, ell(6)), 1.0)


def bbox(a):
    ys, xs = np.nonzero(a)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def to_rgba(rgb, a, box):
    x0, y0, x1, y1 = box
    im = np.dstack([rgb, a])[y0:y1, x0:x1]
    return Image.fromarray(im, "RGBA")


def wordmark(rgb):
    """Bbox of the navy 'hospeda' wordmark on the hoodie, or None."""
    H, W = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    m = ((hsv[..., 2] < 125) & (b > r + 12)).astype(np.uint8)
    win = np.zeros_like(m)
    win[int(.42 * H):int(.75 * H), int(.15 * W):int(.85 * W)] = 1
    m &= win
    d = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, W // 60), 3)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(d, connectivity=8)
    best = None
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w > 2.2 * h and w > W * 0.08 and (best is None or a > st[best][4]):
            best = i
    if best is None:
        return None
    x, y, w, h, _ = st[best]
    sub = m[y:y + h, x:x + w]
    x0, y0, x1, y1 = bbox(sub)
    return (x + x0, y + y0, x + x1, y + y1)


_REF = {}


def fix_logo(rgb, name):
    """Real-ESRGAN garbles the tiny wordmark ('hoopodo'); repaint the logo from the clean main pose."""
    if "rgb" not in _REF:
        ref = np.asarray(Image.open(UP / "main.png").convert("RGB"))
        wm = wordmark(ref)
        ww, wh = wm[2] - wm[0], wm[3] - wm[1]
        # the S mark sits above the wordmark; take everything from its top to the wordmark bottom
        x0, x1 = wm[0] - int(.12 * ww), wm[2] + int(.12 * ww)
        y0, y1 = wm[1] - int(0.74 * ww), wm[3] + int(.1 * wh)
        _REF.update(rgb=ref, wm=wm, box=(x0, y0, x1, y1))
    ref, wm, (bx0, by0, bx1, by1) = _REF["rgb"], _REF["wm"], _REF["box"]
    pw = wordmark(rgb)
    if pw is None:
        print("  logo: wordmark not found", name)
        return rgb
    sx = (pw[2] - pw[0]) / (wm[2] - wm[0])
    sy = (pw[3] - pw[1]) / (wm[3] - wm[1])
    if not 0.7 < sx / sy < 1.4:
        print("  logo: implausible scale", name, sx, sy)
        return rgb
    patch = ref[by0:by1, bx0:bx1]
    nw, nh = int(round(patch.shape[1] * sx)), int(round(patch.shape[0] * sy))
    patch = cv2.resize(patch, (nw, nh), interpolation=cv2.INTER_AREA)
    dx0 = int(round(pw[0] + (bx0 - wm[0]) * sx))
    dy0 = int(round(pw[1] + (by0 - wm[1]) * sy))
    H, W = rgb.shape[:2]
    out = rgb.copy()
    ys, xs = max(0, dy0), max(0, dx0)
    ye, xe = min(H, dy0 + nh), min(W, dx0 + nw)
    patch = patch[ys - dy0:ye - dy0, xs - dx0:xe - dx0]
    reg = out[ys:ye, xs:xe]
    hsv = cv2.cvtColor(reg, cv2.COLOR_RGB2HSV)
    junk = ((hsv[..., 1] > 50) | (hsv[..., 2] < 200)).astype(np.uint8)
    junk = cv2.dilate(junk, ell(3))
    reg = cv2.inpaint(reg, junk * 255, 4, cv2.INPAINT_TELEA)
    ph = cv2.cvtColor(patch, cv2.COLOR_RGB2HSV)
    lm = ((ph[..., 1] > 50) | (ph[..., 2] < 200)).astype(np.uint8)
    lm = cv2.GaussianBlur(cv2.dilate(lm, ell(1)).astype(np.float32), (0, 0), 1.0)[..., None]
    out[ys:ye, xs:xe] = (patch * lm + reg * (1 - lm)).astype(np.uint8)
    return out


def build(name, scale):
    rgb = np.asarray(Image.open(UP / f"{name}.png").convert("RGB"))
    if name != "main":
        rgb = fix_logo(rgb, name)
    s = scale
    model_a = np.asarray(Image.open(ALPHA / MODEL / f"{name}.png"))
    sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[..., 1].astype(np.int32)
    sat_a = np.clip((sat - 40) * 255 // 50, 0, 255).astype(np.uint8)
    b = (np.maximum(model_a, sat_a) > 128).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, ell(3 * s / 4))
    b = fill_holes(b, 0.05)
    b = comps(b, 0.004)

    sun_core = find_sun(rgb)
    sun_info = None
    sun_b = np.zeros_like(b)
    if sun_core is not None:
        region = cv2.dilate(sun_core, ell(4 * s / 4))
        sun_b = (b & region).astype(np.uint8)
        sun_b = np.maximum(sun_b, sun_core)
        b = (b & (1 - region)).astype(np.uint8)
        b = comps(b, 0.004)  # drop slivers the sun cut-out left behind

    # detached props (the lightbulb) become their own layer so they can float independently
    extras = []
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, connectivity=8)
    if n > 2:
        body = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        for i in range(1, n):
            if i != body:
                extras.append((lab == i).astype(np.uint8))
        b = (lab == body).astype(np.uint8)

    char_rgb = decontaminate(rgb, b, s)
    char_a = soften(b, s)
    sun_rgb = decontaminate(rgb, sun_b, s) if sun_core is not None else None
    sun_a = soften(sun_b, s) if sun_core is not None else None

    extra_layers = [(decontaminate(rgb, e, s), soften(e, s)) for e in extras]
    union = (char_a > 0) | ((sun_a > 0) if sun_a is not None else False)
    for _, ea in extra_layers:
        union |= ea > 0
    ub = bbox(union)
    box = (max(0, ub[0] - PAD), max(0, ub[1] - PAD), min(b.shape[1], ub[2] + PAD), min(b.shape[0], ub[3] + PAD))
    pose = to_rgba(char_rgb, char_a, box)
    pose.save(OUT / f"{name}.png")
    info = {"file": f"{name}.png", "width": pose.width, "height": pose.height}
    if sun_core is not None:
        sb = bbox(sun_a > 0)
        sb = (sb[0] - 1, sb[1] - 1, sb[2] + 1, sb[3] + 1)
        sun = to_rgba(sun_rgb, sun_a, sb)
        sun.save(OUT / f"{name}-sun.png")
        x, y = sb[0] - box[0], sb[1] - box[1]
        info["sun"] = {"file": f"{name}-sun.png", "x": x, "y": y, "width": sun.width, "height": sun.height,
                       "cx": x + sun.width / 2, "cy": y + sun.height / 2}
    for k, (er, ea) in enumerate(extra_layers):
        eb = bbox(ea > 0)
        eb = (eb[0] - 1, eb[1] - 1, eb[2] + 1, eb[3] + 1)
        im = to_rgba(er, ea, eb)
        fn = f"{name}-extra{k + 1}.png"
        im.save(OUT / fn)
        x, y = eb[0] - box[0], eb[1] - box[1]
        info.setdefault("extras", []).append({"file": fn, "x": x, "y": y, "width": im.width, "height": im.height,
                                               "cx": x + im.width / 2, "cy": y + im.height / 2})
    return pose, (Image.open(OUT / f"{name}-sun.png") if sun_core is not None else None), info, (rgb, box)


def composite(pose, sun, info, color):
    bg = Image.new("RGBA", pose.size, (*color, 255))
    bg.alpha_composite(pose)
    if sun is not None:
        bg.alpha_composite(sun, (info["sun"]["x"], info["sun"]["y"]))
    for e in info.get("extras", []):
        bg.alpha_composite(Image.open(OUT / e["file"]), (e["x"], e["y"]))
    return bg.convert("RGB")


def main():
    layers = json.loads((OUT / "layers.json").read_text()) if (OUT / "layers.json").exists() else {"poses": {}}
    sheets = []
    for name, _, _, scale in POSES:
        if ONLY and name not in ONLY:
            continue
        pose, sun, info, (rgb, box) = build(name, scale)
        if name == "main":
            info["eyes"] = eyes(Image.open(OUT / "main.png"), box, rgb, pose, sun, info)
        layers["poses"][name] = info
        for label, c in (("dark", (13, 43, 62)), ("white", (255, 255, 255))):
            composite(pose, sun, info, c).save(PREV / f"{name}-{label}.png")
        print(name, pose.size, info.get("sun"), flush=True)
    layers["model"] = MODEL
    (OUT / "layers.json").write_text(json.dumps(layers, indent=2))
    contact(layers)


def eyes(pose_img, box, rgb, pose, sun, info):
    a = np.asarray(pose)
    H, W = a.shape[:2]
    rg = a[..., :3]
    hsv = cv2.cvtColor(rg, cv2.COLOR_RGB2HSV)
    white = ((hsv[..., 1] < 55) & (hsv[..., 2] > 200) & (a[..., 3] > 200)).astype(np.uint8)
    win = np.zeros_like(white)
    # search window (fractions of the pose image): the eyes sit in the upper-middle of the head
    win[int(.22 * H):int(.40 * H), int(.25 * W):int(.75 * W)] = 1
    white &= win
    white = cv2.morphologyEx(white, cv2.MORPH_OPEN, ell(3))
    n, lab, st, cen = cv2.connectedComponentsWithStats(white, connectivity=8)
    ids = sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA])[:2]
    boxes = []
    for i in ids:
        m = fill_holes((lab == i).astype(np.uint8), 1.0)  # pupil + highlights are holes in the sclera
        # fill_holes caps by the mask's own area; the pupil is smaller than that
        x0, y0, x1, y1 = bbox(m)
        boxes.append((x0, y0, x1, y1))
    boxes.sort()
    res = {}
    blues = []
    for side, (x0, y0, x1, y1) in zip(("left", "right"), boxes):
        w, h = x1 - x0, y1 - y0
        res[side] = {"x": x0, "y": y0, "width": w, "height": h, "cx": x0 + w / 2, "cy": y0 + h / 2}
        band = rg[max(0, y0 - int(.35 * h)):max(1, y0 - int(.12 * h)), x0 + int(.2 * w):x1 - int(.2 * w)].reshape(-1, 3)
        hs = cv2.cvtColor(band.reshape(1, -1, 3), cv2.COLOR_RGB2HSV)[0]
        sel = band[(hs[:, 1] > 120) & (hs[:, 2] > 150)]
        blues.append(np.median(sel if len(sel) else band, axis=0))
    c = np.mean(blues, axis=0).round().astype(int)
    res["headColor"] = "#%02x%02x%02x" % tuple(c)
    res["headColorRGB"] = [int(v) for v in c]
    # preview: closed lids
    im = composite(pose, sun, info, (13, 43, 62)).convert("RGBA")
    ov = np.array(im)
    for side in ("left", "right"):
        e = res[side]
        cv2.ellipse(ov, (int(e["cx"]), int(e["cy"])), (int(e["width"] / 2 * 1.12), int(e["height"] / 2 * 1.12)), 0, 0, 360, (*c.tolist(), 255), -1, cv2.LINE_AA)
    Image.fromarray(ov).convert("RGB").save(PREV / "main-blink.png")
    return res


def contact(layers):
    names = [n for n, *_ in POSES if n in layers["poses"]]
    th = 420
    for label in ("dark", "white"):
        ims = []
        for n in names:
            im = Image.open(PREV / f"{n}-{label}.png")
            ims.append(im.resize((int(im.width * th / im.height), th), Image.LANCZOS))
        cols = 6
        rows = (len(ims) + cols - 1) // cols
        cw = max(i.width for i in ims) + 20
        sheet = Image.new("RGB", (cw * cols, (th + 20) * rows), (13, 43, 62) if label == "dark" else (255, 255, 255))
        for k, im in enumerate(ims):
            sheet.paste(im, ((k % cols) * cw + 10, (k // cols) * (th + 20) + 10))
        sheet.save(PREV / f"_contact-{label}.png")


main()

import { Resvg } from '@resvg/resvg-js';
import type { PNG } from 'pngjs';
import {
    HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE,
    HOSPEDA_ISOTIPO_MARKUP,
    HOSPEDA_ISOTIPO_VIEWBOX,
    HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE
} from './qr-hospeda-isotipo';

/**
 * The centre mark: its geometry, and the two ways of painting it (HOS-981 PR 5,
 * real artwork since HOS-2672, round since the same issue).
 *
 * ## Why this is one module and not two halves of the renderer
 *
 * The mark has to land in the SAME PLACE at the SAME SIZE in the SVG and in the
 * PNG, and nothing about those two code paths makes that automatic: one writes
 * markup in module units, the other writes RGBA bytes in pixels. A disc drawn a
 * fraction of a module off in one of them covers a different set of modules, so
 * the two formats of the SAME configured code have different damage and one of
 * them can fail to scan while the other passes every test. So the geometry is
 * computed ONCE, here, in modules (`computeCenterLogoDisc`,
 * `computeIsotipoBox`), and both painters are thin conversions of it.
 *
 * ## What is drawn
 *
 * A DISC in the QR's background colour, centred on the symbol, with the Hospeda
 * isotipo (blue, green, teal, orange: the brand's own colours, never the QR's
 * foreground) painted inside it.
 *
 * - SVG: a `<circle>`, then the isotipo markup nested in an inner `<svg>`.
 * - PNG: the disc is filled with a one-pixel anti-aliased edge, then the SAME
 *   markup is rasterised with `@resvg/resvg-js` and alpha-composited over it.
 *
 * ## How big: a ratio per correction level, and not a number of modules
 *
 * The disc's diameter is `diameterRatio x moduleCount`, NOT snapped to whole
 * modules (a disc has no reason to sit on the module grid), and the ratio comes
 * from `QR_CODE_CENTER_LOGO_DIAMETER_RATIO` in `@repo/schemas`, one value per
 * level. Because the diameter scales with the symbol, the disc's AREA is the
 * same fraction of the symbol at every QR version, which is what lets the gate
 * be evaluated without knowing which version a URL will produce.
 *
 * ## "Coverage" is counted in modules, the conservative way
 *
 * A module the disc only grazes is still lost to the decoder: its colour is no
 * longer reliable. `centerLogoCoverage` therefore counts every module whose
 * square INTERSECTS the disc, which is always at least the disc's own area, and
 * the sweep that measured the ceilings (`scripts/qr-center-logo-sweep.ts`)
 * reports that same quantity next to the plain disc area.
 *
 * ## The artwork stays inside the disc, by construction and by test
 *
 * The isotipo is not round and not centred in its own box (the sun hangs off a
 * corner), so it is placed by its smallest ENCLOSING CIRCLE
 * (`HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE`), concentric with the disc, at
 * `HOSPEDA_ISOTIPO_RADIUS_SHARE` of the disc's radius. Every painted pixel of
 * the artwork is therefore inside the disc with a margin. The tests re-rasterise
 * the artwork to check the circle, and check the output of both painters.
 *
 * Changing the artwork never affects codes already issued: the logo is not
 * encoded data (it is not in the URL) and every image is rendered per download.
 * That holds ONLY while the artwork stays inside the disc, and the disc stays
 * within what the gate budgeted.
 *
 * @module utils/qr-center-logo
 */

/**
 * Radius of the isotipo's enclosing circle as a share of the disc's radius.
 *
 * The remaining tenth is the inset: a mark flush to the edge of its disc reads
 * as a smear against the surrounding modules rather than as a logo.
 */
export const HOSPEDA_ISOTIPO_RADIUS_SHARE = 0.9;

/** The disc, in modules, relative to the symbol's top-left corner. */
export type CenterLogoDisc = {
    /** Modules from the symbol's edge to the disc's centre, on both axes. */
    readonly center: number;
    /** Radius of the disc, in modules. */
    readonly radius: number;
};

/** The isotipo's nested `<svg>` box, in modules, relative to the symbol's corner. */
export type CenterLogoBox = {
    readonly x: number;
    readonly y: number;
    readonly size: number;
};

/** Smallest disc worth drawing, in modules across. Below this the mark is a smudge. */
const MIN_DISC_MODULES = 3;

/**
 * Where the disc sits, in modules.
 *
 * Centred on the symbol's centre, which is the centre of the middle module
 * because every QR symbol has an odd side.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules, quiet zone excluded.
 * @param input.diameterRatio - Disc diameter as a fraction of the symbol's side.
 * @returns The disc, or `null` when the symbol is too small to carry one (or the
 *   ratio would swallow the whole symbol).
 */
export function computeCenterLogoDisc(input: {
    moduleCount: number;
    diameterRatio: number;
}): CenterLogoDisc | null {
    const diameter = input.moduleCount * input.diameterRatio;

    if (diameter < MIN_DISC_MODULES) return null;
    if (diameter >= input.moduleCount) return null;

    return { center: input.moduleCount / 2, radius: diameter / 2 };
}

/**
 * Fraction of the symbol's modules whose square INTERSECTS the disc.
 *
 * The conservative reading of "how much did the mark damage": a grazed module
 * is lost too. A square intersects the disc when its nearest point to the
 * centre is strictly closer than the radius.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.diameterRatio - Disc diameter as a fraction of the symbol's side.
 * @returns `0` when no disc is drawn, otherwise a fraction in `(0, 1)`.
 */
export function centerLogoCoverage(input: { moduleCount: number; diameterRatio: number }): number {
    const disc = computeCenterLogoDisc(input);
    if (!disc) return 0;

    let touched = 0;
    for (let row = 0; row < input.moduleCount; row += 1) {
        const dy = Math.max(0, Math.abs(row + 0.5 - disc.center) - 0.5);
        for (let col = 0; col < input.moduleCount; col += 1) {
            const dx = Math.max(0, Math.abs(col + 0.5 - disc.center) - 0.5);
            if (Math.hypot(dx, dy) < disc.radius) touched += 1;
        }
    }

    return touched / (input.moduleCount * input.moduleCount);
}

/**
 * Fraction of the symbol's AREA the disc itself covers (`pi r^2 / n^2`).
 *
 * The idealised twin of {@link centerLogoCoverage}: it depends on the ratio
 * alone, so it is the same at every QR version.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.diameterRatio - Disc diameter as a fraction of the symbol's side.
 * @returns `0` when no disc is drawn, otherwise a fraction in `(0, 1)`.
 */
export function centerLogoAreaCoverage(input: {
    moduleCount: number;
    diameterRatio: number;
}): number {
    const disc = computeCenterLogoDisc(input);
    if (!disc) return 0;

    return (Math.PI * disc.radius ** 2) / (input.moduleCount * input.moduleCount);
}

/**
 * The isotipo's nested `<svg>` box, in modules, so that its enclosing circle is
 * concentric with the disc and `HOSPEDA_ISOTIPO_RADIUS_SHARE` as large.
 *
 * Relative to the symbol's corner (add the quiet zone for SVG user space).
 *
 * @param input - Options object (RO-RO).
 * @param input.disc - The disc the artwork must sit inside.
 * @returns The box's top-left corner and side, in modules.
 */
export function computeIsotipoBox(input: { disc: CenterLogoDisc }): CenterLogoBox {
    const { disc } = input;
    const scale =
        (HOSPEDA_ISOTIPO_RADIUS_SHARE * disc.radius) / HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.radius;

    return {
        x:
            disc.center -
            (HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.cx - HOSPEDA_ISOTIPO_VIEWBOX.minX) * scale,
        y:
            disc.center -
            (HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.cy - HOSPEDA_ISOTIPO_VIEWBOX.minY) * scale,
        size: HOSPEDA_ISOTIPO_VIEWBOX.width * scale
    };
}

/**
 * The markup that paints the mark: the disc, then the isotipo nested on it.
 *
 * Returns markup to splice in before `</svg>`, or an empty string when the
 * symbol cannot carry a disc. Coordinates include the quiet zone offset,
 * because that is what the `qrcode` library's `viewBox` uses.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.margin - Quiet zone, in modules.
 * @param input.backgroundColor - Colour of the disc behind the isotipo.
 * @param input.diameterRatio - Disc diameter as a fraction of the symbol's side.
 * @returns SVG markup, or `''`.
 */
export function renderCenterLogoSvgFragment(input: {
    moduleCount: number;
    margin: number;
    backgroundColor: string;
    diameterRatio: number;
}): string {
    const disc = computeCenterLogoDisc({
        moduleCount: input.moduleCount,
        diameterRatio: input.diameterRatio
    });
    if (!disc) return '';

    const box = computeIsotipoBox({ disc });

    // Six decimals, fixed: the geometry multiplies a module count by ratios, so
    // an unrounded value would print a different number of digits per symbol
    // size and break the byte-determinism the engine promises.
    const round = (value: number): string => Number(value.toFixed(6)).toString();

    // Six-digit hex plus `fill-opacity`, the way `qrcode` writes its own colours:
    // an eight-digit `#rrggbbaa` is CSS Color 4, which not every SVG consumer
    // (older rasterisers, some PDF converters) understands.
    const [red, green, blue, alpha] = parseHexColor({ hex: input.backgroundColor });
    const hex = (value: number): string => value.toString(16).padStart(2, '0');
    const fill = `#${hex(red)}${hex(green)}${hex(blue)}`;
    const fillOpacity = alpha < 255 ? ` fill-opacity="${round(alpha / 255)}"` : '';

    // `qrcode` stamps `shape-rendering="crispEdges"` on the root `<svg>`, which
    // is right for square modules and wrong for curves: inherited, it turns the
    // disc and the isotipo into jagged staircases. Both opt back out.
    const smooth = 'shape-rendering="geometricPrecision"';

    return (
        `<circle cx="${round(disc.center + input.margin)}" cy="${round(disc.center + input.margin)}" ` +
        `r="${round(disc.radius)}" fill="${fill}"${fillOpacity} ${smooth}/>` +
        `<svg x="${round(box.x + input.margin)}" y="${round(box.y + input.margin)}" ` +
        `width="${round(box.size)}" height="${round(box.size)}" ` +
        `viewBox="${HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE}" ${smooth}>${HOSPEDA_ISOTIPO_MARKUP}</svg>`
    );
}

/**
 * `#rgb`, `#rrggbb` and `#rrggbbaa` to RGBA bytes.
 *
 * @param input - Options object (RO-RO).
 * @param input.hex - The colour, with or without the leading `#`.
 * @returns Red, green, blue and alpha, each `0..255`.
 */
function parseHexColor(input: { hex: string }): readonly [number, number, number, number] {
    const { hex } = input;
    const value = hex.startsWith('#') ? hex.slice(1) : hex;

    if (value.length === 3) {
        const [r, g, b] = [...value].map((char) => Number.parseInt(char + char, 16));
        return [r as number, g as number, b as number, 255];
    }

    const byte = (index: number): number => Number.parseInt(value.slice(index, index + 2), 16);
    return [byte(0), byte(2), byte(4), value.length === 8 ? byte(6) : 255];
}

/**
 * Writes one pixel back as STRAIGHT RGBA from premultiplied colour.
 *
 * @param input - Options object (RO-RO).
 * @param input.data - The PNG's RGBA bytes. Mutated.
 * @param input.index - Byte offset of the pixel's red channel.
 * @param input.premultiplied - Red, green and blue already multiplied by alpha, on a `0..255` scale.
 * @param input.alpha - The pixel's alpha, `0..1`.
 */
function writeUnpremultiplied(input: {
    data: Buffer;
    index: number;
    premultiplied: readonly [number, number, number];
    alpha: number;
}): void {
    const { data, index, premultiplied, alpha } = input;

    for (let channel = 0; channel < 3; channel += 1) {
        const straight = alpha > 0 ? (premultiplied[channel] as number) / alpha : 0;
        data[index + channel] = Math.min(255, Math.max(0, Math.round(straight)));
    }
    data[index + 3] = Math.min(255, Math.max(0, Math.round(alpha * 255)));
}

/**
 * Rasterises the isotipo to a square of `pixels` x `pixels`.
 *
 * `resvg` returns PREMULTIPLIED RGBA (measured: a 50% red pixel comes back as
 * `128, 0, 0, 128`, not `255, 0, 0, 128`), which is what the compositing step
 * below expects. System fonts are off: the artwork has no text, and scanning the
 * host's font directories is wasted work on every render.
 */
function rasterizeIsotipo(input: { pixels: number }): Buffer {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${input.pixels}" ` +
        `height="${input.pixels}" viewBox="${HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE}">` +
        `${HOSPEDA_ISOTIPO_MARKUP}</svg>`;

    return new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
}

/**
 * Paints the mark onto a decoded PNG, in place.
 *
 * Pixel coordinates come from the PNG's OWN width rather than from an assumed
 * scale: `qrcode` honours a requested `width` exactly, so the modules-to-pixels
 * factor is routinely fractional (512 px over a 37-module symbol with a
 * 4-module quiet zone is 13.837...). Deriving it from the buffer is the only way
 * the disc lands where the geometry says it does.
 *
 * Two steps, both alpha-correct for a translucent background. The disc replaces
 * what is under it, blended by the pixel's coverage so the edge is anti-aliased
 * (a pixel centre closer than `radius - 0.5` is fully covered, farther than
 * `radius + 0.5` untouched). Then the isotipo is rasterised at its box's pixel
 * size and composited over it with the full "over" operator, skipping any pixel
 * outside the disc.
 *
 * @param input - Options object (RO-RO).
 * @param input.png - The decoded PNG. Mutated.
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.margin - Quiet zone, in modules.
 * @param input.backgroundColor - Colour of the disc behind the isotipo.
 * @param input.diameterRatio - Disc diameter as a fraction of the symbol's side.
 * @returns Nothing; the buffer is written in place.
 */
export function paintCenterLogoOnPng(input: {
    png: PNG;
    moduleCount: number;
    margin: number;
    backgroundColor: string;
    diameterRatio: number;
}): void {
    const disc = computeCenterLogoDisc({
        moduleCount: input.moduleCount,
        diameterRatio: input.diameterRatio
    });
    if (!disc) return;

    const { png } = input;
    const scale = png.width / (input.moduleCount + 2 * input.margin);
    const centerPx = (disc.center + input.margin) * scale;
    const radiusPx = disc.radius * scale;
    const background = parseHexColor({ hex: input.backgroundColor });
    const backgroundAlpha = (background[3] as number) / 255;

    const x0 = Math.max(0, Math.floor(centerPx - radiusPx - 1));
    const y0 = Math.max(0, Math.floor(centerPx - radiusPx - 1));
    const x1 = Math.min(png.width, Math.ceil(centerPx + radiusPx + 1));
    const y1 = Math.min(png.height, Math.ceil(centerPx + radiusPx + 1));

    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
            const distance = Math.hypot(x + 0.5 - centerPx, y + 0.5 - centerPx);
            const coverage = Math.min(1, Math.max(0, radiusPx - distance + 0.5));
            if (coverage === 0) continue;

            // The disc REPLACES what is under it (that is the damage the gate
            // budgets for), so the rim is a blend of the old pixel and the disc
            // colour, done in PREMULTIPLIED space: lerping straight channels
            // on a translucent background (`#rrggbbaa`) drags colour towards
            // black at the edge.
            const index = (png.width * y + x) << 2;
            const dstAlpha = (png.data[index + 3] as number) / 255;
            const outAlpha = dstAlpha * (1 - coverage) + backgroundAlpha * coverage;
            const premultiplied = [0, 1, 2].map(
                (channel) =>
                    (png.data[index + channel] as number) * dstAlpha * (1 - coverage) +
                    (background[channel] as number) * backgroundAlpha * coverage
            );
            writeUnpremultiplied({
                data: png.data,
                index,
                premultiplied: [
                    premultiplied[0] as number,
                    premultiplied[1] as number,
                    premultiplied[2] as number
                ],
                alpha: outAlpha
            });
        }
    }

    const box = computeIsotipoBox({ disc });
    const boxPixels = Math.max(1, Math.round(box.size * scale));
    const boxLeft = Math.round((box.x + input.margin) * scale);
    const boxTop = Math.round((box.y + input.margin) * scale);
    const logo = rasterizeIsotipo({ pixels: boxPixels });

    for (let row = 0; row < boxPixels; row += 1) {
        for (let col = 0; col < boxPixels; col += 1) {
            const x = boxLeft + col;
            const y = boxTop + row;
            if (x < 0 || x >= png.width || y < 0 || y >= png.height) continue;
            // Never paint a pixel the disc did not blank. The artwork sits well
            // inside by construction; this is the defence in depth.
            if (Math.hypot(x + 0.5 - centerPx, y + 0.5 - centerPx) > radiusPx) continue;

            const source = (boxPixels * row + col) << 2;
            const alpha = (logo[source + 3] as number) / 255;
            if (alpha === 0) continue;

            // Full "over": premultiplied source onto a STRAIGHT-alpha
            // destination. outA = a + dA(1 - a); rgb = (src_p + d.rgb dA (1 - a)) / outA.
            const target = (png.width * y + x) << 2;
            const dstAlpha = (png.data[target + 3] as number) / 255;
            const keep = dstAlpha * (1 - alpha);
            writeUnpremultiplied({
                data: png.data,
                index: target,
                premultiplied: [
                    (logo[source] as number) + (png.data[target] as number) * keep,
                    (logo[source + 1] as number) + (png.data[target + 1] as number) * keep,
                    (logo[source + 2] as number) + (png.data[target + 2] as number) * keep
                ],
                alpha: alpha + keep
            });
        }
    }
}

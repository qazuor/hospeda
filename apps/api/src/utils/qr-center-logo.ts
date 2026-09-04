import { QR_CODE_CENTER_LOGO_SIZE_RATIO } from '@repo/schemas';
import type { PNG } from 'pngjs';

/**
 * The centre mark: its geometry, and the two ways of painting it (HOS-981 PR 5).
 *
 * ## Why this is one module and not two halves of the renderer
 *
 * The mark has to land in the SAME PLACE at the SAME SIZE in the SVG and in the
 * PNG, and nothing about those two code paths makes that automatic — one writes
 * markup in module units, the other writes RGBA bytes in pixels. A logo that is
 * drawn a module to the left in one of them is not a cosmetic difference: it
 * covers a different set of modules, so the two formats of the SAME configured
 * code have different damage and one of them can fail to scan while the other
 * passes every test. So the geometry is computed ONCE, here, in modules, and
 * both painters are thin conversions of it.
 *
 * ## Why the mark is rectangles
 *
 * Because a rectangle is the one shape both painters can render EXACTLY. An SVG
 * `<rect>` and a filled pixel span describe the same area with no rasteriser,
 * no anti-aliasing model and no font — three things that would each be a place
 * for the two outputs to disagree by a sub-module amount that no test would
 * catch until a printed code failed.
 *
 * ## The mark is a placeholder, and says so
 *
 * `HOSPEDA_MARK` below is an `H` built from three bars. The repository holds no
 * vector brand asset — `apps/web/src/assets/images/logo.webp` is a raster and
 * `apps/admin/src/logo.svg` is the React atom left over from a template — so
 * there was nothing to embed. Replacing this constant with the real mark, once
 * one exists as rectangles or as a path pair, is the whole of that change:
 * every consumer reads it from here, and the coverage the gate depends on is a
 * property of the PLATE, not of what is drawn inside it.
 *
 * @module utils/qr-center-logo
 */

/** A rectangle in the mark's own unit box: `0..1` across the plate, both axes. */
export type UnitRect = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};

/**
 * The Hospeda mark: an `H`, as three bars.
 *
 * Inset from the plate edges on every side, so the mark never touches the
 * modules the plate did not blank — a mark flush to its plate reads as a smear
 * against the surrounding code rather than as a logo.
 */
export const HOSPEDA_MARK: readonly UnitRect[] = [
    { x: 0.18, y: 0.12, width: 0.18, height: 0.76 },
    { x: 0.64, y: 0.12, width: 0.18, height: 0.76 },
    { x: 0.36, y: 0.41, width: 0.28, height: 0.18 }
] as const;

/** The plate, in modules, relative to the symbol's top-left corner. */
export type CenterLogoPlate = {
    /** Modules from the symbol's edge to the plate's edge, on both axes. */
    readonly offset: number;
    /** Side of the plate, in whole modules. Always odd. */
    readonly side: number;
};

/** Smallest plate worth drawing. Below this the mark is a smudge, not a logo. */
const MIN_PLATE_MODULES = 3;

/**
 * The largest odd whole number of modules not exceeding `value`.
 *
 * ODD because every QR symbol has an odd side, so only an odd plate centres on
 * whole modules — an even one would sit half a module off and blank a ragged
 * extra row. DOWN, never to the nearest, because rounding up would let the
 * covered area exceed `ratio²` on small symbols (a 21-module symbol at ratio
 * 0.2 wants 4.2 modules; rounding to 5 covers 5.7% instead of 4%), and that
 * bound is precisely what lets `qrCodeCenterLogoFits` decide the gate without
 * knowing which QR version a given URL will produce.
 */
function floorToOdd(value: number): number {
    const floored = Math.floor(value);
    return floored % 2 === 0 ? floored - 1 : floored;
}

/**
 * Where the plate sits, in modules.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules, quiet zone excluded.
 * @param input.sizeRatio - Plate side as a fraction of the symbol's side.
 * @returns The plate, or `null` when the symbol is too small to carry one.
 */
export function computeCenterLogoPlate(input: {
    moduleCount: number;
    sizeRatio?: number;
}): CenterLogoPlate | null {
    const sizeRatio = input.sizeRatio ?? QR_CODE_CENTER_LOGO_SIZE_RATIO;
    const side = floorToOdd(input.moduleCount * sizeRatio);

    if (side < MIN_PLATE_MODULES) return null;
    if (side >= input.moduleCount) return null;

    return { offset: (input.moduleCount - side) / 2, side };
}

/** Fraction of the symbol's modules a plate covers. */
export function centerLogoCoverage(input: { moduleCount: number; sizeRatio?: number }): number {
    const plate = computeCenterLogoPlate(input);
    if (!plate) return 0;

    return (plate.side * plate.side) / (input.moduleCount * input.moduleCount);
}

/**
 * The `<rect>` elements that paint the mark, in the SVG's own module units.
 *
 * Returns markup to splice in before `</svg>`, or an empty string when the
 * symbol cannot carry a plate. Coordinates include the quiet zone offset,
 * because that is what the `qrcode` library's `viewBox` uses.
 *
 * @param input - Options object (RO-RO).
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.margin - Quiet zone, in modules.
 * @param input.foregroundColor - Colour of the mark itself.
 * @param input.backgroundColor - Colour of the plate behind it.
 * @param input.sizeRatio - Plate side as a fraction of the symbol's side.
 * @returns SVG markup, or `''`.
 */
export function renderCenterLogoSvgFragment(input: {
    moduleCount: number;
    margin: number;
    foregroundColor: string;
    backgroundColor: string;
    sizeRatio?: number;
}): string {
    const plate = computeCenterLogoPlate({
        moduleCount: input.moduleCount,
        sizeRatio: input.sizeRatio
    });
    if (!plate) return '';

    const x = plate.offset + input.margin;
    const y = plate.offset + input.margin;

    // Six decimals, fixed: the mark's unit rectangles are fractions of a module
    // count, so an unrounded value would print a different number of digits per
    // symbol size and break the byte-determinism the engine promises.
    const round = (value: number): string => Number(value.toFixed(6)).toString();

    const bars = HOSPEDA_MARK.map(
        (rect) =>
            `<rect x="${round(x + rect.x * plate.side)}" y="${round(y + rect.y * plate.side)}" ` +
            `width="${round(rect.width * plate.side)}" height="${round(rect.height * plate.side)}" ` +
            `fill="${input.foregroundColor}"/>`
    ).join('');

    return (
        `<rect x="${round(x)}" y="${round(y)}" width="${plate.side}" height="${plate.side}" ` +
        `fill="${input.backgroundColor}"/>${bars}`
    );
}

/** `#rgb`, `#rrggbb` and `#rrggbbaa` to RGBA bytes. */
function parseHexColor(hex: string): readonly [number, number, number, number] {
    const value = hex.startsWith('#') ? hex.slice(1) : hex;

    if (value.length === 3) {
        const [r, g, b] = [...value].map((char) => Number.parseInt(char + char, 16));
        return [r as number, g as number, b as number, 255];
    }

    const byte = (index: number): number => Number.parseInt(value.slice(index, index + 2), 16);
    return [byte(0), byte(2), byte(4), value.length === 8 ? byte(6) : 255];
}

/**
 * Paints the mark onto a decoded PNG, in place.
 *
 * Pixel coordinates come from the PNG's OWN width rather than from an assumed
 * scale: `qrcode` honours a requested `width` exactly, so the modules-to-pixels
 * factor is routinely fractional (512 px over a 37-module symbol with a
 * 4-module quiet zone is 13.837…). Deriving it from the buffer is the only way
 * the plate lands on the modules the geometry says it covers — verified against
 * the finder pattern.
 *
 * @param input - Options object (RO-RO).
 * @param input.png - The decoded PNG. Mutated.
 * @param input.moduleCount - Side of the symbol, in modules.
 * @param input.margin - Quiet zone, in modules.
 * @param input.foregroundColor - Colour of the mark itself.
 * @param input.backgroundColor - Colour of the plate behind it.
 * @param input.sizeRatio - Plate side as a fraction of the symbol's side.
 * @returns Nothing; the buffer is written in place.
 */
export function paintCenterLogoOnPng(input: {
    png: PNG;
    moduleCount: number;
    margin: number;
    foregroundColor: string;
    backgroundColor: string;
    sizeRatio?: number;
}): void {
    const plate = computeCenterLogoPlate({
        moduleCount: input.moduleCount,
        sizeRatio: input.sizeRatio
    });
    if (!plate) return;

    const { png } = input;
    const scale = png.width / (input.moduleCount + 2 * input.margin);
    const originX = (plate.offset + input.margin) * scale;
    const originY = (plate.offset + input.margin) * scale;
    const plateSize = plate.side * scale;

    const fill = (
        left: number,
        top: number,
        right: number,
        bottom: number,
        color: readonly [number, number, number, number]
    ): void => {
        const x0 = Math.max(0, Math.round(left));
        const y0 = Math.max(0, Math.round(top));
        const x1 = Math.min(png.width, Math.round(right));
        const y1 = Math.min(png.height, Math.round(bottom));

        for (let y = y0; y < y1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
                const index = (png.width * y + x) << 2;
                png.data[index] = color[0];
                png.data[index + 1] = color[1];
                png.data[index + 2] = color[2];
                png.data[index + 3] = color[3];
            }
        }
    };

    fill(
        originX,
        originY,
        originX + plateSize,
        originY + plateSize,
        parseHexColor(input.backgroundColor)
    );

    const markColor = parseHexColor(input.foregroundColor);
    for (const rect of HOSPEDA_MARK) {
        fill(
            originX + rect.x * plateSize,
            originY + rect.y * plateSize,
            originX + (rect.x + rect.width) * plateSize,
            originY + (rect.y + rect.height) * plateSize,
            markColor
        );
    }
}

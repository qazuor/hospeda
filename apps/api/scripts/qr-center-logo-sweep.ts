/**
 * @file qr-center-logo-sweep.ts
 * @description Re-measures how large the QR centre disc can be per
 * error-correction level before codes stop decoding (HOS-2672).
 *
 * WHEN TO RE-RUN. Whenever the mark changes in a way that can alter damage: the
 * artwork, its placement inside the disc, the disc geometry, or the way the PNG
 * is composited. The ceilings in `@repo/schemas`
 * (`QR_CODE_ERROR_CORRECTION_DECODE_CEILING`) and the per-level ratios derived
 * from them are only as good as the last run of this script.
 *
 * METHOD (the one `QR_CODE_ERROR_CORRECTION_DECODE_CEILING` documents):
 * - TEN URLs of the real shape (`/q/<slug>` and `/qr/<slug>/`, two hosts,
 *   slug lengths from 4 to the 64-character maximum, so the largest symbols the
 *   product can emit are included), each rendered at 256, 384, 512, 768 and 1024 px,
 *   so 50 renders per step.
 * - The disc diameter is swept in steps of 0.01 of the symbol's side, painted
 *   exactly as the renderer paints it (`paintCenterLogoOnPng`, real isotipo
 *   inside), and every result is fed to a real decoder (`jsqr`).
 * - Per level the sweep reports, for each step, the disc's AREA fraction, the
 *   mean fraction of MODULES whose square intersects the disc (the quantity the
 *   renderer's `centerLogoCoverage` counts, and the conservative one), and how
 *   many of the corpus renders decoded.
 * - The CEILING is the last step before the first step at which any render
 *   failed: "the last step nothing failed at", not a cliff edge. The sweep keeps
 *   going past it to show the degradation band, and stops after two consecutive
 *   steps at 0/35.
 * - The CEILING RATIO is that last clean step's diameter ratio; the mean
 *   INTERSECTING-MODULE fraction at it, floored to three decimals, is the
 *   informational figure the schema records. The safe ratio is the largest ratio,
 *   on a 0.005 grid, such that on EVERY corpus symbol individually the disc
 *   touches at most `QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE` of the modules the
 *   ceiling disc touched on that same symbol (not on average), rounded DOWN.
 *
 * Run: `pnpm --filter hospeda-api exec tsx scripts/qr-center-logo-sweep.ts`
 * (a few minutes; add `--quick` for one URL and two sizes while iterating).
 *
 * @module scripts/qr-center-logo-sweep
 */

import {
    QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE,
    QrCodeErrorCorrectionLevelEnum
} from '@repo/schemas';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
    centerLogoAreaCoverage,
    centerLogoCoverage,
    paintCenterLogoOnPng
} from '../src/utils/qr-center-logo';
import { renderQrMatrix, renderQrPng } from '../src/utils/qr-render';
import { largestRatioWithin, SWEEP_SIZES, SWEEP_URLS } from './qr-center-logo-sweep-corpus';

const MARGIN = 4;
const RATIO_STEP = 0.01;
const RATIO_START = 0.06;
const RATIO_END = 0.55;

const LEVELS = [
    QrCodeErrorCorrectionLevelEnum.L,
    QrCodeErrorCorrectionLevelEnum.M,
    QrCodeErrorCorrectionLevelEnum.Q,
    QrCodeErrorCorrectionLevelEnum.H
] as const;

type Base = { readonly width: number; readonly height: number; readonly data: Buffer };

type StepResult = {
    readonly ratio: number;
    readonly areaPercent: number;
    readonly touchedPercent: number;
    readonly passed: number;
    readonly total: number;
};

function decodes(input: { png: PNG; expected: string }): boolean {
    const { png } = input;
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    return result?.data === input.expected;
}

async function sweepLevel(input: {
    level: QrCodeErrorCorrectionLevelEnum;
    urls: readonly string[];
    sizes: readonly number[];
}): Promise<readonly StepResult[]> {
    const bases: { url: string; moduleCount: number; base: Base }[] = [];
    for (const url of input.urls) {
        const moduleCount = renderQrMatrix({
            data: url,
            errorCorrectionLevel: input.level
        }).size;
        for (const size of input.sizes) {
            const buffer = await renderQrPng({
                data: url,
                options: { errorCorrectionLevel: input.level, margin: MARGIN, size }
            });
            const png = PNG.sync.read(buffer);
            bases.push({
                url,
                moduleCount,
                base: { width: png.width, height: png.height, data: png.data }
            });
        }
    }

    const results: StepResult[] = [];
    let emptySteps = 0;

    for (let ratio = RATIO_START; ratio <= RATIO_END + 1e-9; ratio += RATIO_STEP) {
        const rounded = Number(ratio.toFixed(3));
        let passed = 0;
        let touched = 0;
        let area = 0;

        for (const { url, moduleCount, base } of bases) {
            const png = new PNG({ width: base.width, height: base.height });
            base.data.copy(png.data);
            paintCenterLogoOnPng({
                png,
                moduleCount,
                margin: MARGIN,
                backgroundColor: '#ffffff',
                diameterRatio: rounded
            });
            if (decodes({ png, expected: url })) passed += 1;
            touched += centerLogoCoverage({ moduleCount, diameterRatio: rounded });
            area += centerLogoAreaCoverage({ moduleCount, diameterRatio: rounded });
        }

        results.push({
            ratio: rounded,
            areaPercent: (area / bases.length) * 100,
            touchedPercent: (touched / bases.length) * 100,
            passed,
            total: bases.length
        });

        emptySteps = passed === 0 ? emptySteps + 1 : 0;
        if (emptySteps >= 2) break;
    }

    return results;
}

async function main(): Promise<void> {
    const quick = process.argv.includes('--quick');
    const urls = quick ? SWEEP_URLS.slice(0, 1) : SWEEP_URLS;
    const sizes = quick ? [256, 1024] : SWEEP_SIZES;
    const out = (line: string): void => {
        process.stdout.write(`${line}\n`);
    };

    out(`# QR centre disc sweep, ${urls.length} URLs x ${sizes.length} sizes, margin ${MARGIN}`);
    out(`# budget share ${QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE}`);

    for (const level of LEVELS) {
        const steps = await sweepLevel({ level, urls, sizes });
        out(`\n## ${level}   (ratio = disc diameter / symbol side)`);
        out('ratio  area%   touched%  decoded');

        let ceiling: StepResult | null = null;
        let broken = false;
        for (const step of steps) {
            const flag =
                step.passed === step.total ? '' : step.passed === 0 ? '  <- none' : '  <- partial';
            out(
                `${step.ratio.toFixed(2)}   ${step.areaPercent.toFixed(2).padStart(5)}  ` +
                    `${step.touchedPercent.toFixed(2).padStart(7)}   ${step.passed}/${step.total}${flag}`
            );
            if (step.passed !== step.total) broken = true;
            if (!broken) ceiling = step;
        }

        if (!ceiling) {
            out(`CEILING ${level}: none (the smallest step already failed)`);
            continue;
        }

        const storedCeiling = Math.floor(ceiling.touchedPercent * 10) / 1000;
        const safe = largestRatioWithin({
            level,
            ceilingRatio: ceiling.ratio,
            share: QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE
        });
        out(
            `CEILING ${level}: ratio ${ceiling.ratio.toFixed(2)}  area ${(ceiling.areaPercent / 100).toFixed(4)}  ` +
                `touched ${storedCeiling.toFixed(3)}  ->  SAFE RATIO ${safe.toFixed(3)}`
        );
    }
}

await main();

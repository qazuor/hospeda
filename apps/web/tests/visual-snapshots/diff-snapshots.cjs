#!/usr/bin/env node
/**
 * @file diff-snapshots.cjs
 * @description SPEC-153 T-153-23 — Pixel-diff gate for the web design-token
 * migration. Compares the pre-migration `baseline/` snapshot tree (captured
 * in Phase 0, T-153-03) against the post-migration `actual/` tree (captured
 * in Phase 2, T-153-22) and fails if any pair exceeds the per-snapshot
 * threshold.
 *
 * This is a file-vs-file diff (not a re-render) so it is fully deterministic:
 * the same two PNG sets always produce the same result, immune to the
 * render-time flake (e.g. hero-blob image load timing) that affected the
 * capture step. Both sets were produced by the same Chromium config under
 * identical viewport/theme conditions, so a truly transparent migration
 * yields 0 differing pixels; the threshold only absorbs sub-pixel
 * anti-aliasing jitter.
 *
 * Uses `sharp` (already an apps/web dependency) to decode each PNG to a raw
 * RGBA buffer — no new dependency. For any failing pair it writes a diff
 * visualization to `diff/` (differing pixels in red over a dimmed copy of
 * the baseline).
 *
 * Threshold: maxDiffPixelRatio 0.001 (0.1%) per AC-6, matching the
 * playwright-visual.config.ts setting. A per-channel tolerance absorbs
 * anti-aliasing noise that does not represent a real visual change.
 *
 * Exit code:
 *   0 -> every pair within threshold (AC-5/AC-6 pass)
 *   1 -> at least one pair over threshold, a missing counterpart, a
 *        dimension mismatch, or a fatal error.
 *
 * Usage: node apps/web/tests/visual-snapshots/diff-snapshots.cjs
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname);
const BASELINE_DIR = path.join(ROOT, 'baseline');
const ACTUAL_DIR = path.join(ROOT, 'actual');
const DIFF_DIR = path.join(ROOT, 'diff');

/** Per-snapshot failing ratio (0.1%, per AC-6 + playwright-visual.config.ts). */
const MAX_DIFF_RATIO = 0.001;
/**
 * Per-channel absolute difference below which two pixels are treated as
 * equal. Absorbs anti-aliasing / font-hinting jitter that is not a real
 * visual change. 8/255 ≈ 3% of the channel range — conservative.
 */
const CHANNEL_TOLERANCE = 8;

/** Recursively collect every `*.png` under `dir`, returned as paths relative to `dir`. */
function collectPngs(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (entry.isFile() && entry.name.endsWith('.png')) {
                out.push(path.relative(dir, full));
            }
        }
    }
    return out.sort();
}

/** Decode a PNG to a flat RGBA buffer with its dimensions. */
async function loadRaw(file) {
    const { data, info } = await sharp(file)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

/**
 * Compare two equal-dimension RGBA buffers. Returns the count of differing
 * pixels (max per-channel abs diff over CHANNEL_TOLERANCE) and a diff RGBA
 * buffer (red over a dimmed baseline) for visualization.
 */
function comparePixels(baseData, actualData, width, height) {
    const pixelCount = width * height;
    const diff = Buffer.alloc(pixelCount * 4);
    let differing = 0;

    for (let i = 0; i < pixelCount; i++) {
        const o = i * 4;
        const dr = Math.abs(baseData[o] - actualData[o]);
        const dg = Math.abs(baseData[o + 1] - actualData[o + 1]);
        const db = Math.abs(baseData[o + 2] - actualData[o + 2]);
        const da = Math.abs(baseData[o + 3] - actualData[o + 3]);
        const maxChannel = Math.max(dr, dg, db, da);

        if (maxChannel > CHANNEL_TOLERANCE) {
            differing++;
            diff[o] = 255;
            diff[o + 1] = 0;
            diff[o + 2] = 0;
            diff[o + 3] = 255;
        } else {
            // Dimmed grayscale of the baseline so the red diff reads clearly.
            const gray = Math.round(
                (baseData[o] * 0.299 + baseData[o + 1] * 0.587 + baseData[o + 2] * 0.114) * 0.4 +
                    153
            );
            diff[o] = gray;
            diff[o + 1] = gray;
            diff[o + 2] = gray;
            diff[o + 3] = 255;
        }
    }

    return { differing, pixelCount, diff };
}

async function writeDiffPng(relPath, diffBuffer, width, height) {
    const outPath = path.join(DIFF_DIR, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sharp(diffBuffer, { raw: { width, height, channels: 4 } })
        .png()
        .toFile(outPath);
    return outPath;
}

async function main() {
    if (!fs.existsSync(BASELINE_DIR)) {
        console.error(`[diff-snapshots] baseline dir not found: ${BASELINE_DIR}`);
        console.error('Capture it first: pnpm test:visual:baseline (Phase 0).');
        process.exit(1);
    }
    if (!fs.existsSync(ACTUAL_DIR)) {
        console.error(`[diff-snapshots] actual dir not found: ${ACTUAL_DIR}`);
        console.error(
            'Capture it first: VISUAL_TEST_SNAPSHOT_DIR=actual pnpm test:visual:baseline (Phase 2, T-153-22).'
        );
        process.exit(1);
    }

    const baseline = collectPngs(BASELINE_DIR);
    const actual = new Set(collectPngs(ACTUAL_DIR));

    const failures = [];
    const overThreshold = [];
    let maxRatioSeen = 0;
    let maxRatioName = '';

    for (const rel of baseline) {
        if (!actual.has(rel)) {
            failures.push({ rel, reason: 'missing in actual/' });
            continue;
        }
        actual.delete(rel);

        const [base, act] = await Promise.all([
            loadRaw(path.join(BASELINE_DIR, rel)),
            loadRaw(path.join(ACTUAL_DIR, rel))
        ]);

        if (base.width !== act.width || base.height !== act.height) {
            failures.push({
                rel,
                reason: `dimension mismatch: baseline ${base.width}x${base.height} vs actual ${act.width}x${act.height}`
            });
            continue;
        }

        const { differing, pixelCount, diff } = comparePixels(
            base.data,
            act.data,
            base.width,
            base.height
        );
        const ratio = differing / pixelCount;
        if (ratio > maxRatioSeen) {
            maxRatioSeen = ratio;
            maxRatioName = rel;
        }

        if (ratio > MAX_DIFF_RATIO) {
            const outPath = await writeDiffPng(rel, diff, base.width, base.height);
            overThreshold.push({ rel, ratio, differing, pixelCount, outPath });
        }
    }

    // Any actual/ PNGs left over have no baseline counterpart.
    for (const rel of actual) {
        failures.push({ rel, reason: 'missing in baseline/' });
    }

    const totalPairs = baseline.length;
    // biome-ignore lint/suspicious/noConsoleLog: visual-snapshot diff CLI prints its report to the terminal
    console.log(
        `[diff-snapshots] compared ${totalPairs} baseline snapshots against actual/ ` +
            `(threshold ${(MAX_DIFF_RATIO * 100).toFixed(2)}% per snapshot).`
    );
    // biome-ignore lint/suspicious/noConsoleLog: visual-snapshot diff CLI prints its report to the terminal
    console.log(
        `[diff-snapshots] peak diff ratio: ${(maxRatioSeen * 100).toFixed(4)}% (${maxRatioName || 'n/a'}).`
    );

    if (failures.length === 0 && overThreshold.length === 0) {
        // biome-ignore lint/suspicious/noConsoleLog: visual-snapshot diff CLI prints its report to the terminal
        console.log('[diff-snapshots] OK - all snapshots within threshold. AC-5/AC-6 pass.');
        process.exit(0);
    }

    if (overThreshold.length > 0) {
        console.error(`\n[diff-snapshots] ${overThreshold.length} snapshot(s) OVER threshold:`);
        for (const f of overThreshold) {
            console.error(
                `  ${f.rel}: ${(f.ratio * 100).toFixed(4)}% (${f.differing}/${f.pixelCount} px) -> ${path.relative(ROOT, f.outPath)}`
            );
        }
    }
    if (failures.length > 0) {
        console.error(`\n[diff-snapshots] ${failures.length} structural failure(s):`);
        for (const f of failures) {
            console.error(`  ${f.rel}: ${f.reason}`);
        }
    }
    console.error(
        '\nInvestigate diff PNGs in diff/. If the change is a real regression, fix the token ' +
            'value in packages/design-tokens, rebuild, re-capture actual/, and re-run this gate.'
    );
    process.exit(1);
}

main().catch((err) => {
    console.error('[diff-snapshots] fatal:', err);
    process.exit(1);
});

/**
 * @file check-marketing-device.ts
 * @description GUARD:NOSPEC video-device-s24u — everything in `marketing/` that shows a phone
 * shows ONE reference device, the Samsung Galaxy S24 Ultra
 * (`marketing/videos/REGLAS.md` § «Dispositivo de referencia: Samsung Galaxy S24 Ultra").
 *
 * ## Predicates
 *
 * (a) No text file under `marketing/` names another phone or its look: the iPhone, a notch,
 *     the Dynamic Island (or its Spanish names), or the iPhone clock «9:41».
 * (b) No text file under `marketing/` quotes a phone size that is not the reference device:
 *     a closed list of other phones' CSS viewports and panel resolutions, written as
 *     `W × H` / `WxH` or as `width: W, height: H`, plus the bare 1170 / 2532 of the old
 *     A1 recording constants and the 20:9 aspect.
 * (c) `marketing/videos/config/device.ts` still declares the measured S24 Ultra numbers
 *     (screen 412 × 892, viewport 412 × 750, record DPR 3, export 1080 × 2340).
 *
 * One closed, named exemption: the REGLAS history row dated 31/10/2026 that records what was
 * replaced. It must match exactly one line, or the guard fails (a stale exemption is a
 * violation too).
 *
 * ## Lo que NO verifica
 * - No ve imágenes ni videos: un PNG con un iPhone pasa.
 * - No ve tamaños de teléfono fuera de la lista cerrada de (b): un modelo nuevo con medidas
 *   que no están ahí pasa. La lista es corta a propósito para no dar falsos positivos con
 *   tamaños legítimos (1080 × 1920 del video, 311 × 520 del inserto, etc.).
 * - No exige que un prompt describa el S24 Ultra: sólo prohíbe describir otro.
 * - No juzga si la marca «Samsung» aparece en un prompt de imagen (eso lo cuida la regla de
 *   REGLAS.md, no este guard).
 * - Sólo mira archivos que git ve (trackeados o no ignorados) bajo `marketing/`.
 *
 * Exit codes: 0 = clean; 1 = a violation or an untrustworthy scan.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCOPE = 'marketing/';
const TEXT_FILE = /\.(?:md|ts|tsx|mts|cts|js|mjs|py|json|txt|ya?ml)$/;
/** Measured: 440 text files under marketing/ on 31/10/2026, rounded down. */
const MIN_SCANNED_FILES = 400;
const DEVICE_FILE = 'marketing/videos/config/device.ts';

/** (a) Another phone, or a feature only another phone has. */
const OTHER_PHONE: readonly { readonly id: string; readonly pattern: RegExp }[] = [
    { id: 'iphone', pattern: /\biphone\b/i },
    { id: 'notch', pattern: /\bnotch\b/i },
    { id: 'dynamic-island', pattern: /\bdynamic\s+island\b/i },
    { id: 'isla-de-camara', pattern: /\bisla\s+(?:de\s+c[aá]mara|din[aá]mica)\b/i },
    { id: 'iphone-clock', pattern: /(?<![\d:])9:41(?![\d:])/ }
];

/**
 * (b) Sizes of phones that are not the reference device: CSS viewports and panel
 * resolutions of recent iPhones and of the common 20:9 Android size.
 */
const OTHER_SIZES: readonly (readonly [number, number])[] = [
    [375, 812],
    [390, 844],
    [393, 852],
    [402, 874],
    [428, 926],
    [430, 932],
    [440, 956],
    [360, 800],
    [412, 915],
    [1125, 2436],
    [1170, 2532],
    [1179, 2556],
    [1284, 2778],
    [1290, 2796],
    [1080, 2400]
];
const SIZE_PAIR = /(\d{3,4})\s*(?:[×xX]|,\s*height:)\s*(\d{3,4})/g;
const BARE_OLD_RECORDING = /(?<![\d.,])(?:1170|2532)(?![\d.,])/;
const OTHER_ASPECT = /(?<![\d.,])20:9(?![\d])/;

/** (c) The measured numbers that must stay in the device profile. */
const DEVICE_ANCHORS: readonly RegExp[] = [
    /screen:\s*\{\s*width:\s*412,\s*height:\s*892\s*\}/,
    /viewport:\s*\{\s*width:\s*412,\s*height:\s*750\s*\}/,
    /recordDpr:\s*3\b/,
    /exportSize:\s*\{\s*width:\s*1080,\s*height:\s*2340\s*\}/
];

/** Closed, named exemptions. Each must match exactly `lines` lines. */
const EXEMPTIONS: readonly {
    readonly name: string;
    readonly file: string;
    readonly linePrefix: string;
    readonly lines: number;
}[] = [
    {
        name: 'reglas-history-row',
        file: 'marketing/videos/REGLAS.md',
        linePrefix: '| 31/10/2026 |',
        lines: 1
    }
];

interface Violation {
    readonly predicate: 'a' | 'b' | 'c' | 'exemption';
    readonly file: string;
    readonly line?: number;
    readonly detail: string;
}

/** Lists the text files git sees under `marketing/` (tracked or not ignored). */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const output = execFileSync(
        'git',
        ['ls-files', '-co', '--exclude-standard', '-z', '--', SCOPE],
        { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => !/(^|\/)node_modules\//.test(file))
        .filter((file) => TEXT_FILE.test(file));
}

/** Returns the violations of predicates (a) and (b) on one line. */
function lineViolations({
    file,
    line,
    text
}: {
    readonly file: string;
    readonly line: number;
    readonly text: string;
}): readonly Violation[] {
    const found: Violation[] = [];
    for (const { id, pattern } of OTHER_PHONE) {
        if (pattern.test(text)) found.push({ predicate: 'a', file, line, detail: id });
    }
    for (const match of text.matchAll(SIZE_PAIR)) {
        const width = Number(match[1]);
        const height = Number(match[2]);
        if (OTHER_SIZES.some(([w, h]) => w === width && h === height))
            found.push({ predicate: 'b', file, line, detail: `${width}×${height}` });
    }
    if (BARE_OLD_RECORDING.test(text))
        found.push({ predicate: 'b', file, line, detail: 'old A1 recording size (1170/2532)' });
    if (OTHER_ASPECT.test(text)) found.push({ predicate: 'b', file, line, detail: '20:9' });
    return found;
}

/**
 * Runs the guard.
 *
 * @param input.root - Repo root (defaults to the one this script lives in).
 * @param input.files - Files to scan, relative to `root` (defaults to `git ls-files`).
 * @param input.readFile - File reader (injectable for tests).
 * @returns `{ exitCode, output, violations }`.
 */
export function run({
    root = ROOT,
    files: injectedFiles,
    readFile = (path: string) => readFileSync(join(root, path), 'utf8')
}: {
    readonly root?: string;
    readonly files?: readonly string[];
    readonly readFile?: (path: string) => string;
} = {}): {
    readonly exitCode: number;
    readonly output: string;
    readonly violations: readonly Violation[];
} {
    const files = injectedFiles ?? listFiles({ root });
    if (!injectedFiles && files.length < MIN_SCANNED_FILES) {
        return {
            exitCode: 1,
            output: `check-marketing-device: untrustworthy scan, ${files.length} < ${MIN_SCANNED_FILES} files under ${SCOPE}`,
            violations: []
        };
    }
    const violations: Violation[] = [];
    const exemptLines = new Map<string, number>();
    for (const file of files) {
        const rows = readFile(file).split('\n');
        rows.forEach((text, index) => {
            const hits = lineViolations({ file, line: index + 1, text });
            if (hits.length === 0) return;
            const exemption = EXEMPTIONS.find(
                (entry) => entry.file === file && text.startsWith(entry.linePrefix)
            );
            if (exemption) {
                exemptLines.set(exemption.name, (exemptLines.get(exemption.name) ?? 0) + 1);
                return;
            }
            violations.push(...hits);
        });
    }
    for (const entry of EXEMPTIONS) {
        const found = exemptLines.get(entry.name) ?? 0;
        if (found !== entry.lines)
            violations.push({
                predicate: 'exemption',
                file: entry.file,
                detail: `exemption ${entry.name} expected ${entry.lines} line(s), found ${found}`
            });
    }
    const device = files.includes(DEVICE_FILE) ? readFile(DEVICE_FILE) : '';
    for (const anchor of DEVICE_ANCHORS) {
        if (!anchor.test(device))
            violations.push({
                predicate: 'c',
                file: DEVICE_FILE,
                detail: `missing ${anchor.source}`
            });
    }
    const output = violations.length
        ? [
              'check-marketing-device: marketing/ must use the Galaxy S24 Ultra only (marketing/videos/REGLAS.md).',
              ...violations.map(
                  (v) => `  (${v.predicate}) ${v.file}${v.line ? `:${v.line}` : ''}: ${v.detail}`
              )
          ].join('\n')
        : `check-marketing-device: ${files.length} files under ${SCOPE}, reference device intact, exemptions ${EXEMPTIONS.map((e) => `${e.name}=${exemptLines.get(e.name) ?? 0}`).join(', ')}`;
    return { exitCode: violations.length ? 1 : 0, output, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    process.stdout.write(`${result.output}\n`);
    process.exitCode = result.exitCode;
}

/**
 * @file check-verticals-no-addon-product-write.ts
 * @description TEST:V2:8 (HOS-1352 program, V2.2 / HOS-1435, AC:V2:5): no code
 * of the verticals half writes `addon_product.version_id`.
 *
 * Verticals creates an addon version; publishing it is re-pointing
 * `addon_product.version_id`, an act of billing over its own column, which
 * validates the version with `addonPolicy` (spec V2 §2.1, `F-8V3C1-007`). A
 * write from verticals through `@repo/db` is the crossing GUARD:G14 cannot see
 * (contract §4.2), so this check looks for it.
 *
 * ## The predicate (what a red proves, and nothing more)
 *
 * A code file of the verticals half (the folders `HALVES.verticals` of G14
 * lists; `.ts .tsx .mts .cts .js .jsx .mjs .cjs`, tests included), with its
 * comments blanked out, fails when it names BOTH:
 * - the table: its SQL name `addon_product`, or a Drizzle-style identifier
 *   `addonProduct` / `addonProducts` (any suffix, e.g. `addonProductModel`);
 * - and its pointer column: `version_id` or `versionId`.
 * Naming both in one file is how a write of that column is spelled; the red
 * names the file and the line of the table's first mention. A read of the
 * column in the same file is red too: verticals has no reason to touch billing's
 * table at all.
 *
 * NOT seen, on purpose: a name built at runtime (string concatenation, a
 * variable), and the table and the column named in two different files.
 *
 * ## Fails loud
 *
 * An empty verticals half, or a half with no code file, is a moved package or a
 * wrong cwd, never a clean tree.
 *
 * ## Positive control
 *
 * `run({ root, folders })` takes any tree and any folders:
 * `scripts/__tests__/check-verticals-no-addon-product-write.test.ts` breaks it
 * on purpose over throwaway git trees and sees it red.
 *
 * Exit codes: 0 = clean; 1 = a write of the pointer, or a check that cannot be enforced.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HALVES, withoutComments } from './check-billing-verticals-boundary.js';

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** billing's table, by SQL name or Drizzle-style identifier. */
const TABLE = /\baddon_product\b|\baddonProducts?\w*/;

/** billing's pointer column. */
const COLUMN = /\bversion_id\b|\bversionId\b/;

/** One file that names the table and its pointer. */
export interface PointerWrite {
    readonly file: string;
    readonly line: number;
}

/**
 * Whether one file's source names `addon_product` and its `version_id`.
 *
 * @returns The line of the table's first mention, or `null` when the file is clean
 */
export function findPointerWrite(args: {
    readonly file: string;
    readonly source: string;
}): PointerWrite | null {
    const code = withoutComments(args.source);
    const table = TABLE.exec(code);
    if (!table || !COLUMN.test(code)) return null;
    return { file: args.file, line: code.slice(0, table.index).split('\n').length };
}

/** The files git sees under `root`. */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter((file) => file !== '' && !/(^|\/)(node_modules|dist)\//.test(file));
}

/**
 * Runs the check and renders its report.
 *
 * @param args.root - Repo root (defaults to the cwd)
 * @param args.folders - The verticals half's folders (defaults to G14's `HALVES.verticals`)
 * @returns The exit code and the report text
 */
export function run(args: { readonly root?: string; readonly folders?: readonly string[] } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = resolve(args.root ?? process.cwd());
    const folders = args.folders ?? HALVES.verticals;
    const lines = ['=== TEST:V2:8 — verticals never writes addon_product.version_id ==='];
    const fail = (message: string) => {
        lines.push(`ERROR: ${message}`);
        return { exitCode: 1 as const, output: lines.join('\n') };
    };

    if (folders.length === 0) {
        return fail('the verticals half declares no folder (HALVES.verticals); nothing to check.');
    }
    const files = listFiles({ root }).filter(
        (file) =>
            CODE_FILE.test(file) &&
            folders.some((folder) => file === folder || file.startsWith(`${folder}/`))
    );
    if (files.length === 0) {
        return fail(
            `no code file under ${folders.join(', ')} in ${root}. Fix HALVES or the cwd; a missing half is not a clean tree.`
        );
    }

    const writes = files.flatMap((file) => {
        const found = findPointerWrite({ file, source: readFileSync(join(root, file), 'utf8') });
        return found ? [found] : [];
    });
    if (writes.length > 0) {
        lines.push(
            `FAIL: ${writes.length} verticals file(s) name billing's addon_product table and its version_id. ` +
                'Re-pointing addon_product.version_id is an act of billing; verticals only creates the addon version.'
        );
        for (const w of writes) lines.push(`  ${w.file}:${w.line}`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${files.length} verticals code file(s) scanned under ${folders.join(', ')}; none names addon_product together with its version_id.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}

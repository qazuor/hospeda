/**
 * @file run-export.ts
 * @description `pnpm --filter @repo/help export` (and `hops help export`, which
 * spawns it): writes the Markdown bundle of one audience (HOS-2410 US-10).
 *
 * ```text
 * export --audience <host|venue|experience|provider|partner|all> --site-url <url> [--out <file>]
 * ```
 *
 * - Without `--out` the document goes to stdout and nothing else does: every
 *   message goes to stderr, so the output can be piped (AC-35).
 * - An invalid or missing audience exits 1 with the valid list and writes
 *   nothing (AC-36). So does a missing or malformed site URL, one with a query
 *   or a fragment (the links are built under it), and an audience that has no
 *   article yet.
 * - With `--out` the file is written whole or not at all: a temp file in the
 *   same directory, then a rename (AC-37). A relative path is resolved against
 *   the directory pnpm was started from (`INIT_CWD`), not the package folder.
 *
 * Dev-only: it reads the committed index through `HELP_ARTICLES` and writes
 * files, so it lives outside the runtime entry (`src/index.ts`, AC-12).
 *
 * Exit codes: 0 = written; 1 = bad arguments or a failed write, nothing written.
 */

import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { HelpArticle } from '../article.schema';
import { HELP_EXPORT_AUDIENCES, helpExportArticles, renderHelpExport } from './render-export';

/** The arguments of the export, validated. */
export const HelpExportArgsSchema = z.object({
    audience: z.enum(HELP_EXPORT_AUDIENCES, {
        error: `--audience must be one of: ${HELP_EXPORT_AUDIENCES.join(', ')}`
    }),
    siteUrl: z
        .url({
            protocol: /^https?$/,
            error: '--site-url must be an absolute http(s) URL, for example https://hospeda.com.ar'
        })
        .refine((value) => !/[?#]/.test(value), {
            error: '--site-url must not carry a query (?) or a fragment (#): every link is built under it'
        }),
    out: z.string().min(1).optional()
});

/** The validated arguments. */
export type HelpExportArgs = z.infer<typeof HelpExportArgsSchema>;

/** Where the export writes and what it reads. Injected so tests run it in-process. */
export interface RunHelpExportArgs {
    /** The arguments after the script name. */
    readonly argv: readonly string[];
    /** The catalog to export. */
    readonly articles: readonly HelpArticle[];
    /** Receives the document when there is no `--out`. */
    readonly stdout: (text: string) => void;
    /** Receives every message. */
    readonly stderr: (text: string) => void;
    /** The directory a relative `--out` resolves against. */
    readonly cwd: string;
}

/** The usage line printed with every argument error. */
const USAGE = `usage: export --audience <${HELP_EXPORT_AUDIENCES.join('|')}> --site-url <url> [--out <file>]`;

/** Parses the command line into raw values, or explains why it cannot. */
function readArgv(argv: readonly string[]):
    | { readonly ok: true; readonly values: Record<string, unknown> }
    | {
          readonly ok: false;
          readonly message: string;
      } {
    try {
        const { values } = parseArgs({
            args: [...argv],
            options: {
                audience: { type: 'string' },
                'site-url': { type: 'string' },
                out: { type: 'string' }
            },
            strict: true,
            allowPositionals: false
        });
        return {
            ok: true,
            values: { audience: values.audience, siteUrl: values['site-url'], out: values.out }
        };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
}

/** Writes a file whole or not at all. */
function writeAtomically({ file, content }: { readonly file: string; readonly content: string }) {
    const temp = join(dirname(file), `.${process.pid}.${Date.now()}.help-export.tmp`);
    try {
        writeFileSync(temp, content);
        renameSync(temp, file);
    } catch (error) {
        rmSync(temp, { force: true });
        throw error;
    }
}

/**
 * Runs the export.
 *
 * @param args - The command line, the catalog, the output streams and the cwd
 * @returns The exit code
 */
export function runHelpExport({ argv, articles, stdout, stderr, cwd }: RunHelpExportArgs): number {
    const raw = readArgv(argv);
    if (!raw.ok) {
        stderr(`${raw.message}\n${USAGE}\n`);
        return 1;
    }
    const parsed = HelpExportArgsSchema.safeParse(raw.values);
    if (!parsed.success) {
        const messages = parsed.error.issues.map((issue) => issue.message);
        stderr(`${messages.join('\n')}\n${USAGE}\n`);
        return 1;
    }
    const { audience, siteUrl, out } = parsed.data;
    if (helpExportArticles({ articles, audience }).length === 0) {
        stderr(`no article is written for the audience "${audience}" yet; nothing exported\n`);
        return 1;
    }
    const document = renderHelpExport({ articles, audience, siteUrl });
    if (out === undefined) {
        stdout(document);
        return 0;
    }
    const file = isAbsolute(out) ? out : resolve(cwd, out);
    try {
        writeAtomically({ file, content: document });
    } catch (error) {
        stderr(
            `could not write ${file}: ${error instanceof Error ? error.message : String(error)}\n`
        );
        return 1;
    }
    stderr(`help export: wrote ${file}\n`);
    return 0;
}

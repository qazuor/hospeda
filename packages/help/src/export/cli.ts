/**
 * @file cli.ts
 * @description Entry of `pnpm --filter @repo/help export` (HOS-2410 US-10). The
 * logic and its contract live in `run-export.ts`; this file only wires the
 * process to it.
 */

import { HELP_ARTICLES } from '../help-index';
import { runHelpExport } from './run-export';

process.exitCode = runHelpExport({
    argv: process.argv.slice(2),
    articles: HELP_ARTICLES,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    cwd: process.env.INIT_CWD ?? process.cwd()
});

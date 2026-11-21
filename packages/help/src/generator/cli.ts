/**
 * @file cli.ts
 * @description `pnpm help:build` (root) → `pnpm --filter @repo/help generate`:
 * parses and validates every article and writes `generated/help-index.json`
 * (HOS-2410 spec §5.2). Writes nothing when an article does not parse or a
 * catalog rule fails, so a broken catalog never reaches the committed index.
 *
 * Exit codes: 0 = written (or already current); 1 = issues, nothing written.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { buildHelpIndex, HELP_INDEX_FILE, readHelpContentFiles } from './build-index';
import { formatHelpIssues } from './format-issues';

const result = buildHelpIndex({ files: readHelpContentFiles() });

if (result.issues.length > 0 || result.json === undefined) {
    process.stderr.write(`${formatHelpIssues({ issues: result.issues })}\n`);
    process.stderr.write('help:build wrote nothing. Fix the articles above and run it again.\n');
    process.exit(1);
}

let current = '';
try {
    current = readFileSync(HELP_INDEX_FILE, 'utf8');
} catch {
    current = '';
}

if (current === result.json) {
    process.stdout.write(`help:build: ${result.fileCount} articles, index already current.\n`);
} else {
    const temp = `${HELP_INDEX_FILE}.tmp`;
    writeFileSync(temp, result.json);
    renameSync(temp, HELP_INDEX_FILE);
    process.stdout.write(
        `help:build: ${result.fileCount} articles, wrote packages/help/generated/help-index.json.\n`
    );
}

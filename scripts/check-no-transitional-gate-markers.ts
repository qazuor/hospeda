import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'HOS-1352: transitional until V3';
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
export const MIN_SCANNED_FILES = 1000;

/** Scan tracked API source files and reject unresolved transition markers. */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = execFileSync('git', ['ls-files', '-z', '--', 'apps/api/src'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    })
        .split('\0')
        .filter(Boolean)
        .filter((file) => CODE_FILE.test(file) && existsSync(join(root, file)));
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minScannedFiles) {
        return {
            exitCode: 1,
            output: `No transitional gate markers: scanned ${files.length} files; expected at least ${minScannedFiles}`
        };
    }

    const findings = files.flatMap((file) => {
        const source = readFileSync(join(root, file), 'utf8');
        return source
            .split('\n')
            .flatMap((line, index) =>
                line.includes(MARKER) ? [`${file}:${index + 1}: ${line}`] : []
            );
    });
    return findings.length > 0
        ? { exitCode: 1, output: findings.join('\n') }
        : {
              exitCode: 0,
              output: `No transitional gate markers: OK; ${files.length} files scanned`
          };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}

/** GUARD:G13 — reject bootstrap billing answers in production code. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { withoutComments } from './check-billing-verticals-boundary';

const WATCHED = 'packages/verticals/src/coverage/bootstrap-billing-answers.ts';
const ASSEMBLER = 'packages/verticals/src/coverage/bootstrap-billing-for-verticals.ts';
const BARREL = 'packages/verticals/src/index.ts';
const ANSWERS = [
    'bootstrapSubscriptionAnswer',
    'bootstrapCourtesyAnswer',
    'bootstrapGrantAnswer',
    'bootstrapAddonAnswer',
    'bootstrapRetentionStoppedAnswer',
    'bootstrapCanChargeAnswer'
] as const;

/** Minimum production files expected in the real repository. */
export const MIN_SCANNED_FILES = 15;

/** The result of one G13 run. */
export interface GuardResult {
    readonly exitCode: 0 | 1;
    readonly output: string;
}

const CODE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const EXCLUDED =
    /(?:^|\/)(?:node_modules|dist|test|tests|__tests__|testing|__mocks__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/;
const STATIC = /\b(import|export)\s+([^;]*?)\s+from\s*(['"`])([^'"`]+)\3/g;
const SIDE_EFFECT = /\bimport\s*(['"`])([^'"`]+)\1/g;
const DYNAMIC = /\b(import|require)\s*\(\s*(['"`])([^'"`]+)\2/g;

function targetOf(file: string, specifier: string): 'answers' | 'assembler' | 'barrel' | null {
    if (specifier === '@repo/verticals') return 'barrel';
    if (!specifier.startsWith('.') && !specifier.startsWith('@repo/verticals/')) return null;
    const normalized = specifier.startsWith('.')
        ? posix
              .normalize(posix.join(posix.dirname(file), specifier))
              .replace(/\.(?:js|ts|mjs|mts)$/, '')
        : specifier
              .replace(/^@repo\/verticals\/(?:src\/)?/, 'packages/verticals/src/')
              .replace(/\.(?:js|ts)$/, '');
    if (normalized === WATCHED.slice(0, -3)) {
        return 'answers';
    }
    if (normalized === ASSEMBLER.slice(0, -3)) {
        return 'assembler';
    }
    return null;
}

function namedAnswers(clause: string): readonly string[] {
    const braces = /\{([^}]*)\}/.exec(clause);
    if (!braces) return ['las seis'];
    const names = (braces[1] ?? '')
        .split(',')
        .map((part) => part.trim().split(/\s+as\s+/)[0] ?? '');
    const matched = names.filter((name) => ANSWERS.some((answer) => answer === name));
    return matched.length > 0 ? matched : ['las seis'];
}

/** Scan a git tree; the production signal is supplied by CI. */
export function run(
    args: {
        readonly root?: string;
        readonly env?: NodeJS.ProcessEnv;
        readonly minScannedFiles?: number;
    } = {}
): GuardResult {
    const root = args.root ?? process.cwd();
    const env = args.env ?? process.env;
    if (!existsSync(join(root, WATCHED))) {
        return { exitCode: 1, output: `FAIL GUARD:G13: watched module missing: ${WATCHED}` };
    }
    if (env.HOSPEDA_PRODUCTION_BUILD !== '1') {
        return { exitCode: 0, output: 'GUARD:G13 silent on branch: not a production build.' };
    }

    let files: string[];
    try {
        files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024
        })
            .split('\0')
            .filter(Boolean);
    } catch {
        return { exitCode: 1, output: 'FAIL GUARD:G13: git ls-files failed.' };
    }
    const codeFiles = files.filter(
        (file) => /^(apps|packages)\//.test(file) && CODE.test(file) && !EXCLUDED.test(file)
    );
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (codeFiles.length < minimum) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G13: scanned only ${codeFiles.length} files; expected ${minimum}.`
        };
    }

    const violations: string[] = [];
    for (const file of codeFiles) {
        if (file === WATCHED || file === ASSEMBLER) continue;
        const source = withoutComments(readFileSync(join(root, file), 'utf8'));
        const record = (offset: number, specifier: string, clause?: string) => {
            const target = targetOf(file, specifier);
            if (!target) return;
            // The public barrel must export the assembler, while it must never
            // export the watched answers module.
            if (file === BARREL && target === 'assembler' && clause?.startsWith('export ')) return;
            if (target === 'barrel' && clause) {
                const braces = /\{([^}]*)\}/.exec(clause);
                if (
                    braces &&
                    !braces[1]
                        ?.split(',')
                        .some(
                            (part) =>
                                part.trim().split(/\s+as\s+/)[0] ===
                                'createBootstrapBillingForVerticals'
                        )
                )
                    return;
            }
            const line = source.slice(0, offset).split('\n').length;
            const names =
                target === 'answers' && clause
                    ? namedAnswers(clause.replace(/^export\s+|^import\s+/, ''))
                    : ['las seis'];
            for (const name of names)
                violations.push(`${file}:${line} links ${name} via '${specifier}'`);
        };
        for (const match of source.matchAll(STATIC)) {
            record(match.index, match[4] ?? '', `${match[1]} ${match[2]}`);
        }
        for (const match of source.matchAll(SIDE_EFFECT)) record(match.index, match[2] ?? '');
        for (const match of source.matchAll(DYNAMIC)) record(match.index, match[3] ?? '');
    }
    if (violations.length > 0) {
        return { exitCode: 1, output: `FAIL GUARD:G13:\n${violations.join('\n')}` };
    }
    return {
        exitCode: 0,
        output: `OK GUARD:G13: scanned ${codeFiles.length} production code files.`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}

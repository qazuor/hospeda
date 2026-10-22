/**
 * GUARD:G6 checks that authorization does not compare a role constant
 * (04-catalogos.md:7696; INV:12) and that effective-set construction reads no
 * role (INV:13; V5.md:1222-1227). See role-decision-scan.ts for blind spots.
 * The scanner does not verify variable-to-variable comparisons, calculated
 * role maps, cross-file role sets, clients, or seed data.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    analyzeRoleFile,
    type RoleFileAnalysis,
    type RoleForm,
    readRoleValues
} from './role-decision-scan';

const CODE = /\.(?:ts|tsx|mts|cts)$/;
const TEST = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
/** Minimum production source count that keeps an unexpectedly empty scan red. */
export const MIN_SCANNED_FILES = 1000;
type Exception = {
    readonly file: string;
    readonly symbol: string;
    readonly form: RoleForm;
    readonly count: number;
    readonly why: string;
    readonly spec: readonly string[];
};
const PREFICES = [
    'packages/verticals/src/effective-set/',
    'packages/verticals/src/effective-set-cache/',
    'packages/verticals/src/coverage/',
    'packages/verticals/src/quota/',
    'apps/api/src/utils/listing-access/'
];
const FIXED = [
    'packages/verticals/src/authorization/entitlement-step.ts',
    'packages/verticals/src/authorization/limit-step.ts',
    'apps/api/src/utils/effective-set-cache.ts',
    'apps/api/src/utils/entitlement-filter.ts',
    'apps/api/src/routes/user/protected/effective-set.ts',
    'apps/api/src/routes/user/admin/effective-set.ts'
];
const CITATION = /^\.specs\/HOS-135[234]-[a-z0-9-]+\/.+\.md:\d+(?:-\d+)?$/;
const EXCEPTIONS_PATH = 'scripts/guards/role-decision-exceptions.json';

function sourceFiles(root: string): readonly string[] {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    })
        .split('\0')
        .filter(Boolean)
        .filter(
            (file) =>
                CODE.test(file) &&
                !TEST.test(file) &&
                (/^apps\/api\/src\//.test(file) || /^packages\/[^/]+\/src\//.test(file)) &&
                !file.startsWith('packages/seed/')
        )
        .filter((file) => existsSync(join(root, file)));
}

function effectiveScope(
    files: readonly string[],
    analysisFor: (file: string) => RoleFileAnalysis
): { readonly files: readonly string[]; readonly error?: string } {
    for (const prefix of PREFICES)
        if (!files.some((file) => file.startsWith(prefix)))
            return { files: [], error: `G6: no scanned file under ${prefix}` };
    for (const file of FIXED)
        if (!files.includes(file))
            return { files: [], error: `G6: fixed effective-set file is not scanned: ${file}` };
    if (!files.some((file) => analysisFor(file).declaresResolveEffectiveSet))
        return {
            files: [],
            error: 'G6: no scanned file declares export async function resolveEffectiveSet'
        };
    const selected = new Set(
        files.filter(
            (file) => PREFICES.some((prefix) => file.startsWith(prefix)) || FIXED.includes(file)
        )
    );
    for (const file of files) if (analysisFor(file).callsEffectiveSet) selected.add(file);
    return { files: [...selected] };
}

function parseExceptions(
    root: string,
    scanned: ReadonlySet<string>,
    path: string
): { readonly entries: readonly Exception[]; readonly error?: string } {
    let data: unknown;
    try {
        data = JSON.parse(readFileSync(join(root, path), 'utf8'));
    } catch (error) {
        return { entries: [], error: `G6: cannot read exception JSON: ${String(error)}` };
    }
    if (
        !data ||
        typeof data !== 'object' ||
        !Array.isArray((data as { exceptions?: unknown }).exceptions)
    )
        return { entries: [], error: 'G6: exception JSON must contain an exceptions array' };
    const entries = (data as { exceptions: unknown[] }).exceptions;
    const keys = new Set<string>();
    for (const item of entries) {
        if (!item || typeof item !== 'object')
            return { entries: [], error: 'G6: invalid exception entry' };
        const e = item as Partial<Exception>;
        if (
            typeof e.file !== 'string' ||
            typeof e.symbol !== 'string' ||
            typeof e.form !== 'string' ||
            !['compare', 'membership-arg', 'membership-set', 'switch-case'].includes(e.form) ||
            !Number.isInteger(e.count) ||
            (e.count ?? 0) < 1 ||
            typeof e.why !== 'string' ||
            !e.why.trim() ||
            !Array.isArray(e.spec) ||
            e.spec.length === 0 ||
            !e.spec.every((s) => typeof s === 'string')
        )
            return { entries: [], error: 'G6: incomplete or invalid exception entry' };
        if (!scanned.has(e.file))
            return { entries: [], error: `G6: exception file is not scanned: ${e.file}` };
        const key = `${e.file}\0${e.symbol}\0${e.form}`;
        if (keys.has(key))
            return {
                entries: [],
                error: `G6: duplicate exception ${e.file} [${e.symbol}] ${e.form}`
            };
        keys.add(key);
        for (const citation of e.spec) {
            if (!CITATION.test(citation))
                return { entries: [], error: `G6: invalid spec citation ${citation}` };
            const match = /:(\d+)(?:-(\d+))?$/.exec(citation);
            if (!match) return { entries: [], error: `G6: invalid spec citation ${citation}` };
            const citedFile = citation.slice(0, match.index);
            const citationPath = join(root, citedFile);
            if (!existsSync(citationPath))
                return { entries: [], error: `G6: cited spec file does not exist: ${citedFile}` };
            const lines = readFileSync(citationPath, 'utf8').split(/\r?\n/).length;
            if (Number(match[2] ?? match[1]) > lines)
                return { entries: [], error: `G6: citation exceeds file length: ${citation}` };
        }
    }
    return { entries: entries as Exception[] };
}

/** Run both halves of GUARD:G6 over the repository source tree. */
export function run(
    args: {
        readonly root?: string;
        readonly minScannedFiles?: number;
        readonly exceptionsPath?: string;
    } = {}
): { readonly exitCode: 0 | 1; readonly output: string } {
    const root = args.root ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const files = sourceFiles(root);
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minimum)
        return {
            exitCode: 1,
            output: `FAIL GUARD:G6: scanned ${files.length} production files; expected at least ${minimum}`
        };
    let roleValues: ReadonlySet<string>;
    try {
        roleValues = readRoleValues({ root });
    } catch (error) {
        return { exitCode: 1, output: `FAIL GUARD:G6: ${String(error)}` };
    }
    const parsed = parseExceptions(root, new Set(files), args.exceptionsPath ?? EXCEPTIONS_PATH);
    if (parsed.error) return { exitCode: 1, output: `FAIL GUARD:G6: ${parsed.error}` };
    const sourceCache = new Map<string, string>();
    const sourceFor = (file: string): string => {
        const cached = sourceCache.get(file);
        if (cached !== undefined) return cached;
        const source = readFileSync(join(root, file), 'utf8');
        sourceCache.set(file, source);
        return source;
    };
    const analyses = new Map<string, RoleFileAnalysis>();
    const analysisFor = (file: string): RoleFileAnalysis => {
        const cached = analyses.get(file);
        if (cached) return cached;
        const analysis = analyzeRoleFile({ file, source: sourceFor(file), roleValues });
        analyses.set(file, analysis);
        return analysis;
    };
    const decisions = files.flatMap((file) => analysisFor(file).decisions);
    const counts = new Map<string, number>();
    const errors: string[] = [];
    for (const finding of decisions) {
        const key = `${finding.file}\0${finding.symbol}\0${finding.form}`;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        const exception = parsed.entries.find(
            (entry) => `${entry.file}\0${entry.symbol}\0${entry.form}` === key
        );
        if (!exception || count > exception.count)
            errors.push(
                `FAIL GUARD:G6 (a) an authorization decides only by role: ${finding.file}:${finding.line} [${finding.symbol}] ${finding.form}: ${finding.expression}`
            );
    }
    for (const exception of parsed.entries) {
        const found = counts.get(`${exception.file}\0${exception.symbol}\0${exception.form}`) ?? 0;
        if (found < exception.count)
            errors.push(
                `FAIL GUARD:G6 (a) exception stale: ${exception.file} [${exception.symbol}] ${exception.form}: declared ${exception.count}, found ${found}`
            );
    }
    const scope = effectiveScope(files, analysisFor);
    const roleReadErrors: string[] = [];
    if (scope.error) roleReadErrors.push(`FAIL GUARD:G6 (b): ${scope.error}`);
    else
        for (const file of scope.files) {
            for (const finding of analysisFor(file).reads)
                roleReadErrors.push(
                    `FAIL GUARD:G6 (b) a role entered the effective set: ${finding.file}:${finding.line} reads ${finding.reads}`
                );
        }
    const allErrors = [...roleReadErrors, ...errors];
    return allErrors.length
        ? { exitCode: 1, output: allErrors.join('\n') }
        : {
              exitCode: 0,
              output: `OK GUARD:G6: (a) ${files.length} production files scanned, ${decisions.length} role comparisons all declared in ${parsed.entries.length} cited exceptions; (b) ${scope.files.length} effective-set files scanned, no role read`
          };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}

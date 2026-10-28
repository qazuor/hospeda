/**
 * G-FAC-R1 scans tracked source, tests, scripts, documentation, and locale values.
 * Exemptions are closed, named, and counted per file/key in the companion JSON.
 * History is derived from tests that apply migrations through a journal tag or
 * import/read a seed data-migration. The five edited SQL files have a separate
 * value-only check because their schema identifiers describe historical state.
 *
 * ## Lo que NO verifica
 * - No ve la palabra en binarios ni imágenes.
 * - No ve strings armados en runtime.
 * - No ve contenido fuera de git ls-files.
 * - No juzga si un texto de (b) es tema o vertical.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PARTS = ['gastronom', 'y'];
const LOWER = `${PARTS.join('')}|${PARTS[0]}ies`;
const TITLE = `${PARTS[0].charAt(0).toUpperCase()}${PARTS[0].slice(1)}${PARTS[1]}|${PARTS[0].charAt(0).toUpperCase()}${PARTS[0].slice(1)}ies`;
const UPPER = `${PARTS[0].toUpperCase()}${PARTS[1].toUpperCase()}|${PARTS[0].toUpperCase()}IES`;
const IDENTIFIER = new RegExp(`(?:${LOWER}|${TITLE}|${UPPER})`, 'g');
const MIGRATIONS = ['0129_', '0132_', '0139_', '0144_', '0176_'];
const CONFIG = 'scripts/guards/venue-retired-word.json';
const EXEMPT_FILES = [
    'scripts/check-venue-retired-word.ts',
    'scripts/__tests__/check-venue-retired-word.test.ts',
    CONFIG
];

type Exemption = {
    readonly files?: Readonly<Record<string, number>>;
    readonly keys?: Readonly<Record<string, number>>;
    readonly markers?: Readonly<Record<string, number>>;
};
type GuardConfig = {
    readonly exemptions: Readonly<Record<string, Exemption>>;
    readonly historyCount: number;
    readonly historyWordFiles: number;
    readonly ledgerFingerprint: string;
};
type Violation = {
    readonly file: string;
    readonly line: number;
    readonly rule: number;
    readonly text: string;
};

const legacyMarker = ['legacy-name', 'allowed:'].join('-');
const isHistoryModule = (path: string) => path.startsWith('packages/seed/src/data-migrations/');
export const outOfScan = (path: string) => {
    if (path.startsWith('.specs/') || isHistoryModule(path)) return true;
    if (
        !path.startsWith('packages/db/src/migrations/') ||
        path.startsWith('packages/db/src/migrations/extras/')
    )
        return false;
    if (path === 'packages/db/src/migrations/meta/_journal.json') return true;
    const name = path.split('/').at(-1) ?? '';
    const version = name.match(/^(\d{4})/)?.[1] ?? name.match(/^(\d{4})/)?.[1];
    return version !== undefined && Number(version) <= 180;
};

/** Measured tracked scan floor: 17,355 eligible paths rounded down to 17,000. */
export const SCAN_FLOOR = 17_000;

function getConfig(root: string): GuardConfig {
    return JSON.parse(readFileSync(join(root, CONFIG), 'utf8')) as GuardConfig;
}

export function ledgerFingerprint(exemptions: Readonly<Record<string, Exemption>>): string {
    const paths = Object.entries(exemptions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, entry]) => [
            name,
            Object.keys(entry.files ?? {}).sort(),
            Object.keys(entry.keys ?? {}).sort(),
            Object.keys(entry.markers ?? {}).sort()
        ]);
    return createHash('sha256').update(JSON.stringify(paths)).digest('hex');
}

function gitFiles(root: string): string[] {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 20 * 1024 * 1024 })
        .toString()
        .split('\0')
        .filter(Boolean);
}

function lineHits(file: string, text: string, regex: RegExp): Violation[] {
    const result: Violation[] = [];
    const rows = text.split('\n');
    rows.forEach((row, index) => {
        for (const match of row.matchAll(new RegExp(regex.source, 'g')))
            result.push({ file, line: index + 1, rule: 1, text: match[0] });
    });
    return result;
}

function hasRetiredRuleHit(file: string, source: string): boolean {
    const patterns = [
        IDENTIFIER,
        new RegExp(
            `/(?:es|en|pt)/${['gastro', 'nomia'].join('')}(?:/|$)|(?:planes|presentacion|publicar)/${['gastro', 'nomia'].join('')}`,
            'i'
        ),
        /(?:^|[^A-Za-z])gastro-|(?:^|[^A-Za-z])-gastro(?:$|[^A-Za-z])/i,
        /(?:^|\/)[a-z-]*restaurante(?:\/|$)|publicar-restaurante/i
    ];
    return patterns.some((pattern) => pattern.test(file) || pattern.test(source));
}

function relativeImports(file: string, source: string, root: string): string[] {
    const result: string[] = [];
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g)) {
        const base = relative(root, resolve(root, dirname(file), match[1]));
        const sourceBase = base.replace(/\.(?:mjs|cjs|js|jsx)$/, '');
        result.push(
            base,
            `${sourceBase}.ts`,
            `${sourceBase}.tsx`,
            `${sourceBase}.json`,
            join(sourceBase, 'index.ts')
        );
    }
    return result;
}

export function deriveHistory(
    root: string,
    files: readonly string[],
    readFile: (path: string) => string
): string[] {
    const tracked = new Set(files);
    const sources = new Map<string, string>();
    const getSource = (file: string) => {
        if (!tracked.has(file)) return undefined;
        if (!sources.has(file)) {
            try {
                sources.set(file, readFile(file));
            } catch {
                return undefined;
            }
        }
        return sources.get(file);
    };
    const tests = files.filter((file) => /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file));
    const result = new Set<string>();
    for (const test of tests) {
        const queue: { readonly file: string; readonly depth: number }[] = [
            { file: test, depth: 0 }
        ];
        const seen = new Set<string>();
        let importedHistory = false;
        while (queue.length) {
            const next = queue.shift();
            if (!next) break;
            const { file: current, depth } = next;
            if (seen.has(current)) continue;
            seen.add(current);
            const source = getSource(current);
            if (!source) continue;
            if (current !== test && current.startsWith('packages/seed/src/data-migrations/'))
                importedHistory = true;
            const directMigrationRead =
                /(?:readFileSync|readFile)\([\s\S]{0,240}?(?:join|resolve)\([^)]*['"]data-migrations\/[0-9]{4}[-.]/.test(
                    source
                ) ||
                /(?:readFileSync|readFile)\([\s\S]{0,240}?(?:join|resolve)\([^)]*['"]data-migrations['"]\s*,\s*['"][0-9]{4}[-.]/.test(
                    source
                );
            const migrationPathVars = [
                ...source.matchAll(
                    /(?:const|let|var)\s+(\w+)\s*=\s*(?:join|resolve)\([\s\S]{0,240}?['"]data-migrations(?:\/|['"])/g
                )
            ].map((match) => match[1] ?? '');
            const variableMigrationRead = migrationPathVars.some((name) =>
                new RegExp(`(?:readFileSync|readFile)\\(\\s*${name}\\b`).test(source)
            );
            if (directMigrationRead || variableMigrationRead) importedHistory = true;
            for (const imported of relativeImports(current, source, root)) {
                if (imported.startsWith('packages/seed/src/data-migrations/'))
                    importedHistory = true;
                if (
                    depth === 0 &&
                    tracked.has(imported) &&
                    imported !== 'scripts/check-venue-retired-word.ts'
                )
                    queue.push({ file: imported, depth: 1 });
            }
        }
        const combined = [...seen].map((file) => sources.get(file) ?? '').join('\n');
        const journalEntries = ['journal', 'entries'].join('.');
        const journalFile = ['_', 'journal', '.json'].join('');
        const hasJournal = new RegExp(`${journalEntries}|${journalFile}`).test(combined);
        const hasBoundedTag = new RegExp(
            `${['entries', '[\\s\\S]{0,500}?filter\\([\\s\\S]{0,220}?\\.idx\\s<'].join('')}`
        ).test(combined);
        const appliesMigration =
            /await\s+apply\([^)]*\.tag\)|readFileSync\([^)]*\$\{entry\.tag\}\.sql|query\(statement\)/.test(
                combined
            );
        if (importedHistory || (hasJournal && hasBoundedTag && appliesMigration)) result.add(test);
    }
    return [...result].sort();
}

function scanValueJson(
    file: string,
    source: string,
    allowed: Exemption,
    used: Map<string, number>
): Violation[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return [];
    }
    const hits: Violation[] = [];
    const walk = (value: unknown, keyPath: string[]) => {
        if (typeof value === 'string' && /[Gg]astronom[ií]a/.test(value)) {
            const key = keyPath.join('.');
            const exceptionKey = `${file}#${key}`;
            if (allowed.keys?.[exceptionKey] === undefined)
                hits.push({ file, line: 1, rule: 5, text: `${key}: ${value}` });
            else used.set(exceptionKey, (used.get(exceptionKey) ?? 0) + 1);
        }
        if (value && typeof value === 'object')
            for (const [key, child] of Object.entries(value)) walk(child, [...keyPath, key]);
    };
    walk(parsed, []);
    return hits;
}

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
    readonly history: readonly string[];
} {
    const config = getConfig(root);
    const tracked = injectedFiles ?? gitFiles(root);
    const history = deriveHistory(root, tracked, readFile);
    const scannedPaths = tracked.filter(
        (file) => !outOfScan(file) && !history.includes(file) && !EXEMPT_FILES.includes(file)
    );
    if (!injectedFiles && scannedPaths.length < SCAN_FLOOR)
        return {
            exitCode: 1,
            output: `Scan floor failed: ${scannedPaths.length} < ${SCAN_FLOOR}`,
            violations: [],
            history: []
        };
    const historyWordFiles = history.filter((file) => hasRetiredRuleHit(file, readFile(file)));
    const violations: Violation[] = [];
    const observedCounts = new Map<string, number>();
    const usedKeys = new Map<string, number>();
    const markerLinesByFile = new Map<string, number>();
    const validMarkerLinesByFile = new Map<string, number>();
    const exemptions = config.exemptions;
    const mark = (id: string) => observedCounts.set(id, (observedCounts.get(id) ?? 0) + 1);
    const exceptionFor = (file: string) =>
        Object.entries(exemptions).find(([, entry]) => entry.files?.[file] !== undefined)?.[0];
    for (const file of tracked) {
        if (outOfScan(file) || history.includes(file) || EXEMPT_FILES.includes(file)) continue;
        const content = readFile(file);
        const binary = content.includes('\0');
        const rows = binary ? [] : content.split('\n');
        const pathRules = [
            IDENTIFIER,
            new RegExp(
                `/(?:es|en|pt)/${['gastro', 'nomia'].join('')}(?:/|$)|(?:planes|presentacion|publicar)/${['gastro', 'nomia'].join('')}`,
                'g'
            ),
            /(?:^|[^A-Za-z])gastro-|(?:^|[^A-Za-z])-gastro(?:$|[^A-Za-z])/g,
            /(?:^|\/)[a-z-]*restaurante(?:\/|$)|publicar-restaurante/g
        ];
        pathRules.forEach((rule) => {
            for (const match of file.matchAll(new RegExp(rule.source, 'g'))) {
                const exemption = exceptionFor(file);
                if (exemption) mark(`${exemption}:${file}`);
                else
                    violations.push({
                        file,
                        line: 0,
                        rule: pathRules.indexOf(rule) + 1,
                        text: match[0]
                    });
            }
        });
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index] ?? '';
            const hasMarker = row.includes(legacyMarker);
            if (hasMarker) markerLinesByFile.set(file, (markerLinesByFile.get(file) ?? 0) + 1);
            const rowMatches: { readonly rule: number; readonly text: string }[] = [];
            const rules = [
                new RegExp(IDENTIFIER.source, 'g'),
                new RegExp(
                    `/(?:es|en|pt)/${['gastro', 'nomia'].join('')}(?:/|$)|(?:planes|presentacion|publicar)/${['gastro', 'nomia'].join('')}`,
                    'g'
                ),
                /(?:^|[^A-Za-z])gastro-|(?:^|[^A-Za-z])-gastro(?:[^A-Za-z]|$)/g,
                /(?:^|\/)[a-z-]*restaurante(?:\/|$)|publicar-restaurante/g
            ];
            rules.forEach((rule, offset) => {
                for (const match of row.matchAll(new RegExp(rule.source, 'g'))) {
                    rowMatches.push({ rule: offset + 1, text: match[0] });
                }
            });
            const markerWordPattern = new RegExp(
                `${IDENTIFIER.source}|${['gastro', 'nomia'].join('')}|(?:^|[^A-Za-z])gastro-|(?:^|[^A-Za-z])-gastro(?:$|[^A-Za-z])`,
                'i'
            );
            if (hasMarker) {
                if (markerWordPattern.test(row))
                    validMarkerLinesByFile.set(file, (validMarkerLinesByFile.get(file) ?? 0) + 1);
                else
                    violations.push({
                        file,
                        line: index + 1,
                        rule: 0,
                        text: 'legacy-name-allowed marker has no occurrence on its line'
                    });
            }
            const markerListed =
                hasMarker &&
                (exemptions.c?.markers?.[file] !== undefined ||
                    exemptions.e?.markers?.[file] !== undefined);
            if (markerListed)
                mark(`${exemptions.c?.markers?.[file] === undefined ? 'e' : 'c'}:${file}`);
            for (const match of rowMatches) {
                const exemption = exceptionFor(file);
                if (exemption) mark(`${exemption}:${file}`);
                else if (markerListed) continue;
                else violations.push({ file, line: index + 1, rule: match.rule, text: match.text });
            }
        }
        if (!binary && file.startsWith('packages/i18n/src/locales/') && file.endsWith('.json'))
            violations.push(
                ...scanValueJson(
                    file,
                    content,
                    { keys: { ...exemptions.a?.keys, ...exemptions.b?.keys } },
                    usedKeys
                )
            );
        if (!binary && file.startsWith('packages/notifications/src/')) {
            for (const item of lineHits(file, content, /[Gg]astronom[ií]a/g)) {
                const key = `${file}#${item.line}`;
                const exemption = Object.entries(exemptions).find(
                    ([, entry]) => entry.keys?.[key] !== undefined
                )?.[0];
                if (exemption)
                    usedKeys.set(
                        `${exemption}:${key}`,
                        (usedKeys.get(`${exemption}:${key}`) ?? 0) + 1
                    );
                else violations.push({ ...item, rule: 5 });
            }
        }
    }
    for (const name of Object.keys(exemptions))
        if (!['a', 'b', 'c', 'd', 'e'].includes(name))
            violations.push({
                file: CONFIG,
                line: 1,
                rule: 0,
                text: `unexpected exemption ${name}`
            });
    if (Object.keys(exemptions).length !== 5)
        violations.push({
            file: CONFIG,
            line: 1,
            rule: 0,
            text: 'expected exactly five exemptions'
        });
    if (config.ledgerFingerprint !== ledgerFingerprint(exemptions))
        violations.push({
            file: CONFIG,
            line: 1,
            rule: 0,
            text: 'closed exemption path/key ledger changed'
        });
    if (history.length !== config.historyCount)
        violations.push({
            file: CONFIG,
            line: 1,
            rule: 0,
            text: `derived history count expected ${config.historyCount}, found ${history.length}`
        });
    if (historyWordFiles.length !== config.historyWordFiles)
        violations.push({
            file: CONFIG,
            line: 1,
            rule: 0,
            text: `derived history files with retired word expected ${config.historyWordFiles}, found ${historyWordFiles.length}`
        });
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
        const entry = exemptions[name];
        if (!entry) continue;
        for (const [file, expected] of Object.entries(entry.files ?? {})) {
            const found = observedCounts.get(`${name}:${file}`) ?? 0;
            if (found !== expected)
                violations.push({
                    file,
                    line: 1,
                    rule: 0,
                    text: `exemption ${name} count expected ${expected}, found ${found}`
                });
        }
        for (const [key, expected] of Object.entries(entry.keys ?? {})) {
            const found = usedKeys.get(`${name}:${key}`) ?? usedKeys.get(key) ?? 0;
            if (found !== expected) {
                const [file, keyName] = key.split('#');
                violations.push({
                    file: file ?? CONFIG,
                    line: 1,
                    rule: 0,
                    text: `exemption ${name} key ${keyName ?? key} count expected ${expected}, found ${found}`
                });
            }
        }
        for (const [file, expected] of Object.entries(entry.markers ?? {})) {
            const found = markerLinesByFile.get(file) ?? 0;
            const valid = validMarkerLinesByFile.get(file) ?? 0;
            if (found !== expected || valid !== expected)
                violations.push({
                    file,
                    line: 1,
                    rule: 0,
                    text: `exemption ${name} marker count expected ${expected}, found ${found} markers / ${valid} occurrences`
                });
        }
    }
    const values = tracked.filter(
        (file) =>
            file.startsWith('packages/db/src/migrations/') &&
            MIGRATIONS.some((prefix) => file.split('/').at(-1)?.startsWith(prefix))
    );
    const valuePattern = new RegExp(`${IDENTIFIER.source}|${PARTS[0]}[ií]a`, 'i');
    for (const file of values) {
        const text = readFile(file);
        for (const match of text.matchAll(/'(?:''|[^'])*'/g)) {
            if (valuePattern.test(match[0]))
                violations.push({
                    file,
                    line: text.slice(0, match.index).split('\n').length,
                    rule: 6,
                    text: match[0]
                });
        }
    }
    const historySummary = `Historia derivada ${history.length} (con palabra ${historyWordFiles.length}): ${history.join(', ')}`;
    const output = violations.length
        ? `${violations.map((item) => `${item.file}:${item.line}: regla ${item.rule}: ${item.text}`).join('\n')}\n${historySummary}`
        : `G-FAC-R1: ${scannedPaths.length} archivos; exenciones ${['a', 'b', 'c', 'd', 'e']
              .map((name) => {
                  const entry = exemptions[name];
                  const total = [
                      ...Object.values(entry?.files ?? {}),
                      ...Object.values(entry?.keys ?? {}),
                      ...Object.values(entry?.markers ?? {})
                  ].reduce((sum, value) => sum + value, 0);
                  return `${name}=${total}`;
              })
              .join(', ')}; ${historySummary}`;
    return { exitCode: violations.length ? 1 : 0, output, violations, history };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    process.stdout.write(`${result.output}\n`);
    process.exitCode = result.exitCode;
}

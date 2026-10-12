import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * AC:U3:10 (HOS-1429, U3.4): automated half of the U3 exit. The manual half is TEST:U3:11 and
 * TEST:U3:12, run by the owner (scripts/cutover/README.md).
 *
 * It pins three things the exit demands and no other test holds: the eleven automated tests of
 * the unit are present and name their AC, no image carries `scripts/` (AC:U3:6), and no
 * `check:*` guard names the cutover folder (the unit adds no guards).
 *
 * It reads files of the repo only: no network, no database, no environment variables.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const thisFile = path.basename(fileURLToPath(import.meta.url));
const testDirs: readonly string[] = [
    path.join(repoRoot, 'scripts/__tests__/cutover'),
    path.join(repoRoot, 'scripts/__tests__/cutover-db')
];

/**
 * The automated tests of the unit and the AC each one covers (spec U3, "Testing esperado").
 * TEST:U3:11 and TEST:U3:12 are manual smokes run by the owner, so they are NOT in this map.
 */
const EXIT_MAP: Readonly<Record<string, string>> = {
    'TEST:U3:1': 'AC:U3:1',
    'TEST:U3:2': 'AC:U3:2',
    'TEST:U3:3': 'AC:U3:3',
    'TEST:U3:4': 'AC:U3:4',
    'TEST:U3:5': 'AC:U3:4',
    'TEST:U3:6': 'AC:U3:5',
    'TEST:U3:7': 'AC:U3:6',
    'TEST:U3:8': 'AC:U3:7',
    'TEST:U3:9': 'AC:U3:8',
    'TEST:U3:10': 'AC:U3:9',
    'TEST:U3:13': 'AC:U3:2'
};

/** The manual smokes: nobody may claim them as automated. */
const MANUAL_SMOKES: readonly string[] = ['TEST:U3:11', 'TEST:U3:12'];

const DESCRIBE_PATTERN = /\bdescribe\(\s*(['"`])(TEST:U3:\d+)\b([^'"`]*)\1/g;

interface DescribeTitle {
    readonly dir: string;
    readonly file: string;
    readonly id: string;
    readonly rest: string;
}

function readDescribeTitles(): readonly DescribeTitle[] {
    const out: DescribeTitle[] = [];
    for (const dir of testDirs) {
        const files = readdirSync(dir)
            .filter((f) => f.endsWith('.test.ts') && f !== thisFile)
            .sort();
        for (const file of files) {
            const text = readFileSync(path.join(dir, file), 'utf8');
            for (const match of text.matchAll(DESCRIBE_PATTERN)) {
                out.push({
                    dir: path.basename(dir),
                    file,
                    id: match[2] ?? '',
                    rest: match[3] ?? ''
                });
            }
        }
    }
    return out;
}

interface CopyLine {
    readonly sources: readonly string[];
    readonly fromStage: boolean;
}

/** Parses one Dockerfile line; returns undefined when it is not a `COPY`. */
function parseCopy(line: string): CopyLine | undefined {
    const match = /^\s*COPY\s+(.+?)\s*$/i.exec(line);
    if (match === null) return undefined;
    const tokens = (match[1] ?? '').split(/\s+/).filter((t) => t.length > 0);
    const options = tokens.filter((t) => t.startsWith('--'));
    const args = tokens.filter((t) => !t.startsWith('--'));
    return {
        // The last argument is the destination; the rest are sources.
        sources: args.slice(0, -1),
        fromStage: options.some((o) => o.startsWith('--from='))
    };
}

/** True when a COPY from the build context brings in the repo root or the scripts folder. */
function copiesForbiddenSource(line: string): boolean {
    const copy = parseCopy(line);
    if (copy === undefined || copy.fromStage) return false;
    return copy.sources.some(
        (s) =>
            s === '.' ||
            s === './' ||
            s === 'scripts' ||
            s.startsWith('scripts/') ||
            s.includes('cutover')
    );
}

function dockerfiles(): readonly { readonly name: string; readonly text: string }[] {
    const appsDir = path.join(repoRoot, 'apps');
    return readdirSync(appsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(appsDir, e.name, 'Dockerfile'))
        .flatMap((file) => {
            try {
                return [{ name: path.relative(repoRoot, file), text: readFileSync(file, 'utf8') }];
            } catch {
                return [];
            }
        });
}

function packageScripts(): Readonly<Record<string, string>> {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
}

describe('AC:U3:10 the U3 exit, automated half (HOS-1429)', () => {
    describe('the automated tests of the unit are in the tree', () => {
        it('finds TEST:U3 describes in both test folders (the scanner is not blind)', () => {
            // Arrange / Act
            const titles = readDescribeTitles();
            // Assert
            expect(titles.some((t) => t.dir === 'cutover')).toBe(true);
            expect(titles.some((t) => t.dir === 'cutover-db')).toBe(true);
        });

        it('every automated TEST id opens at least one describe that names its AC', () => {
            // Arrange
            const titles = readDescribeTitles();
            // Act
            const problems: string[] = [];
            for (const [id, ac] of Object.entries(EXIT_MAP)) {
                const found = titles.filter((t) => t.id === id);
                if (found.length === 0) {
                    problems.push(`${id}: no describe opens with it`);
                } else if (!found.some((t) => t.rest.includes(`(${ac})`))) {
                    problems.push(`${id}: no describe title names (${ac})`);
                }
            }
            // Assert
            expect(problems).toEqual([]);
        });

        it('AC:U3:1 to AC:U3:9 are all covered by the map', () => {
            // Arrange
            const expected = Array.from({ length: 9 }, (_, i) => `AC:U3:${i + 1}`);
            // Act
            const covered = [...new Set(Object.values(EXIT_MAP))].sort();
            // Assert
            expect(covered).toEqual([...expected].sort());
        });

        it('no describe claims the manual smokes as automated', () => {
            // Arrange
            const titles = readDescribeTitles();
            // Act
            const claimed = titles.filter((t) => MANUAL_SMOKES.includes(t.id)).map((t) => t.id);
            // Assert
            expect(claimed).toEqual([]);
        });
    });

    describe('no image carries the cutover script (AC:U3:6)', () => {
        it('finds the Dockerfiles and their COPY lines (the scanner is not blind)', () => {
            // Arrange / Act
            const files = dockerfiles();
            // Assert
            expect(files.length).toBeGreaterThanOrEqual(3);
            for (const file of files) {
                const copies = file.text.split('\n').filter((l) => parseCopy(l) !== undefined);
                expect(copies.length, file.name).toBeGreaterThan(0);
            }
        });

        it('no COPY from the build context brings the root or scripts/', () => {
            // Arrange
            const files = dockerfiles();
            // Act
            const offending = files.flatMap((f) =>
                f.text
                    .split('\n')
                    .filter(copiesForbiddenSource)
                    .map((l) => `${f.name}: ${l.trim()}`)
            );
            // Assert
            expect(offending).toEqual([]);
        });

        it('the rule rejects what it forbids and lets the normal lines through', () => {
            // Arrange
            const forbidden = [
                'COPY . .',
                'COPY ./ /repo',
                'COPY scripts scripts',
                'COPY scripts/cutover ./x',
                'COPY --chown=node:node scripts ./s'
            ];
            const allowed = [
                'COPY apps apps',
                'COPY packages packages',
                'COPY --from=build /repo/apps/admin/.output ./.output'
            ];
            // Act / Assert
            expect(forbidden.filter((l) => !copiesForbiddenSource(l))).toEqual([]);
            expect(allowed.filter(copiesForbiddenSource)).toEqual([]);
        });
    });

    describe('the unit adds no guards', () => {
        it('no check:* script, and not check:guards, names the cutover folder', () => {
            // Arrange
            const scripts = packageScripts();
            // Act
            const checks = Object.entries(scripts).filter(([name]) => name.startsWith('check:'));
            const naming = checks
                .filter(([, value]) => value.includes('cutover'))
                .map(([name]) => name);
            // Assert
            expect(checks.length).toBeGreaterThan(0);
            expect(naming).toEqual([]);
            expect(scripts['check:guards']).toBeDefined();
            expect(scripts['check:guards']).not.toContain('cutover');
        });

        it('the only script that mentions cutover is test:cutover-db', () => {
            // Arrange
            const scripts = packageScripts();
            // Act
            const mentioning = Object.entries(scripts)
                .filter(([name, value]) => name.includes('cutover') || value.includes('cutover'))
                .map(([name]) => name);
            // Assert
            expect(mentioning).toEqual(['test:cutover-db']);
        });
    });
});

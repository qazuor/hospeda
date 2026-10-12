/** TEST:V6:16 — GUARD:G-R6-B: the four halves of the closed list of listing.inactive_since. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { HALF_LABELS, INVENTORY_PATH, PENDING_CEILING, run } from '../check-listing-clock';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_INVENTORY = readFileSync(path.join(REPO_ROOT, INVENTORY_PATH), 'utf8');
type Inventory = Record<string, Record<string, unknown>[]>;
const parsed = (): Inventory => JSON.parse(REAL_INVENTORY) as Inventory;

const COVERAGE = 'packages/verticals/src/publication/coverage-recalculation.ts';
const ARCHIVE = 'packages/verticals/src/publication/archive-inactive-listing.ts';
const COLUMNS = 'packages/db/src/schemas/listing/listing-publication-columns.ts';

/** Every file the real inventory names, plus the column definition: the green baseline. */
const BASE_FILES = [
    ...new Set(
        ['writers', 'readers', 'transport', 'cutTool']
            .flatMap((list) => parsed()[list] ?? [])
            .map((row) => String(row.file))
            .concat(COLUMNS)
    )
];

const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function real(file: string): string {
    return readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/** Replaces exactly one occurrence, so a drifted anchor fails the test instead of passing it. */
function replaceOnce(source: string, from: string | RegExp, to: string): string {
    const matches =
        typeof from === 'string'
            ? source.split(from).length - 1
            : (source.match(new RegExp(from, 'g')) ?? []).length;
    expect(matches).toBe(1);
    return source.replace(from, to);
}

function check(
    args: {
        readonly files?: Readonly<Record<string, string>>;
        readonly inventory?: Inventory;
        readonly minScannedFiles?: number;
    } = {}
) {
    const root = mkdtempSync(path.join(tmpdir(), 'g-r6-b-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    const base = Object.fromEntries(BASE_FILES.map((file) => [file, real(file)]));
    const inventory = args.inventory ? JSON.stringify(args.inventory) : REAL_INVENTORY;
    const all = { ...base, [INVENTORY_PATH]: inventory, ...args.files };
    for (const [file, source] of Object.entries(all)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return run({ root, minScannedFiles: args.minScannedFiles ?? 1 });
}

const label = (half: keyof typeof HALF_LABELS) => `"${HALF_LABELS[half]}"`;

describe('TEST:V6:16 GUARD:G-R6-B - the four halves of the closed list of listing.inactive_since', () => {
    it('accepts the repository tree, with PB11 and the reconciler (facts 2 and 5) admitted', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/^OK GUARD:G-R6-B: \d+ production files scanned; /);
        expect(result.output).toContain(
            'consumers implemented: PB4, PB5, ARCHIVE_NOTICE_DATE; pending (V9b): PB9, NOTICE_BEFORE_DAY_90, NOTICE_BEFORE_DAY_180'
        );
        const writers = parsed().writers ?? [];
        const facts = (symbol: string) =>
            writers.find((row) => row.symbol === symbol)?.facts as unknown[];
        expect(facts('liftModeration')).toContain(6);
        expect(facts('recalculateCoverage')).toEqual(expect.arrayContaining([2, 5]));
    });

    it('accepts the baseline tree the other cases mutate', () => {
        expect(check()).toEqual(expect.objectContaining({ exitCode: 0 }));
    });

    describe('half (a) "escritor fuera de la lista"', () => {
        it('rejects the surplus branch of PB2 writing the clock', () => {
            const mutated = replaceOnce(
                real(COVERAGE),
                /to: PublicationStatusEnum\.UNPUBLISHED_BY_BILLING\n(\s*)\}\);/,
                'to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,\n$1    inactiveSince: at\n$1});'
            );
            const result = check({ files: { [COVERAGE]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `FAIL GUARD:G-R6-B half (a) ${label('a')}: ${COVERAGE}:`
            );
            expect(result.output).toContain(
                'recalculateCoverage has 5 clock writes, the list admits 4'
            );
        });

        it('rejects deadlinesVersion written alone through Drizzle', () => {
            const file = 'packages/service-core/src/services/x/bump.ts';
            const result = check({
                files: {
                    [file]:
                        "import { accommodations } from '@repo/db';\n" +
                        'export async function bump(db: Db) {\n' +
                        '    await db.update(accommodations).set({ deadlinesVersion: 2 });\n' +
                        '}\n'
                }
            });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `half (a) ${label('a')}: ${file}:3 bump writes listing.deadlines_version without listing.inactive_since`
            );
        });

        it('rejects deadlines_version written alone in a SQL literal', () => {
            const file = 'packages/service-core/src/services/x/bump-sql.ts';
            const result = check({
                files: {
                    [file]:
                        'export async function bumpSql(db: Db) {\n' +
                        '    await db.execute(`UPDATE accommodations SET deadlines_version = 2`);\n' +
                        '}\n'
                }
            });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `${file}:2 bumpSql writes listing.deadlines_version without listing.inactive_since`
            );
        });

        it('rejects a default on the column definition', () => {
            const mutated = replaceOnce(
                real(COLUMNS),
                "timestamp('inactive_since', { withTimezone: true }).notNull()",
                "timestamp('inactive_since', { withTimezone: true }).notNull().defaultNow()"
            );
            const result = check({ files: { [COLUMNS]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(`half (a) ${label('a')}: ${COLUMNS}:`);
        });
    });

    describe('half (b) "lector fuera del inventario"', () => {
        it('rejects a new function comparing listing.inactiveSince', () => {
            const file = 'packages/verticals/src/publication/sneaky.ts';
            const result = check({
                files: {
                    [file]:
                        'export function sneaky(listing: { inactiveSince: Date }, cutoff: Date) {\n' +
                        '    if (listing.inactiveSince < cutoff) return true;\n' +
                        '    return false;\n' +
                        '}\n'
                }
            });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `FAIL GUARD:G-R6-B half (b) ${label('b')}: ${file}:2 sneaky`
            );
        });

        it('rejects a WHERE on inactive_since in a model', () => {
            const file = 'packages/db/src/models/listing/listing-stale.model.ts';
            const result = check({
                files: {
                    [file]:
                        'export async function listStale(tx: Tx) {\n' +
                        '    return tx.execute(sql`SELECT id FROM accommodations WHERE inactive_since < now()`);\n' +
                        '}\n'
                }
            });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(`half (b) ${label('b')}: ${file}:2 listStale`);
        });
    });

    it('half (c) "lector declarado que ya no lee": PB4 stops reading the clock', () => {
        const mutated = replaceOnce(
            real(ARCHIVE),
            'inactiveSince: listing.inactiveSince,',
            'inactiveSince: listing.createdAt,'
        );
        const result = check({ files: { [ARCHIVE]: mutated } });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL GUARD:G-R6-B half (c) ${label('c')}: consumer PB4 (${ARCHIVE} archiveInactiveListing)`
        );
        expect(result.output).toContain('consumer PB5');
        expect(result.output).toContain('consumer ARCHIVE_NOTICE_DATE');
    });

    describe('half (d) "lector de retención que no pregunta por la pausa"', () => {
        it('rejects PB5 without the retentionStopped query', () => {
            const mutated = replaceOnce(
                real(ARCHIVE),
                /const pause = await args\.billing\.retentionStopped\(\{[\s\S]*?\}\);\n\s*if \(pause\.stopped\)[^\n]*\n/,
                ''
            );
            const result = check({ files: { [ARCHIVE]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `FAIL GUARD:G-R6-B half (d) ${label('d')}: consumer PB5 (${ARCHIVE}:`
            );
            expect(result.output).toContain(
                'archiveInactiveListing) does not ask retentionStopped'
            );
        });

        it('rejects counting only from inactive_since', () => {
            const mutated = replaceOnce(
                real(ARCHIVE),
                /retentionClockStart\(\{\s*inactiveSince: listing\.inactiveSince,\s*pauseEndedAt: pause\.pauseEndedAt\s*\}\)/,
                'listing.inactiveSince'
            );
            const result = check({ files: { [ARCHIVE]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(`half (d) ${label('d')}: consumer PB4`);
            expect(result.output).toContain(
                'archiveInactiveListing) does not count from the later of inactive_since and pauseEndedAt'
            );
        });

        it('rejects a null pauseEndedAt', () => {
            const mutated = replaceOnce(
                real(ARCHIVE),
                'pauseEndedAt: pause.pauseEndedAt',
                'pauseEndedAt: null'
            );
            const result = check({ files: { [ARCHIVE]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                'does not count from the later of inactive_since and pauseEndedAt'
            );
        });
    });

    describe('fails closed on a broken inventory or scan', () => {
        const expectInventoryFailure = (inventory: Inventory, text: string) => {
            const result = check({ inventory });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('FAIL GUARD:G-R6-B inventory: ');
            expect(result.output).toContain(text);
        };

        it('rejects a row without spec', () => {
            const inventory = parsed();
            delete (inventory.writers?.[0] as Record<string, unknown>).spec;
            expectInventoryFailure(inventory, 'has no "spec"');
        });

        it('rejects a seventh consumer', () => {
            const inventory = parsed();
            inventory.implementedConsumers?.push({ id: 'PB10', spec: 'x.md:1' });
            expectInventoryFailure(inventory, 'must be exactly the six consumers');
        });

        it('rejects a second cutTool row', () => {
            const inventory = parsed();
            const row = inventory.cutTool?.[0] as Record<string, unknown>;
            inventory.cutTool?.push({ ...row, symbol: 'another' });
            expectInventoryFailure(inventory, 'more than one cutTool row');
        });

        it('rejects a transport row outside the listing models', () => {
            const inventory = parsed();
            inventory.transport?.push({
                file: 'packages/service-core/src/x.ts',
                symbol: 'x',
                count: 0,
                spec: 'x.md:1'
            });
            expectInventoryFailure(inventory, 'is outside packages/db/src/models/listing/');
        });

        it('rejects pending consumers above the ceiling', () => {
            const inventory = parsed();
            inventory.pendingConsumers?.push({ id: 'PB4', owner: 'V9b', spec: 'x.md:1' });
            expectInventoryFailure(inventory, `exceed ceiling ${PENDING_CEILING}`);
        });

        it('rejects an unreadable inventory', () => {
            const result = check({ files: { [INVENTORY_PATH]: '{ not json' } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                'FAIL GUARD:G-R6-B inventory: inventory cannot be loaded'
            );
        });

        it('rejects a scan that is too small', () => {
            const result = check({ minScannedFiles: 1000 });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('FAIL GUARD:G-R6-B scan: ');
        });

        it('reports a writer row whose sites disappeared as stale, not as one of the halves', () => {
            const file = 'packages/verticals/src/publication/publish-listing.ts';
            const mutated = replaceOnce(
                real(file),
                /\n\s*inactiveSince: at,\n(\s*actorId)/,
                '\n$1'
            );
            const result = check({ files: { [file]: mutated } });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                `FAIL GUARD:G-R6-B stale inventory row: writer ${file}|publishListing`
            );
        });
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:listing-clock']).toBe('tsx scripts/check-listing-clock.ts');
        expect(scripts['check:guards']).toContain(
            'pnpm check:purged-closed-list && pnpm check:listing-clock && pnpm check:fake-lies'
        );
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toBeDefined();
        expect(guardsJob).toContain(
            'name: Check the closed lists of listing.inactive_since (GUARD:G-R6-B)'
        );
        expect(guardsJob).toContain('run: pnpm check:listing-clock');
    });
});

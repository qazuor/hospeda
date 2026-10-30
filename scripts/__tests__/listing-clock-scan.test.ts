/** The pure cases of the GUARD:G-R6-B scanner (TEST:V6:16 support). */
import { describe, expect, it } from 'vitest';
import { scanFile } from '../listing-clock-scan';

const VERTICALS = 'packages/verticals/src/publication/x.ts';
const MODELS = 'packages/db/src/models/listing/x.model.ts';
const SCHEMAS = 'packages/db/src/schemas/listing/x.ts';

function sites(file: string, source: string) {
    return scanFile({ file, source }).sites.map(
        ({ kind, column, line, symbol, context, writesClockToo, clockUse }) => ({
            kind,
            column,
            line,
            symbol,
            context,
            writesClockToo,
            clockUse
        })
    );
}

describe('listing-clock-scan: writes', () => {
    it('W1: inactiveSince in the setPublicationStatus argument', () => {
        expect(
            sites(
                VERTICALS,
                'export async function f(tx) {\n    await tx.setPublicationStatus({ to, inactiveSince: at });\n}\n'
            )
        ).toEqual([
            expect.objectContaining({
                kind: 'write',
                column: 'inactive_since',
                line: 2,
                symbol: 'f',
                context: 'W1 setPublicationStatus'
            })
        ]);
    });

    it('W2: every stampInactiveSince call, inside the enclosing method', () => {
        const source =
            'export const port = {\n    async stamp(input) {\n        await model.stampInactiveSince(input);\n    }\n};\n';
        expect(sites(VERTICALS, source)).toEqual([
            expect.objectContaining({
                kind: 'write',
                line: 3,
                symbol: 'stamp',
                context: 'W2 stampInactiveSince'
            })
        ]);
    });

    it("W3': deadlinesVersion in .values() of a listing table, with and without the clock", () => {
        const source =
            'export async function seed(db) {\n' +
            '    await db.insert(venues).values({ inactiveSince: now, deadlinesVersion: 1 });\n' +
            '    await db.update(experiences).set({ deadlinesVersion: 2 });\n' +
            '}\n';
        const found = sites('packages/seed/src/example/x.ts', source);
        expect(found).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    column: 'deadlines_version',
                    line: 2,
                    writesClockToo: true
                }),
                expect.objectContaining({
                    column: 'deadlines_version',
                    line: 3,
                    writesClockToo: false
                }),
                expect.objectContaining({ column: 'inactive_since', line: 2 })
            ])
        );
        expect(found).toHaveLength(3);
    });

    it('W4: a SQL assignment before WHERE and an INSERT column list, never after WHERE', () => {
        const source =
            'export async function f(tx) {\n' +
            '    await tx.execute(sql`UPDATE accommodations SET inactive_since = now(), deadlines_version = 1 WHERE id = $' +
            '{id}`);\n' +
            "    await tx.execute('INSERT INTO experiences (id, inactive_since) VALUES ($1, now())');\n" +
            '    await tx.execute(sql`SELECT id FROM venues WHERE deadlines_version = 1`);\n' +
            '}\n';
        expect(
            sites('packages/service-core/src/x.ts', source).filter((s) => s.kind === 'write')
        ).toEqual([
            expect.objectContaining({ column: 'inactive_since', line: 2, writesClockToo: true }),
            expect.objectContaining({ column: 'deadlines_version', line: 2, writesClockToo: true }),
            expect.objectContaining({ column: 'inactive_since', line: 3 })
        ]);
    });

    it('W5: UPDATE <listing> SET in a migration, even after a WHERE inside a subquery; ADD COLUMN is not a write', () => {
        const source =
            'ALTER TABLE "accommodations" ADD COLUMN "inactive_since" timestamp;\n' +
            'UPDATE venues g SET publication_status = (SELECT 1 WHERE true),\n' +
            '    inactive_since = now(), deadlines_version = 1;\n';
        const found = scanFile({ file: 'packages/db/src/migrations/9999_x.sql', source }).sites;
        expect(found.map((s) => [s.column, s.line, s.symbol, s.writesClockToo])).toEqual([
            ['inactive_since', 3, '<module>', true],
            ['deadlines_version', 3, '<module>', true]
        ]);
    });

    it('the column definition is not a site unless it carries a default', () => {
        const plain =
            "export const c = { inactiveSince: timestamp('inactive_since').notNull() };\n";
        expect(sites(SCHEMAS, plain)).toEqual([]);
        expect(
            sites(SCHEMAS, plain.replace('.notNull()', '.notNull().$defaultFn(() => new Date())'))
        ).toEqual([expect.objectContaining({ kind: 'write', column: 'inactive_since' })]);
    });
});

describe('listing-clock-scan: reads', () => {
    it('R1 reads, and how the retention clock is counted', () => {
        const source =
            'export async function decide(listing, pause) {\n' +
            '    retentionClockStart({ inactiveSince: listing.inactiveSince, pauseEndedAt: pause.pauseEndedAt });\n' +
            '    retentionClockStart({ inactiveSince: listing.inactiveSince, pauseEndedAt: null });\n' +
            "    return listing['inactiveSince'];\n" +
            '}\n';
        expect(sites(VERTICALS, source)).toEqual([
            expect.objectContaining({ kind: 'read', line: 2, clockUse: 'later-of-both' }),
            expect.objectContaining({ kind: 'read', line: 3, clockUse: 'without-pause' }),
            expect.objectContaining({ kind: 'read', line: 4, clockUse: 'bare' })
        ]);
    });

    it('R2: after WHERE or next to an operator is a read; in a SELECT list it is transport', () => {
        const source =
            'export async function f(tx) {\n' +
            '    await tx.execute(sql`SELECT l.inactive_since AS "inactiveSince" FROM accommodations l`);\n' +
            '    await tx.execute(sql`SELECT id FROM accommodations l WHERE l.deleted_at IS NULL AND l.inactive_since < now()`);\n' +
            "    await tx.execute(sql`SELECT l.inactive_since + interval '1 day' FROM accommodations l`);\n" +
            '}\n';
        expect(sites(MODELS, source).map((s) => [s.kind, s.line])).toEqual([
            ['read', 3],
            ['read', 4]
        ]);
    });

    it('records which symbols ask retentionStopped', () => {
        const source =
            'export async function decide(billing) {\n    await billing.retentionStopped({});\n}\n';
        expect(scanFile({ file: VERTICALS, source }).retentionStoppedSymbols).toEqual(['decide']);
    });
});

describe('listing-clock-scan: what is not a site', () => {
    it('ignores oldInactiveSince, the event arguments, type positions and comments', () => {
        const source =
            '// listing.inactiveSince = x; inactive_since = now()\n' +
            'type T = { inactiveSince: Date; v: typeof x.inactiveSince };\n' +
            'export async function f(tx, listing: { inactiveSince: Date }) {\n' +
            '    await tx.insertStatusChangedEvent({ oldInactiveSince: listing.inactiveSince, inactiveSince: at, x: listing.inactiveSince });\n' +
            '    const audit = { oldInactiveSince: listing.inactiveSince };\n' +
            '    return audit;\n' +
            '}\n';
        expect(sites(VERTICALS, source)).toEqual([]);
    });

    it('ignores the transport mapping of a model', () => {
        const source =
            'const row = (r) => ({ inactiveSince: new Date(String(r.inactiveSince)) });\n';
        expect(sites(MODELS, source)).toEqual([]);
    });

    it("ignores trial.deadlines_version and trial's deadlinesVersion", () => {
        const source =
            'export async function expire(db) {\n' +
            '    await db.update(trials).set({ deadlinesVersion: 2 });\n' +
            '    await db.execute(sql`UPDATE trial SET deadlines_version = 2`);\n' +
            '}\n';
        expect(sites('apps/api/src/utils/trial/x.ts', source)).toEqual([]);
    });

    it('scanTree skips test files (the filter lives in listScannedFiles)', async () => {
        const { listScannedFiles } = await import('../listing-clock-scan');
        const files = listScannedFiles({ root: new URL('../..', import.meta.url).pathname });
        expect(files.some((f) => /\.test\.ts$|\/test\//.test(f))).toBe(false);
        expect(files.some((f) => f.endsWith('.sql'))).toBe(true);
    });
});

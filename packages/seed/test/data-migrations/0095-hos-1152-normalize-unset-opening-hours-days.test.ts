/**
 * @fileoverview
 * Regression tests for `0095-hos-1152-normalize-unset-opening-hours-days`.
 *
 * The load-bearing test here is `parses against the real schema` below: it
 * asserts the migration's decision against the ACTUAL `OpeningHoursSchema` from
 * `@repo/schemas`, the same object `stripWithSchema` uses to strip the API
 * response. A legacy blob must fail it, and the normalized blob must pass. Every
 * other test in this file describes behaviour; that one is the reason the
 * migration exists, and it is the one that would have caught HOS-1152 before the
 * deploy.
 *
 * Asserting against the real schema rather than a local copy of the rule is
 * deliberate. A test that re-implemented "closed false and no shifts is invalid"
 * would agree with the migration forever, including on the day the refine
 * changes — which is precisely the mutation that must not pass unnoticed.
 *
 * WHAT THESE TESTS CANNOT SEE, stated so nobody mistakes them for full coverage:
 * `up()` is exercised against a fake `db`, so no SQL is ever planned or run. The
 * `WHERE opening_hours IS NOT NULL` predicate, the `::jsonb` cast and the
 * per-row `WHERE id = ...` are NOT evaluated here — they are verified by running
 * the migration against a database. What these cover is the orchestration: that
 * both listing tables are walked, that a row is written only when one of its days
 * actually changed, and that an already-clean database is not written to at all.
 *
 * @module test/data-migrations/0095-hos-1152-normalize-unset-opening-hours-days
 */
import { OpeningHoursSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0095-hos-1152-normalize-unset-opening-hours-days.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const { normalizeOpeningHoursDays } = migration;

/** A day the host really did fill in. */
const OPEN_DAY = { closed: false, shifts: [{ open: '09:00', close: '22:00' }] } as const;

/** A day the host really did mark closed. */
const CLOSED_DAY = { closed: true, shifts: [] } as const;

/** The shape HOS-906's refine rejects and this migration replaces. */
const UNDECIDED_DAY = { closed: false, shifts: [] } as const;

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Builds a full seven-day blob, defaulting every day to a real open schedule so
 * a test only has to name the days it wants to be different.
 */
function buildOpeningHours(overrides: Partial<Record<string, unknown>> = {}): {
    timezone: string;
    days: Record<string, unknown>;
} {
    const days: Record<string, unknown> = {};
    for (const key of DAY_KEYS) {
        days[key] = overrides[key] ?? OPEN_DAY;
    }
    return { timezone: 'America/Argentina/Buenos_Aires', days };
}

// ── The regression assertion ────────────────────────────────────────────────

describe('0095 — against the real OpeningHoursSchema', () => {
    it('rejects the legacy blob and accepts the normalized one', () => {
        // Exactly the staging failure: six days left undecided, monday real.
        const legacy = buildOpeningHours({
            tue: UNDECIDED_DAY,
            wed: UNDECIDED_DAY,
            thu: UNDECIDED_DAY,
            fri: UNDECIDED_DAY,
            sat: UNDECIDED_DAY,
            sun: UNDECIDED_DAY
        });

        const before = OpeningHoursSchema.safeParse(legacy);
        expect(before.success).toBe(false);
        if (before.success) return;

        // The six issues the API logged, on the paths it logged them on.
        expect(before.error.issues).toHaveLength(6);
        for (const issue of before.error.issues) {
            expect(issue.message).toBe('zodError.common.openingHours.day.notOpenOrClosed');
            expect(issue.path[0]).toBe('days');
            expect(issue.path[2]).toBe('closed');
        }

        const { next, changedDays } = normalizeOpeningHoursDays(legacy);
        expect(changedDays).toBe(6);

        const after = OpeningHoursSchema.safeParse(next);
        expect(after.success).toBe(true);
    });

    it('leaves a blob that already parses byte-identical', () => {
        const clean = buildOpeningHours({ sun: CLOSED_DAY });
        expect(OpeningHoursSchema.safeParse(clean).success).toBe(true);

        const { next, changedDays } = normalizeOpeningHoursDays(clean);
        expect(changedDays).toBe(0);
        // Reference-identical, not merely deep-equal: an unchanged row must not
        // be rewritten, and the caller decides that by `changedDays` alone.
        expect(next).toBe(clean);
    });
});

// ── What it must not touch ──────────────────────────────────────────────────

describe('0095 — what it leaves alone', () => {
    it('does not touch a day that carries a shift', () => {
        const hours = buildOpeningHours();
        const { next, changedDays } = normalizeOpeningHoursDays(hours);
        expect(changedDays).toBe(0);
        expect(next).toBe(hours);
    });

    it('does not touch a day already marked closed', () => {
        const hours = buildOpeningHours({ mon: CLOSED_DAY, tue: CLOSED_DAY });
        const { changedDays } = normalizeOpeningHoursDays(hours);
        expect(changedDays).toBe(0);
    });

    it('preserves the sibling keys and every untouched day', () => {
        const hours = {
            ...buildOpeningHours({ sat: UNDECIDED_DAY }),
            notes: 'Cerrado los feriados'
        };

        const { next } = normalizeOpeningHoursDays(hours) as {
            next: { timezone: string; notes: string; days: Record<string, unknown> };
        };

        expect(next.timezone).toBe('America/Argentina/Buenos_Aires');
        expect(next.notes).toBe('Cerrado los feriados');
        expect(next.days.mon).toEqual(OPEN_DAY);
        expect(next.days.sat).toEqual({ closed: true, shifts: [] });
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['an array', []],
        ['an object with no days', { timezone: 'UTC' }],
        ['days that is not an object', { days: 'nope' }]
    ])('returns %s unchanged instead of inventing a schedule', (_label, value) => {
        const { next, changedDays } = normalizeOpeningHoursDays(value);
        expect(changedDays).toBe(0);
        expect(next).toBe(value);
    });
});

// ── Shape edge cases ────────────────────────────────────────────────────────

describe('0095 — degraded day shapes', () => {
    it('treats a day with no shifts key as undecided and emits a valid one', () => {
        // A blob that predates the `shifts` key entirely: flipping `closed`
        // alone would leave it failing the schema for a different reason.
        const hours = buildOpeningHours({ wed: { closed: false } });
        const { next, changedDays } = normalizeOpeningHoursDays(hours);

        expect(changedDays).toBe(1);
        expect((next as { days: Record<string, unknown> }).days.wed).toEqual({
            closed: true,
            shifts: []
        });
        expect(OpeningHoursSchema.safeParse(next).success).toBe(true);
    });

    it('treats a day with a null shifts value as undecided', () => {
        const hours = buildOpeningHours({ thu: { closed: false, shifts: null } });
        const { changedDays } = normalizeOpeningHoursDays(hours);
        expect(changedDays).toBe(1);
    });

    it('is idempotent — a second pass changes nothing', () => {
        const hours = buildOpeningHours({ tue: UNDECIDED_DAY, sun: UNDECIDED_DAY });

        const first = normalizeOpeningHoursDays(hours);
        expect(first.changedDays).toBe(2);

        const second = normalizeOpeningHoursDays(first.next);
        expect(second.changedDays).toBe(0);
        expect(second.next).toBe(first.next);
    });
});

// ── Metadata ────────────────────────────────────────────────────────────────

describe('0095 — declared metadata', () => {
    it('is required, non-destructive, and named after its file', () => {
        expect(migration.meta.name).toBe('0095-hos-1152-normalize-unset-opening-hours-days');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });

    it('declares both listing tables as required columns', () => {
        // HOS-433: without this the migration would report zero rows moved
        // against a database where the column is gone, and close itself in the
        // ledger forever.
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'gastronomies', column: 'opening_hours' },
            { table: 'experiences', column: 'opening_hours' }
        ]);
    });
});

// ── Orchestration, against a fake db ────────────────────────────────────────

/** Flattens a Drizzle `sql` template back into readable text. */
function sqlText(node: unknown): string {
    if (node === null || typeof node !== 'object') return '';
    const chunk = node as { value?: unknown; queryChunks?: unknown[] };
    if (Array.isArray(chunk.value) && chunk.value.every((v) => typeof v === 'string')) {
        return chunk.value.join('');
    }
    if (Array.isArray(chunk.queryChunks)) {
        return chunk.queryChunks.map(sqlText).join('');
    }
    return '';
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** Text of every statement issued, in order. */
    readonly statements: string[];
}

/**
 * Builds a fake `ctx.db` whose `execute` answers SELECTs from the supplied rows
 * (keyed by table) and records every statement it is handed.
 */
function buildFakeDb(rowsByTable: Record<string, readonly unknown[]>): FakeDbProbe {
    const statements: string[] = [];

    const db = {
        execute: (query: unknown) => {
            const text = sqlText(query);
            statements.push(text);

            if (!text.startsWith('SELECT')) return Promise.resolve({ rows: [] });

            const table = Object.keys(rowsByTable).find((name) => text.includes(name));
            return Promise.resolve({ rows: table ? rowsByTable[table] : [] });
        }
    } as unknown as SeedMigrationCtx['db'];

    return { db, statements };
}

function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

describe('0095 — up()', () => {
    it('writes one update per changed row, and walks both tables', async () => {
        const probe = buildFakeDb({
            gastronomies: [
                { id: 'g-1', opening_hours: buildOpeningHours({ tue: UNDECIDED_DAY }) },
                { id: 'g-2', opening_hours: buildOpeningHours() }
            ],
            experiences: [{ id: 'e-1', opening_hours: buildOpeningHours({ sat: UNDECIDED_DAY }) }]
        });

        const result = await migration.up(buildCtx(probe.db));

        const selects = probe.statements.filter((s) => s.startsWith('SELECT'));
        const updates = probe.statements.filter((s) => s.startsWith('UPDATE'));

        expect(selects).toHaveLength(2);
        expect(selects[0]).toContain('gastronomies');
        expect(selects[1]).toContain('experiences');

        // g-2 was already valid: two candidate rows, one write.
        expect(updates).toHaveLength(2);
        expect(updates[0]).toContain('gastronomies');
        expect(updates[1]).toContain('experiences');

        expect(result.counts).toEqual({
            gastronomiesUpdated: 1,
            gastronomyDaysClosed: 1,
            experiencesUpdated: 1,
            experienceDaysClosed: 1
        });
    });

    it('writes nothing at all when every listing is already valid', async () => {
        const probe = buildFakeDb({
            gastronomies: [{ id: 'g-1', opening_hours: buildOpeningHours({ sun: CLOSED_DAY }) }],
            experiences: []
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.statements.filter((s) => s.startsWith('UPDATE'))).toHaveLength(0);
        expect(result.summary).toContain('nothing to normalize');
        expect(result.counts?.gastronomiesUpdated).toBe(0);
    });
});

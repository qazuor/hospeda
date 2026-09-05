/**
 * @fileoverview
 * Regression tests for `0097-hos-1027-normalize-stored-whatsapp-numbers`.
 *
 * `normalizeStoredWhatsapp` is asserted against the REAL `normalizePhoneNumber`
 * from `@repo/service-core` (not a local copy of the regex) — the same
 * reasoning `0095-hos-1152`'s tests apply to `OpeningHoursSchema`: a test that
 * re-implemented the stripping rule would agree with this migration forever,
 * including on the day `normalizePhoneNumber` changes underneath it.
 *
 * WHAT THESE TESTS CANNOT SEE, stated so nobody mistakes them for full
 * coverage: `up()` is exercised against a fake `db`, so no SQL is ever
 * planned or run. The `deleted_at IS NULL`, `contact_info ? 'whatsapp'`
 * predicates and the `::jsonb` cast are NOT evaluated here — only verified by
 * running the migration against a database. What these cover is (1) the pure
 * per-row decision, exercised directly and exhaustively, and (2) the
 * orchestration: that all four tables are walked, that a row is written only
 * when its `whatsapp` actually changed, and that an already-clean database is
 * not written to at all.
 *
 * @module test/data-migrations/0097-hos-1027-normalize-stored-whatsapp-numbers
 */
import { normalizePhoneNumber } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0097-hos-1027-normalize-stored-whatsapp-numbers.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const { normalizeStoredWhatsapp } = migration;

// ── The regression assertion: against the real normalizePhoneNumber ────────

describe('0097 — normalizeStoredWhatsapp, against the real normalizePhoneNumber', () => {
    it('strips a stray space and matches the real function byte-for-byte', () => {
        const spaced = '+54 9344 4123456';
        const { next, changed } = normalizeStoredWhatsapp({ whatsapp: spaced });

        expect(changed).toBe(true);
        expect((next as { whatsapp: string }).whatsapp).toBe(normalizePhoneNumber(spaced));
        expect((next as { whatsapp: string }).whatsapp).toBe('+5493444123456');
    });

    it('strips the two-space production shape ("+NN NNNN NNNNNN")', () => {
        const twoSpaces = '+54 9344 412345';
        const { changed, next } = normalizeStoredWhatsapp({ whatsapp: twoSpaces });
        expect(changed).toBe(true);
        expect((next as { whatsapp: string }).whatsapp).toBe(normalizePhoneNumber(twoSpaces));
        expect((next as { whatsapp: string }).whatsapp).toBe('+549344412345');
    });

    it('leaves an already-canonical value untouched (idempotent)', () => {
        const canonical = normalizePhoneNumber('+54 9 344 412 3456');
        const contactInfo = { whatsapp: canonical };

        const { next, changed } = normalizeStoredWhatsapp(contactInfo);

        expect(changed).toBe(false);
        // Reference-identical, not merely deep-equal: an unchanged row must not
        // be written, and the caller decides that by `changed` alone.
        expect(next).toBe(contactInfo);
    });

    it('is idempotent — running the decision twice changes nothing the second time', () => {
        const contactInfo = { whatsapp: '+54 9 344 4123456' };

        const first = normalizeStoredWhatsapp(contactInfo);
        expect(first.changed).toBe(true);

        const second = normalizeStoredWhatsapp(first.next);
        expect(second.changed).toBe(false);
        expect(second.next).toBe(first.next);
    });
});

// ── What it must not touch ──────────────────────────────────────────────────

describe('0097 — what it leaves alone', () => {
    it('does not touch a contact_info with no whatsapp key', () => {
        const contactInfo = { mobilePhone: '+5493444123456' };
        const { next, changed } = normalizeStoredWhatsapp(contactInfo);
        expect(changed).toBe(false);
        expect(next).toBe(contactInfo);
    });

    it('does not touch a contact_info whose whatsapp is JSON null', () => {
        const contactInfo = { whatsapp: null, mobilePhone: '+5493444123456' };
        const { next, changed } = normalizeStoredWhatsapp(contactInfo);
        expect(changed).toBe(false);
        expect(next).toBe(contactInfo);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['an array', []]
    ])('returns %s contact_info unchanged instead of inventing one', (_label, value) => {
        const { next, changed } = normalizeStoredWhatsapp(value);
        expect(changed).toBe(false);
        expect(next).toBe(value);
    });

    it('preserves every sibling key untouched — only whatsapp changes', () => {
        // The load-bearing assertion for the JSONB-merge hazard this migration
        // was flagged to check: `toStrictEqual`, not `toEqual`, so an
        // accidentally-`undefined` key (which `toEqual` would silently ignore)
        // is caught too.
        const contactInfo = {
            mobilePhone: '+5493444123456',
            homePhone: '+543442123456',
            workPhone: '+543442654321',
            whatsapp: '+54 9344 4123456',
            personalEmail: 'owner@example.com',
            workEmail: 'contacto@example.com',
            website: 'https://example.com',
            preferredEmail: 'PERSONAL'
        };

        const { next, changed } = normalizeStoredWhatsapp(contactInfo);

        expect(changed).toBe(true);
        expect(next).toStrictEqual({
            ...contactInfo,
            whatsapp: normalizePhoneNumber(contactInfo.whatsapp)
        });
    });
});

// ── Metadata ────────────────────────────────────────────────────────────────

describe('0097 — declared metadata', () => {
    it('is required, non-destructive, and named after its file', () => {
        expect(migration.meta.name).toBe('0097-hos-1027-normalize-stored-whatsapp-numbers');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });

    it('declares all four tables as required columns', () => {
        // HOS-433: without this the migration would report zero rows moved
        // against a database where the column is gone, and close itself in
        // the ledger forever.
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'accommodations', column: 'contact_info' },
            { table: 'event_organizers', column: 'contact_info' },
            { table: 'post_sponsors', column: 'contact_info' },
            { table: 'users', column: 'contact_info' }
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
 * Builds a fake `ctx.db` whose `execute` answers SELECTs from the supplied
 * rows (keyed by table name) and records every statement it is handed.
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

describe('0097 — up()', () => {
    it('writes one update per changed row, and walks all four tables', async () => {
        const probe = buildFakeDb({
            accommodations: [
                { id: 'acc-1', contact_info: { whatsapp: '+54 9344 4123456' } },
                { id: 'acc-2', contact_info: { whatsapp: '+5493444123456' } } // already canonical
            ],
            event_organizers: [],
            post_sponsors: [],
            users: [{ id: 'user-1', contact_info: { whatsapp: '+54 9344 4000000' } }]
        });

        const result = await migration.up(buildCtx(probe.db));

        const selects = probe.statements.filter((s) => s.startsWith('SELECT'));
        const updates = probe.statements.filter((s) => s.startsWith('UPDATE'));

        expect(selects).toHaveLength(4);
        expect(selects[0]).toContain('accommodations');
        expect(selects[3]).toContain('users');

        // acc-2 was already canonical: two candidates in accommodations, one write.
        expect(updates).toHaveLength(2);
        expect(updates[0]).toContain('accommodations');
        expect(updates[1]).toContain('users');

        expect(result.counts).toEqual({
            accommodations: 1,
            event_organizers: 0,
            post_sponsors: 0,
            users: 1
        });
        expect(result.summary).toContain('accommodations=1');
        expect(result.summary).toContain('users=1');
    });

    it('writes nothing at all when every row is already canonical', async () => {
        const probe = buildFakeDb({
            accommodations: [{ id: 'acc-1', contact_info: { whatsapp: '+5493444123456' } }],
            event_organizers: [],
            post_sponsors: [],
            users: []
        });

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.statements.filter((s) => s.startsWith('UPDATE'))).toHaveLength(0);
        expect(result.summary).toContain('nothing to normalize');
        expect(result.counts?.accommodations).toBe(0);
    });
});

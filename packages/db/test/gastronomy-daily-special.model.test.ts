/**
 * Unit tests for `GastronomyDailySpecialModel.findValidOn` (HOS-1041).
 *
 * ## What is being pinned, and why it needs pinning
 *
 * `findValidOn` IS the expiry mechanism. There is no cron; a special stops
 * being published because this predicate stops matching it. The bug that
 * matters is not "it throws" — it is an INVERTED comparison, which fails
 * silently and in the worst possible direction: swapping `lte`/`gte` publishes
 * exactly the specials whose window has passed and hides the ones on offer
 * today. Nothing else in the stack would notice.
 *
 * ## Why a stubbed client rather than a database
 *
 * The model is driven for real — this calls `findValidOn`, not a re-derivation
 * of it — with a stub passed as `tx`, which `BaseModelImpl.getClient` returns
 * verbatim. The stub captures the `where` clause the model actually built, and
 * the assertions read the SQL Drizzle produced from it. So a change to the
 * predicate's OPERATORS or COLUMNS fails here, without a live Postgres.
 *
 * What this deliberately does NOT claim to cover is Postgres's own evaluation
 * of that SQL on the four boundary days. That is a real gap and it is named
 * rather than papered over: the boundary is asserted at the schema layer
 * (`gastronomy.daily-special.schema.test.ts`, which pins that a one-day window
 * has both bounds on the same date) and the operators are asserted here.
 */

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { GastronomyDailySpecialModel } from '../src/models/gastronomy/gastronomyDailySpecial.model.ts';
import type { DrizzleClient } from '../src/types.ts';

/**
 * A minimal stand-in for the Drizzle client that records the `where` clause and
 * answers with no rows.
 *
 * Only the four chained calls `findValidOn` makes are implemented. A method the
 * model starts using and this does not have will throw rather than silently
 * return `undefined`, which is what keeps the stub honest as the model changes.
 */
function createCapturingClient() {
    const captured: { where?: unknown; orderBy?: unknown } = {};

    const chain = {
        from: () => chain,
        where: (clause: unknown) => {
            captured.where = clause;
            return chain;
        },
        orderBy: (clause: unknown) => {
            captured.orderBy = clause;
            return Promise.resolve([]);
        }
    };

    const client = { select: () => chain } as unknown as DrizzleClient;

    return { client, captured };
}

/** Renders a captured Drizzle SQL object to real Postgres text plus its params. */
const dialect = new PgDialect();

/**
 * Renders a captured Drizzle SQL object as the SQL text it would send, with its
 * bound parameters appended.
 *
 * Uses Drizzle's own `PgDialect` rather than walking `queryChunks` by hand: the
 * chunks hold live `PgTable`/`PgColumn` objects with circular back-references,
 * and the dialect is the thing that actually turns them into the statement the
 * database runs — so asserting against its output is asserting against what
 * ships.
 *
 * @param clause - A Drizzle `SQL` object (a `where` or `orderBy` clause).
 * @returns The rendered SQL followed by its parameter values.
 */
function describeSql(clause: unknown): string {
    // biome-ignore lint/suspicious/noExplicitAny: `sqlToQuery` takes drizzle's
    // internal `SQL` type, which the capturing stub sees only as `unknown`.
    const query = dialect.sqlToQuery(clause as any);
    return `${query.sql} -- ${JSON.stringify(query.params)}`;
}

describe('GastronomyDailySpecialModel.findValidOn', () => {
    it('filters on BOTH bounds of the window, in the RIGHT direction', () => {
        // The operators are the assertion, not the column names. A predicate
        // that merely MENTIONS both columns is satisfied by the inverted pair
        // (`valid_from >= today AND valid_until <= today`), which publishes
        // exactly the expired specials and hides today's — the failure this
        // test exists for. Asserting `valid_from <=` and `valid_until >=`
        // is what makes swapping them red.
        //
        // A predicate that checks only `valid_until` is caught by the same two
        // assertions: it would keep a special that has not started yet on the
        // public page, which is the "programado" state the owner's editor shows
        // and the public read must not.
        // Arrange
        const model = new GastronomyDailySpecialModel();
        const { client, captured } = createCapturingClient();

        // Act
        void model.findValidOn({
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            today: '2026-09-03',
            tx: client
        });

        // Assert
        const sql = describeSql(captured.where);
        expect(sql).toMatch(/"valid_from"\s*<=/);
        expect(sql).toMatch(/"valid_until"\s*>=/);
        // And NOT the inverted pair, so a predicate carrying both directions
        // (an `or`, say) cannot satisfy the two assertions above by accident.
        expect(sql).not.toMatch(/"valid_from"\s*>=/);
        expect(sql).not.toMatch(/"valid_until"\s*<=/);
    });

    it('requires ALL THREE conditions together, never any of them', () => {
        // `and` vs `or` is invisible to every assertion above: an `or` would
        // still render both columns with both operators. Under `or`, ONE
        // matching condition is enough — so every special of every listing
        // whose window merely started would be published.
        // Arrange
        const model = new GastronomyDailySpecialModel();
        const { client, captured } = createCapturingClient();

        // Act
        void model.findValidOn({
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            today: '2026-09-03',
            tx: client
        });

        // Assert
        const sql = describeSql(captured.where);
        expect(sql).toContain(' and ');
        expect(sql).not.toContain(' or ');
    });

    it('binds the caller s day, not a value read from the clock', () => {
        // `today` being a parameter is what makes the AR-market-timezone
        // resolution possible at all, and what keeps this testable. A model
        // that reached for `new Date()` or `CURRENT_DATE` would not carry the
        // caller's date into the query at all.
        // Arrange
        const model = new GastronomyDailySpecialModel();
        const { client, captured } = createCapturingClient();

        // Act
        void model.findValidOn({
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            today: '2026-09-03',
            tx: client
        });

        // Assert
        expect(describeSql(captured.where)).toContain('2026-09-03');
    });

    it('scopes the read to the requested listing', () => {
        // Arrange
        const model = new GastronomyDailySpecialModel();
        const { client, captured } = createCapturingClient();

        // Act
        void model.findValidOn({
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            today: '2026-09-03',
            tx: client
        });

        // Assert
        const sql = describeSql(captured.where);
        expect(sql).toContain('gastronomy_id');
        expect(sql).toContain('22222222-2222-4222-8222-222222222222');
    });

    it('orders by display_order so the owner s arrangement survives the read', () => {
        // Arrange
        const model = new GastronomyDailySpecialModel();
        const { client, captured } = createCapturingClient();

        // Act
        void model.findValidOn({
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            today: '2026-09-03',
            tx: client
        });

        // Assert
        expect(describeSql(captured.orderBy)).toContain('display_order');
    });
});

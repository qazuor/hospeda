/**
 * Tests for the shared `mp_subscription_id` predicates (HOS-1326).
 *
 * These pin the SQL these functions EMIT, operator included — not a silhouette of
 * it. Two `apps/api` suites stub these predicates (they replace `@repo/db`
 * wholesale) and one `packages/seed` migration consumes them against live billing
 * rows, so this file is the only place their real behaviour is checked. The first
 * version of it was blind in exactly the way it existed to prevent:
 *
 * | mutation | real effect | old assertions |
 * | -- | -- | -- |
 * | `ne(mp,'')` → `eq(mp,'')` in {@link hasLinkedPreapprovalCondition} | matches ONLY `''`, so the data-migration selects nothing and reports success | passed |
 * | `eq(mp,'')` → `ne(mp,'')` in {@link hasNoLinkedPreapprovalCondition} | matches EVERY row with a real preapproval — fails OPEN | passed |
 *
 * The second is the dangerous direction: with the operator inverted the reaper's
 * `mpGuard` stops guarding, and a terminal status can land on a row whose
 * preapproval was linked between the read and the write — the split-brain the
 * cron's own comment says it is preventing.
 *
 * Both survived because the assertions asked whether the SQL *contained* `is
 * null` / `or` / an empty-string param. All of that stays true under either
 * mutation. Pinning the whole statement is what makes an operator swap fail: a
 * predicate IS its operators, and a test that reads around them tests nothing.
 *
 * @module test/billing-subscription-conditions
 */

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    hasLinkedPreapprovalCondition,
    hasNoLinkedPreapprovalCondition
} from '../src/utils/billing-subscription-conditions.ts';

const dialect = new PgDialect();

/**
 * Renders a drizzle condition to the exact SQL Postgres would receive.
 *
 * Literals arrive as `$n` placeholders, so the bound parameters come back
 * alongside — the empty string this module is about is a PARAM, not inline text,
 * and a statement-only assertion would never see which value is compared.
 */
function renderSql(condition: unknown): { text: string; params: readonly unknown[] } {
    // biome-ignore lint/suspicious/noExplicitAny: dialect takes a drizzle SQL node
    const query = dialect.sqlToQuery(condition as any);
    return { text: query.sql, params: query.params };
}

const COLUMN = '"billing_subscriptions"."mp_subscription_id"';

describe('hasNoLinkedPreapprovalCondition', () => {
    // Whole-statement equality, deliberately. Any operator swap, any column
    // change, any lost half fails here — which is the entire point of the file.
    it('emits exactly `mp IS NULL OR mp = <empty>`', () => {
        const { text, params } = renderSql(hasNoLinkedPreapprovalCondition());

        expect(text).toBe(`(${COLUMN} is null or ${COLUMN} = $1)`);
        expect(params).toEqual(['']);
    });

    it('compares the empty string with EQUALITY, never with `<>`', () => {
        const { text } = renderSql(hasNoLinkedPreapprovalCondition());

        // The fail-OPEN direction: `<>` here would match every row that HAS a
        // preapproval, letting a terminal status land on a live authorization.
        expect(text).toContain(`${COLUMN} = $1`);
        expect(text).not.toContain('<>');
        expect(text).not.toContain('is not null');
    });

    it('is an OR — the two spellings are alternatives, not both required', () => {
        const { text } = renderSql(hasNoLinkedPreapprovalCondition());

        expect(text).toContain(' or ');
        expect(text).not.toContain(' and ');
    });
});

describe('hasLinkedPreapprovalCondition', () => {
    it('emits exactly `mp IS NOT NULL AND mp <> <empty>`', () => {
        const { text, params } = renderSql(hasLinkedPreapprovalCondition());

        expect(text).toBe(`(${COLUMN} is not null and ${COLUMN} <> $1)`);
        expect(params).toEqual(['']);
    });

    it('compares the empty string with INEQUALITY, never with `=`', () => {
        const { text } = renderSql(hasLinkedPreapprovalCondition());

        // Swapping this to `=` makes the predicate match ONLY the empty string —
        // the exact rows it exists to exclude — so the data-migration would
        // quietly select nothing and report success.
        expect(text).toContain(`${COLUMN} <> $1`);
        expect(text).not.toContain(`${COLUMN} = $1`);
    });

    it('is an AND — both halves are required', () => {
        const { text } = renderSql(hasLinkedPreapprovalCondition());

        expect(text).toContain(' and ');
        expect(text).not.toContain(' or ');
    });
});

describe('the pair', () => {
    // Documented as exact complements. If one drifted onto another column every
    // shape-level assertion above would still pass.
    it('addresses the same column from both directions', () => {
        expect(renderSql(hasNoLinkedPreapprovalCondition()).text).toContain(COLUMN);
        expect(renderSql(hasLinkedPreapprovalCondition()).text).toContain(COLUMN);
    });

    it('negates each other operator for operator', () => {
        const negative = renderSql(hasNoLinkedPreapprovalCondition()).text;
        const positive = renderSql(hasLinkedPreapprovalCondition()).text;

        // `is null`↔`is not null`, `=`↔`<>`, `or`↔`and`, all three at once.
        // Asserted as a pair so a half-applied edit — flipping one operator and
        // not its twin — is caught even if each statement still reads sensibly on
        // its own.
        const normalisedNegative = negative
            .replace('is null', '<NULLNESS>')
            .replace(' or ', ' <JOIN> ')
            .replace('= $1', '<EQUALITY> $1');
        const normalisedPositive = positive
            .replace('is not null', '<NULLNESS>')
            .replace(' and ', ' <JOIN> ')
            .replace('<> $1', '<EQUALITY> $1');

        expect(normalisedNegative).toBe(normalisedPositive);
    });
});

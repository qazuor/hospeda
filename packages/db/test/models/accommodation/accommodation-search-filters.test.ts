/**
 * HOS-1922: the accommodation listing's filter ledger.
 *
 * Every key of `AccommodationSearchInput` must be classified in
 * `ACCOMMODATION_SEARCH_FILTER_HANDLING`, and the classification must be TRUE:
 * a `builder` key changes the rendered WHERE, a `known-gap` key does not. This
 * is what stops a schema param from being accepted, parsed, mapped and then
 * silently ignored (HOS-1898 `isFeatured`, HOS-1922 `isAvailable`).
 */

import { AccommodationSearchSchema } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_SEARCH_FILTER_HANDLING,
    buildAccommodationSearchConditions,
    buildAccommodationSearchWhere
} from '../../../src/models/accommodation/accommodation-search-filters';

const dialect = new PgDialect();

/** Renders the shared WHERE for `params` to its SQL text. */
function render(params: Parameters<typeof buildAccommodationSearchWhere>[0]['params']): string {
    const where = buildAccommodationSearchWhere({ params });
    if (!where) throw new Error('builder returned no WHERE');
    return dialect.sqlToQuery(where).sql;
}

const baseline = render({});
const entries = Object.entries(ACCOMMODATION_SEARCH_FILTER_HANDLING);

describe('accommodation search filter ledger (HOS-1922)', () => {
    it('classifies exactly the keys of the search schema', () => {
        // Arrange
        const schemaKeys = Object.keys(AccommodationSearchSchema.shape).sort();

        // Act
        const ledgerKeys = Object.keys(ACCOMMODATION_SEARCH_FILTER_HANDLING).sort();

        // Assert
        expect(ledgerKeys).toEqual(schemaKeys);
    });

    it('has at least one builder entry (the ledger is not vacuous)', () => {
        expect(entries.filter(([, h]) => h.kind === 'builder').length).toBeGreaterThan(10);
    });

    it.each(
        entries.filter(([, h]) => h.kind === 'builder')
    )('builder key %s narrows the WHERE', (_key, handling) => {
        // Arrange
        if (handling.kind !== 'builder') throw new Error('unreachable');

        // Act
        const sql = render(handling.sample);

        // Assert
        expect(sql).not.toBe(baseline);
    });

    it.each(
        entries.filter(([, h]) => h.kind === 'known-gap')
    )('known-gap key %s is really ignored (move it to builder once implemented)', (_key, handling) => {
        // Arrange
        if (handling.kind !== 'known-gap') throw new Error('unreachable');

        // Act
        const sql = render(handling.sample);

        // Assert
        expect(sql).toBe(baseline);
    });

    it.each(
        entries.filter(([, h]) => h.kind === 'elsewhere' || h.kind === 'known-gap')
    )('key %s documents why it is not in the builder', (_key, handling) => {
        if (handling.kind === 'builder') throw new Error('unreachable');
        expect(handling.reason.trim().length).toBeGreaterThan(10);
    });

    it('no longer knows the removed dead filters', () => {
        const keys = Object.keys(ACCOMMODATION_SEARCH_FILTER_HANDLING);
        expect(keys).not.toContain('isAvailable');
        expect(keys).not.toContain('city');
        expect(keys).not.toContain('country');
    });

    it('always keeps the soft-delete condition first', () => {
        const conditions = buildAccommodationSearchConditions({ params: {} });
        expect(conditions).toHaveLength(1);
        expect(dialect.sqlToQuery(conditions[0] as never).sql).toContain('"deleted_at" is null');
    });
});

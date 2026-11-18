/**
 * HOS-919 T-005 — `alliance_leads.category_slugs` schema tests.
 *
 * In-process schema tests (no PostgreSQL needed).
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { allianceLeads } from '../../../src/schemas/alliance/alliance_lead.dbschema.ts';

function getColumn(sqlName: string) {
    return getTableConfig(allianceLeads).columns.find((c) => c.name === sqlName);
}

describe('alliance_leads category columns (HOS-919 expand step)', () => {
    it('category_slugs is a nullable text[] column', () => {
        const col = getColumn('category_slugs');
        expect(col).toBeDefined();
        expect(col?.notNull).toBe(false);
        expect(col?.columnType).toBe('PgArray');
        expect(col?.getSQLType()).toBe('text[]');
    });

    it('keeps the legacy category varchar column (dropped in the contract release)', () => {
        const col = getColumn('category');
        expect(col).toBeDefined();
        expect(col?.notNull).toBe(false);
        expect(col?.getSQLType()).toBe('varchar(50)');
    });
});

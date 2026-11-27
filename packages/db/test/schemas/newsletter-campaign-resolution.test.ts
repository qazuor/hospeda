import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { newsletterCampaigns } from '../../src/schemas/newsletter/newsletter_campaigns.dbschema.ts';

describe('Newsletter campaign resolution storage', () => {
    const columns = getTableColumns(newsletterCampaigns);

    it('stores resolved content as nullable JSONB without a default', () => {
        expect(columns.resolvedBodyJson.name).toBe('resolved_body_json');
        expect(columns.resolvedBodyJson.getSQLType()).toBe('jsonb');
        expect(columns.resolvedBodyJson.notNull).toBe(false);
        expect(columns.resolvedBodyJson.hasDefault).toBe(false);
    });

    it('stores resolution time as nullable timestamptz without a default', () => {
        expect(columns.resolvedAt.name).toBe('resolved_at');
        expect(columns.resolvedAt.getSQLType()).toBe('timestamp with time zone');
        expect(columns.resolvedAt.notNull).toBe(false);
        expect(columns.resolvedAt.hasDefault).toBe(false);
    });
});

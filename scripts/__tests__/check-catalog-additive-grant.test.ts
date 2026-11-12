/** TEST:G18 — migration guard keeps the additive grant lane bounded. */
import { describe, expect, it } from 'vitest';
import { inspectCatalogAdditiveGrant } from '../check-catalog-additive-grant';

const canonical = `CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()
RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;`;
const inspect = (files: Readonly<Record<string, string>>) =>
    inspectCatalogAdditiveGrant({ files, canonicalFunction: canonical });

describe('GUARD:G18 — catalog additive grant', () => {
    it('rejects the old hand-written created-version allowlist from 0202', () => {
        const violations = inspect({
            'packages/db/src/migrations/0202_hos_2105_faq_draft_catalog.sql': `SELECT set_config('hospeda.catalog_versions_created_in_xact', 'published-id', true);`
        });
        expect(violations).toHaveLength(1);
        expect(violations[0]?.detail).toContain('outside the trigger function');
    });

    it('requires a same-file version INSERT or the explicit lane for child rows', () => {
        const violations = inspect({
            'packages/db/src/migrations/0203_fixture.sql':
                "INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ('id', 'k', 2);"
        });
        expect(violations.some((v) => v.detail.includes('neither same-file'))).toBe(true);
    });

    it('accepts child inserts when an additive grant signal is present', () => {
        expect(
            inspect({
                'packages/db/src/migrations/0203_fixture.sql': `SELECT set_config('hospeda.catalog_additive_grant', 'HOS-2105', true);\nINSERT INTO addon_version_limit (addon_version_id, key, value) VALUES ('id', 'k', 2);`
            })
        ).toEqual([]);
    });

    it('exempts historical migrations through 0144', () => {
        expect(
            inspect({
                'packages/db/src/migrations/0144_catalog.sql': `SELECT set_config('hospeda.catalog_versions_created_in_xact', 'legacy', true); INSERT INTO plan_version_limit VALUES ('x');`
            })
        ).toEqual([]);
    });

    it('rejects a migration copy whose function body differs from extras 041', () => {
        expect(
            inspect({
                'packages/db/src/migrations/0202_hos_2105_faq_draft_catalog.sql': canonical.replace(
                    'RETURN NEW',
                    'RETURN OLD'
                )
            }).some((v) => v.detail.includes('body differs'))
        ).toBe(true);
    });

    it('normalizes whitespace when comparing copied function bodies', () => {
        expect(
            inspect({
                'packages/db/src/migrations/0202_hos_2105_faq_draft_catalog.sql': canonical.replace(
                    'BEGIN RETURN NEW; END;',
                    'BEGIN\n  RETURN   NEW;\nEND;'
                )
            })
        ).toEqual([]);
    });
});

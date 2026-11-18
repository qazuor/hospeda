/**
 * Integration test: a partner type's in-use count includes rows the release-N
 * backfill has not reached yet (HOS-2336, AC-3.4).
 *
 * A row written with only the legacy `type` (by the pre-HOS-2336 container
 * during a rollout, or before 0184 ran) still belongs to the type whose slug
 * equals that enum value. If the count ignored it, the admin could deactivate
 * or delete the type under the row, and the N+1 backfill would point the row at
 * a type that is gone.
 *
 * Uses `withCleanSlate` for the same reason as `partner.model.integration.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { PartnerTypeModel } from '../../src/models/partner/partner-type.model.ts';
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { partnerTypes } from '../../src/schemas/partner/partner-type.dbschema.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('PartnerTypeModel in-use counts (HOS-2336 release N)', () => {
    const model = new PartnerTypeModel();

    it('counts catalog rows and unbackfilled legacy rows, never deleted ones', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const ngoId = crypto.randomUUID();
            const mediaId = crypto.randomUUID();
            await db.insert(partnerTypes).values([
                { id: ngoId, slug: 'ngo', nameI18n: { es: 'ONG' }, displayWeight: 20 },
                { id: mediaId, slug: 'media', nameI18n: { es: 'Medio' }, displayWeight: 40 }
            ]);
            const uid = () => crypto.randomUUID().slice(0, 8);
            await db.insert(partners).values([
                // Backfilled: matched by type_id.
                { slug: `p-${uid()}`, name: 'Backfilled', type: 'ngo', typeId: ngoId },
                // Not backfilled yet: matched by the legacy value.
                { slug: `p-${uid()}`, name: 'Legacy only', type: 'ngo', typeId: null },
                // Deleted: never counted.
                {
                    slug: `p-${uid()}`,
                    name: 'Deleted',
                    type: 'ngo',
                    typeId: null,
                    deletedAt: new Date()
                },
                // A type_id wins over a contradicting legacy value.
                { slug: `p-${uid()}`, name: 'Media', type: null, typeId: mediaId }
            ]);

            // Act
            const ngo = await model.countPartners(ngoId);
            const media = await model.countPartners(mediaId);
            const grouped = await model.countPartnersByTypeIds([ngoId, mediaId]);

            // Assert
            expect(ngo).toBe(2);
            expect(media).toBe(1);
            expect(grouped.get(ngoId)).toBe(2);
            expect(grouped.get(mediaId)).toBe(1);
        });
    });
});

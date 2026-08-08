/**
 * Integration tests for `PartnerMentionModel` (HOS-377 T-008).
 *
 * These run against a real PostgreSQL instance because the properties under test
 * are enforced by the database, not by TypeScript: the ON DELETE CASCADE from
 * `partners`, the soft-delete filter, and the ordering the partner-facing log
 * depends on. `packages/db/test/schemas/partner_mention.dbschema.test.ts` asserts
 * the same FKs are DECLARED; this file asserts they FIRE.
 *
 * Uses `withTestTransaction` (rollback isolation) since every model method here
 * accepts a `tx`.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PartnerMentionModel } from '../../src/models/partner/partner-mention.model.ts';
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { partnerMentions } from '../../src/schemas/partner/partner_mention.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

const model = new PartnerMentionModel();

/** Minimal `partners` row satisfying every NOT NULL constraint. */
function partnerFixture(): typeof partners.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `pm-partner-${uid}`,
        name: `PM Partner ${uid}`,
        type: 'commerce' as const,
        tier: 'gold' as const
    };
}

/** Inserts a partner and returns its id. */
async function seedPartner(tx: DrizzleClient): Promise<string> {
    const row = partnerFixture();
    await tx.insert(partners).values(row);
    return row.id as string;
}

const AUG_01 = new Date('2026-08-01T12:00:00.000Z');
const AUG_05 = new Date('2026-08-05T12:00:00.000Z');
const AUG_10 = new Date('2026-08-10T12:00:00.000Z');

afterAll(async () => {
    await closeTestPool();
});

describe('PartnerMentionModel.createMany', () => {
    it('writes one row per entry, all sharing the batch id', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const partnerId = await seedPartner(tx);
            const batchId = crypto.randomUUID();

            // Act — a four-network campaign logged in one submission.
            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        batchId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        batchId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    },
                    {
                        partnerId,
                        batchId,
                        channel: 'TIKTOK',
                        mentionedAt: AUG_01,
                        url: 'https://tt.test/3'
                    },
                    { partnerId, batchId, channel: 'WHATSAPP', mentionedAt: AUG_01, url: null }
                ]
            });

            // Assert
            expect(rows).toHaveLength(4);
            expect(new Set(rows.map((r) => r.batchId))).toEqual(new Set([batchId]));
        });
    });

    it('accepts a single mention with a null batch id', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);

            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'NEWSLETTER',
                        mentionedAt: AUG_01,
                        url: 'https://n.test/1'
                    }
                ]
            });

            expect(rows).toHaveLength(1);
            expect(rows[0]?.batchId).toBeNull();
        });
    });

    it('is a no-op for an empty row list', async () => {
        await withTestTransaction(async (tx) => {
            expect(await model.createMany({ tx, rows: [] })).toEqual([]);
        });
    });

    it('persists a WHATSAPP row with no url — the column is nullable', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);

            const rows = await model.createMany({
                tx,
                rows: [{ partnerId, channel: 'WHATSAPP', mentionedAt: AUG_01, url: null }]
            });

            expect(rows[0]?.url).toBeNull();
        });
    });

    it('rejects a channel outside the pg enum', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);

            await expect(
                model.createMany({
                    tx,
                    rows: [{ partnerId, channel: 'LINKEDIN', mentionedAt: AUG_01 }]
                })
            ).rejects.toThrow();
        });
    });
});

describe('PartnerMentionModel cascade behaviour', () => {
    it('deletes a partner mentions when the partner row is deleted', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_05,
                        url: 'https://fb.test/2'
                    }
                ]
            });
            expect(await model.findByPartner({ tx, partnerId })).toHaveLength(2);

            // Act — a hard delete of the parent, which the FK must follow.
            const { eq } = await import('drizzle-orm');
            await tx.delete(partners).where(eq(partners.id, partnerId));

            // Assert
            expect(await model.findByPartner({ tx, partnerId })).toHaveLength(0);
        });
    });

    it('leaves another partner mentions untouched', async () => {
        await withTestTransaction(async (tx) => {
            const doomedId = await seedPartner(tx);
            const survivorId = await seedPartner(tx);

            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId: doomedId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId: survivorId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            const { eq } = await import('drizzle-orm');
            await tx.delete(partners).where(eq(partners.id, doomedId));

            expect(await model.findByPartner({ tx, partnerId: survivorId })).toHaveLength(1);
        });
    });
});

describe('PartnerMentionModel.findByPartner', () => {
    it('orders newest-first by when the promotion happened', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_10,
                        url: 'https://fb.test/2'
                    },
                    { partnerId, channel: 'TIKTOK', mentionedAt: AUG_05, url: 'https://tt.test/3' }
                ]
            });

            const rows = await model.findByPartner({ tx, partnerId });

            expect(rows.map((r) => r.channel)).toEqual(['FACEBOOK', 'TIKTOK', 'INSTAGRAM']);
        });
    });

    it('orders by mentionedAt, NOT by createdAt', async () => {
        // The two columns must disagree for this to prove anything, and they cannot
        // be made to disagree by inserting at different times: Postgres' now() is
        // TRANSACTION-scoped, so every row written inside one test transaction gets
        // an identical created_at. An earlier version of this test relied on insert
        // order and passed even when the model was mutated to sort by createdAt.
        // createdAt is therefore set EXPLICITLY, inverted against mentionedAt.
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_10,
                        createdAt: AUG_01,
                        url: 'https://fb.test/2'
                    },
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        createdAt: AUG_10,
                        url: 'https://ig.test/1'
                    }
                ]
            });

            const rows = await model.findByPartner({ tx, partnerId });

            // Newest MENTION first. Sorting by createdAt would invert this.
            expect(rows.map((r) => r.channel)).toEqual(['FACEBOOK', 'INSTAGRAM']);
        });
    });

    it('gives every row of one transaction the same createdAt — why id breaks the tie', async () => {
        // Documents the property the ordering depends on, so a future reader does
        // not "simplify" the tie-break back to createdAt alone.
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            expect(rows[0]?.createdAt).toEqual(rows[1]?.createdAt);
        });
    });

    it('excludes soft-deleted rows by default', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_05,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            const { eq } = await import('drizzle-orm');
            await tx
                .update(partnerMentions)
                .set({ deletedAt: new Date() })
                .where(eq(partnerMentions.id, rows[0]?.id as string));

            expect(await model.findByPartner({ tx, partnerId })).toHaveLength(1);
        });
    });

    it('returns soft-deleted rows when asked', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    }
                ]
            });

            const { eq } = await import('drizzle-orm');
            await tx
                .update(partnerMentions)
                .set({ deletedAt: new Date() })
                .where(eq(partnerMentions.id, rows[0]?.id as string));

            expect(
                await model.findByPartner({ tx, partnerId, filters: { includeDeleted: true } })
            ).toHaveLength(1);
        });
    });

    it('scopes to the requested partner only', async () => {
        await withTestTransaction(async (tx) => {
            const aId = await seedPartner(tx);
            const bId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId: aId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId: bId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            const rows = await model.findByPartner({ tx, partnerId: aId });

            expect(rows).toHaveLength(1);
            expect(rows[0]?.partnerId).toBe(aId);
        });
    });

    it('filters by channel', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_05,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            const rows = await model.findByPartner({
                tx,
                partnerId,
                filters: { channel: 'FACEBOOK' }
            });

            expect(rows).toHaveLength(1);
            expect(rows[0]?.channel).toBe('FACEBOOK');
        });
    });

    it('filters by mentionedAt range', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_05,
                        url: 'https://fb.test/2'
                    },
                    { partnerId, channel: 'TIKTOK', mentionedAt: AUG_10, url: 'https://tt.test/3' }
                ]
            });

            const rows = await model.findByPartner({
                tx,
                partnerId,
                filters: { mentionedAfter: AUG_05, mentionedBefore: AUG_10 }
            });

            expect(rows.map((r) => r.channel)).toEqual(['TIKTOK', 'FACEBOOK']);
        });
    });

    it('paginates without repeating or dropping a row across pages', async () => {
        // Every row shares one mentionedAt, which is what a multi-network batch
        // looks like. Without the createdAt tie-break the ordering is unstable and
        // page 2 can return a row already seen on page 1.
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    },
                    { partnerId, channel: 'TIKTOK', mentionedAt: AUG_01, url: 'https://tt.test/3' },
                    { partnerId, channel: 'YOUTUBE', mentionedAt: AUG_01, url: 'https://yt.test/4' }
                ]
            });

            const page1 = await model.findByPartner({
                tx,
                partnerId,
                filters: { page: 1, pageSize: 2 }
            });
            const page2 = await model.findByPartner({
                tx,
                partnerId,
                filters: { page: 2, pageSize: 2 }
            });

            const ids = [...page1, ...page2].map((r) => r.id);
            expect(new Set(ids).size).toBe(4);
        });
    });
});

describe('PartnerMentionModel.findByBatch', () => {
    it('returns every row of the batch in canonical channel order', async () => {
        // Inserted deliberately OUT of enum order. Postgres sorts an enum by
        // declaration order, so the result must come back reordered — inserting in
        // the expected order would let an insertion-ordered query pass by accident,
        // which is exactly how the first version of this test failed to catch a
        // sort that could not work (all batch rows share created_at).
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const batchId = crypto.randomUUID();

            await model.createMany({
                tx,
                rows: [
                    { partnerId, batchId, channel: 'WHATSAPP', mentionedAt: AUG_01, url: null },
                    {
                        partnerId,
                        batchId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    },
                    {
                        partnerId,
                        batchId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    { partnerId, channel: 'TIKTOK', mentionedAt: AUG_01, url: 'https://tt.test/3' }
                ]
            });

            const rows = await model.findByBatch({ tx, batchId });

            // The un-batched TIKTOK row must not come along, and the three batched
            // ones come back in enum order regardless of how they were inserted.
            expect(rows).toHaveLength(3);
            expect(rows.map((r) => r.channel)).toEqual(['INSTAGRAM', 'FACEBOOK', 'WHATSAPP']);
        });
    });

    it('excludes soft-deleted rows from a batch', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const batchId = crypto.randomUUID();

            const rows = await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        batchId,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        batchId,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            const { eq } = await import('drizzle-orm');
            await tx
                .update(partnerMentions)
                .set({ deletedAt: new Date() })
                .where(eq(partnerMentions.id, rows[0]?.id as string));

            expect(await model.findByBatch({ tx, batchId })).toHaveLength(1);
        });
    });

    it('does not collapse two different batches together', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            const batchA = crypto.randomUUID();
            const batchB = crypto.randomUUID();

            await model.createMany({
                tx,
                rows: [
                    {
                        partnerId,
                        batchId: batchA,
                        channel: 'INSTAGRAM',
                        mentionedAt: AUG_01,
                        url: 'https://ig.test/1'
                    },
                    {
                        partnerId,
                        batchId: batchB,
                        channel: 'FACEBOOK',
                        mentionedAt: AUG_01,
                        url: 'https://fb.test/2'
                    }
                ]
            });

            expect(await model.findByBatch({ tx, batchId: batchA })).toHaveLength(1);
            expect(await model.findByBatch({ tx, batchId: batchB })).toHaveLength(1);
        });
    });
});

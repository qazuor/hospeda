import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, getTestDb } from './helpers.ts';

afterAll(closeTestPool);

const tombstone = () => ({ status: 'CANCELLED', class: 'LAPIDA' });
const link = (subscriptionId: string, providerId: string) => ({
    subscriptionId,
    provider: 'MERCADO_PAGO',
    providerId
});

async function expectConstraint(promise: Promise<unknown>, constraint: string): Promise<void> {
    let failure: unknown;
    try {
        await promise;
    } catch (error) {
        failure = error;
    }
    // Drizzle wraps the PostgreSQL error, including errors raised at COMMIT.
    for (let depth = 0; depth < 5 && failure && typeof failure === 'object'; depth++) {
        if ('constraint' in failure && failure.constraint === constraint) return;
        failure = 'cause' in failure ? failure.cause : undefined;
    }
    throw new Error(`Expected PostgreSQL constraint ${constraint}`);
}

describe('provider_link (TEST:B3:1, DB subset)', () => {
    it('starts empty', async () => {
        expect(await getTestDb().select().from(providerLinks)).toEqual([]);
    });

    it('allows one link for a subscription and rejects a second', async () => {
        await expectConstraint(
            getTestDb().transaction(async (tx) => {
                const [row] = await tx.insert(subscriptions).values(tombstone()).returning();
                if (!row) throw new Error('Expected a subscription');
                await tx.insert(providerLinks).values(link(row.id, 'approval-1'));
                await tx.insert(providerLinks).values(link(row.id, 'approval-2'));
            }),
            'uq_provider_link_subscription'
        );
    });

    it('rejects a provider and provider id pair used by another subscription', async () => {
        await expectConstraint(
            getTestDb().transaction(async (tx) => {
                const rows = await tx
                    .insert(subscriptions)
                    .values([tombstone(), tombstone()])
                    .returning();
                if (rows.length !== 2) throw new Error('Expected two subscriptions');
                await tx.insert(providerLinks).values(link(rows[0]!.id, 'approval-1'));
                await tx.insert(providerLinks).values(link(rows[1]!.id, 'approval-1'));
            }),
            'uq_provider_link_provider_id'
        );
    });
});

describe('Coord-25: LAPIDA requires provider_link at COMMIT', () => {
    it('allows a tombstone and its link to commit together', async () => {
        const row = await getTestDb().transaction(async (tx) => {
            const [subscription] = await tx.insert(subscriptions).values(tombstone()).returning();
            if (!subscription) throw new Error('Expected a subscription');
            await tx.insert(providerLinks).values(link(subscription.id, 'approval-valid'));
            return subscription;
        });
        expect(row.class).toBe('LAPIDA');
        await getTestDb().transaction(async (tx) => {
            await tx.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.id));
            await tx.delete(subscriptions).where(eq(subscriptions.id, row.id));
        });
    });

    it('rejects an orphan tombstone at COMMIT, including when extras setup failed', async () => {
        await expectConstraint(
            getTestDb().transaction(async (tx) => {
                await tx.insert(subscriptions).values(tombstone());
            }),
            'ck_subscription_tombstone_provider_link'
        );
    });

    it('rejects deleting the link of a tombstone at COMMIT', async () => {
        await expectConstraint(
            getTestDb().transaction(async (tx) => {
                const [row] = await tx.insert(subscriptions).values(tombstone()).returning();
                if (!row) throw new Error('Expected a subscription');
                await tx.insert(providerLinks).values(link(row.id, 'approval-delete'));
                await tx.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.id));
            }),
            'ck_subscription_tombstone_provider_link'
        );
    });

    it('rejects moving the link away from a tombstone at COMMIT', async () => {
        await expectConstraint(
            getTestDb().transaction(async (tx) => {
                const rows = await tx
                    .insert(subscriptions)
                    .values([tombstone(), tombstone()])
                    .returning();
                if (rows.length !== 2) throw new Error('Expected two subscriptions');
                const [providerLink] = await tx
                    .insert(providerLinks)
                    .values(link(rows[0]!.id, 'approval-move'))
                    .returning();
                if (!providerLink) throw new Error('Expected a provider link');
                await tx
                    .update(providerLinks)
                    .set({ subscriptionId: rows[1]!.id })
                    .where(eq(providerLinks.id, providerLink.id));
            }),
            'ck_subscription_tombstone_provider_link'
        );
    });
});

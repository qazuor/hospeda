import {
    addonInstances,
    type DrizzleClient,
    inArray,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';
import { seedComplement, seedOrphanProduct } from './addon-orphan-fixtures.js';

const seeded: Array<{
    readonly complementId: string;
    readonly authorizationId: string;
    readonly instanceId: string;
    readonly productId: string;
}> = [];

/** Seeds one committed S20 complement, product and addon instance with a live fake preapproval. */
export async function seedS20Addon(input: {
    readonly fake: FakePaymentProvider;
    readonly userId: string;
    readonly vertical: string;
    readonly targetId: string;
    readonly complementStatus?: string;
    readonly instanceStatus?: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    readonly scopeType?: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly compatibleVerticals?: readonly string[];
    readonly openPause?: boolean;
}): Promise<{
    readonly instanceId: string;
    readonly complementId: string;
    readonly authorizationId: string;
    readonly productId: string;
}> {
    const { authorizationId } = await input.fake.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 500000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'permanent grant addon fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await input.fake.approve({ authorizationId });
    const result = await getServiceTestDb().transaction(async (raw) => {
        const tx = raw as unknown as DrizzleClient;
        const { subscriptionId: complementId } = await seedComplement(tx, {
            userId: input.userId,
            vertical: input.vertical,
            status: input.complementStatus ?? 'ACTIVE',
            withLink: false,
            openPause: input.openPause
        });
        await tx.insert(providerLinks).values({
            subscriptionId: complementId,
            provider: 'MERCADO_PAGO',
            providerId: authorizationId
        });
        const { productId, versionId } = await seedOrphanProduct(tx, {
            scopeType: input.scopeType ?? 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: input.compatibleVerticals ?? [input.vertical]
        });
        const [instance] = await tx
            .insert(addonInstances)
            .values({
                productId,
                addonVersionId: versionId,
                ownerId: input.userId,
                targetId: input.targetId,
                status: input.instanceStatus ?? 'ACTIVE',
                complementSubscriptionId: complementId,
                startsAt: new Date('2026-10-03T10:00:00.000Z')
            })
            .returning({ id: addonInstances.id });
        if (!instance) throw new Error('S20 fixture instance missing');
        return { instanceId: instance.id, complementId, authorizationId, productId };
    });
    seeded.push(result);
    return result;
}

/** Removes committed S20 rows and their fixture catalog rows without truncating shared tables. */
export async function retireS20Rows(): Promise<void> {
    const rows = seeded.splice(0);
    if (rows.length === 0) return;
    const db = getServiceTestDb();
    const complementIds = rows.map(({ complementId }) => complementId);
    await db
        .delete(subscriptionPauses)
        .where(inArray(subscriptionPauses.subscriptionId, complementIds));
    await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, complementIds));
    await db.delete(addonInstances).where(
        inArray(
            addonInstances.id,
            rows.map(({ instanceId }) => instanceId)
        )
    );
    await db.delete(subscriptions).where(inArray(subscriptions.id, complementIds));
}

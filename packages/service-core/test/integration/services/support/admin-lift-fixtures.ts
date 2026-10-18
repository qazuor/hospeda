import type { ReconciliationMarkReason } from '@repo/db';
import { reconciliationMarkModel, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { liftReconciliationMarkByAdmin } from '../../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';

/** Seeds a persisted actor with only action 7's permission. */
export async function seedLiftAdmin(): Promise<Actor> {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos1697-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1697 lift admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('HOS-1697 admin fixture missing');
    return {
        id: user.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]
    };
}

/** Lifts the open mark for one subscription reason with a fresh action 7 admin. */
export async function liftOpenMarkAsAdmin(input: {
    readonly subscriptionId: string;
    readonly reason: ReconciliationMarkReason;
    readonly clock?: { readonly now: () => Date };
}) {
    const mark = await reconciliationMarkModel.findOpen({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: input.reason
    });
    if (!mark) throw new Error(`No open mark for reason ${input.reason}`);
    return liftReconciliationMarkByAdmin(
        {
            actor: await seedLiftAdmin(),
            markId: mark.id,
            expectedVersion: mark.version,
            resolveWithoutRefund: []
        },
        { clock: input.clock ?? { now: () => new Date() } }
    );
}

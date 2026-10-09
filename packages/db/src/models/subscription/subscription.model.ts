import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { idempotencyKeys } from '../../schemas/vertical/idempotency-key.dbschema.ts';
import {
    type InsertProviderLink,
    providerLinks,
    type SelectProviderLink
} from '../../schemas/vertical/provider-link.dbschema.ts';
import {
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Identity and immutable anchors for the new card subscription. */
export interface CreatePendingAuthorizationInput {
    readonly userId: string;
    readonly vertical: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    /** Optional outer transaction; its caller must commit before the provider call. */
    readonly tx?: DrizzleClient;
}

/** A persisted row and its provider-call idempotency key. */
export interface PendingAuthorizationRow {
    readonly subscription: SelectSubscription;
    readonly idempotencyKey: string;
}

/** Subject of the CHARGE_DECLINED preapproval re-read in S1. */
export interface FindDeclinedInput {
    readonly userId: string;
    readonly vertical: string;
    readonly tx?: DrizzleClient;
}

export interface DeclinedWithProviderLink {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
}

/** Provider result persisted after the external authorization call. */
export interface RecordAuthorizationResultInput {
    readonly idempotencyKey: string;
    readonly subscriptionId: string;
    readonly provider: InsertProviderLink['provider'];
    readonly providerId: InsertProviderLink['providerId'];
    /** Sanitized, application-owned result; never a raw provider response. */
    readonly result: Record<string, unknown>;
    readonly completedAt: Date;
    readonly tx?: DrizzleClient;
}

/** Minimal S1 persistence model; no BaseModelImpl CRUD surface. */
export class SubscriptionModel {
    /** Writes the PENDING_AUTHORIZATION row and key in one transaction. */
    async createPendingAuthorization(
        input: CreatePendingAuthorizationInput
    ): Promise<PendingAuthorizationRow> {
        const write = async (tx: DrizzleClient): Promise<PendingAuthorizationRow> => {
            const [subscription] = await tx
                .insert(subscriptions)
                .values({
                    userId: input.userId,
                    vertical: input.vertical,
                    planVersionId: input.planVersionId,
                    billingOptionId: input.billingOptionId,
                    paymentMethod: 'CARD',
                    status: 'PENDING_AUTHORIZATION',
                    class: 'PRINCIPAL'
                })
                .returning();
            if (!subscription) throw new Error('Subscription insert returned no row');
            const idempotencyKey = randomUUID();
            await tx.insert(idempotencyKeys).values({
                key: idempotencyKey,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: subscription.id
            });
            return { subscription, idempotencyKey };
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }

    /** Reads every declined row and its mandate id for S1's by-id re-read. */
    async findDeclinedWithProviderLinks(
        input: FindDeclinedInput
    ): Promise<DeclinedWithProviderLink[]> {
        const db = input.tx ?? getDb();
        return db
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.vertical, input.vertical),
                    eq(subscriptions.status, 'CHARGE_DECLINED')
                )
            );
    }

    /** Atomically records the mandate id and completes its idempotency key. */
    async recordAuthorizationResult(
        input: RecordAuthorizationResultInput
    ): Promise<SelectProviderLink> {
        const write = async (tx: DrizzleClient): Promise<SelectProviderLink> => {
            const [providerLink] = await tx
                .insert(providerLinks)
                .values({
                    subscriptionId: input.subscriptionId,
                    provider: input.provider,
                    providerId: input.providerId
                })
                .returning();
            if (!providerLink) throw new Error('Provider link insert returned no row');
            const completed = await tx
                .update(idempotencyKeys)
                .set({ result: input.result, completedAt: input.completedAt })
                .where(
                    and(
                        eq(idempotencyKeys.key, input.idempotencyKey),
                        eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                        eq(idempotencyKeys.subjectId, input.subscriptionId)
                    )
                )
                .returning({ key: idempotencyKeys.key });
            if (completed.length !== 1) throw new Error('Expected one matching idempotency key');
            return providerLink;
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }
}

export const subscriptionModel = new SubscriptionModel();

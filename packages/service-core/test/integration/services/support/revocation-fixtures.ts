// Fixtures of TEST:B5:11 / TEST:B5:12 (S36, HOS-1543): seeded rows over the migrated database,
// the real fake provider behind a Proxy, and spies for the notice and the coverage listener.
// Every row is born with random ids; `retireRevocationRows` takes them out of every live
// population after each test. `domain_event` is append-only (extras 056), so the decision
// events of our CANCELLED rows stay; their 3-day retry window is anchored in October 2026.
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    coverageLosses,
    emailOutbox,
    eq,
    inArray,
    manualPayments,
    payments,
    providerLinks,
    refunds,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { vi } from 'vitest';
import type { CoverageNotices } from '../../../../src/services/billing/payment/payment-ports.js';
import type {
    RevocationOrigin,
    RevokeSubscriptionPorts
} from '../../../../src/services/billing/subscription/revoke-subscription.service.js';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../../src/services/billing/subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';
import { paymentFixture } from './payment-fixtures.js';

export const DAY_MS = 86_400_000;
/** 2026-10-01 10:00 in Buenos Aires: the day-0 charge. The fixture clock starts 2026-10-01 00:00 AR. */
export const CHARGE_DAY_0 = new Date('2026-10-01T13:00:00.000Z');

const subscriptionIds: string[] = [];
const userIds: string[] = [];

/** Takes every seeded row out of the live populations; children first. */
export async function retireRevocationRows(): Promise<void> {
    const db = getServiceTestDb();
    const subs = subscriptionIds.splice(0);
    const people = userIds.splice(0);
    if (subs.length > 0) {
        const paid = await db
            .select({ id: payments.id })
            .from(payments)
            .where(inArray(payments.subscriptionId, subs));
        const manual = await db
            .select({ id: manualPayments.id })
            .from(manualPayments)
            .where(inArray(manualPayments.subscriptionId, subs));
        if (paid.length > 0)
            await db.delete(refunds).where(
                inArray(
                    refunds.paymentId,
                    paid.map(({ id }) => id)
                )
            );
        if (manual.length > 0)
            await db.delete(refunds).where(
                inArray(
                    refunds.manualPaymentId,
                    manual.map(({ id }) => id)
                )
            );
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, subs));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subs));
    }
    if (people.length > 0) {
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, people));
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, people));
    }
}

/** Track a row created by a test so `retireRevocationRows` takes it out. */
export function trackSubscription(id: string): void {
    subscriptionIds.push(id);
}

/** A seeded person holding action 8's own permission (SUPER_ADMIN, D-2). */
export async function seedRevocationActor(
    permissions: readonly PermissionEnum[] = [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
    roles: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN]
): Promise<Actor> {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b55-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'B5.5 admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('revocation actor missing');
    return { id: user.id, roles: [...roles], permissions: [...permissions] };
}

/** A credited provider payment of `amount` on `subscriptionId`, credited at `factAt`. */
export async function seedCreditedPayment(input: {
    readonly subscriptionId: string;
    readonly factAt: Date;
    readonly amount?: number;
    readonly status?: 'SUCCEEDED' | 'REFUNDED' | 'CHARGED_BACK';
}) {
    const [row] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amount ?? 10000,
            currency: 'ARS',
            status: input.status ?? 'SUCCEEDED',
            refundedAmount: input.status === 'REFUNDED' ? (input.amount ?? 10000) : 0,
            provider: 'MERCADO_PAGO',
            providerFactId: `b55-${crypto.randomUUID()}`,
            factAt: input.factAt
        })
        .returning();
    if (!row) throw new Error('revocation payment missing');
    return row;
}

/** One subscription row read back. */
export async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('subscription disappeared');
    return row;
}

/** Status read through ANOTHER connection: what a reader outside the act sees. */
async function committedStatus(id: string): Promise<string | undefined> {
    const { rows } = await getServiceTestPool().query<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [id]
    );
    return rows[0]?.status;
}

/** The committed `coverage_loss.lost_at` of a person, read through ANOTHER connection. */
async function committedLoss(userId: string): Promise<Date | null> {
    const { rows } = await getServiceTestPool().query<{ lost_at: Date }>(
        'SELECT lost_at FROM coverage_loss WHERE user_id = $1',
        [userId]
    );
    return rows[0]?.lost_at ?? null;
}

/** Inserts a principal row next to the fixture's (same user, version and option). */
export async function seedSiblingPrincipal(input: {
    readonly like: {
        readonly userId: string;
        readonly planVersionId: string;
        readonly optionId: string;
    };
    readonly status: string;
    readonly succeedsId?: string;
    readonly succeededById?: string;
    readonly paymentMethod?: 'CARD' | 'MANUAL';
}) {
    const [row] = await getServiceTestDb()
        .insert(subscriptions)
        .values({
            userId: input.like.userId,
            vertical: 'accommodation',
            planVersionId: input.like.planVersionId,
            billingOptionId: input.like.optionId,
            paymentMethod: input.paymentMethod ?? 'CARD',
            status: input.status,
            class: 'PRINCIPAL',
            succeedsId: input.succeedsId ?? null,
            succeededById: input.succeededById ?? null
        })
        .returning();
    if (!row) throw new Error('sibling principal missing');
    subscriptionIds.push(row.id);
    return row;
}

/**
 * A CARD principal with its provider link and a real preapproval in the fake, moved to
 * `origin`, with a credited payment of 10 000 at `chargedAt`, plus the spies of the act.
 */
export async function revocationFixture({
    origin = 'ACTIVE',
    pauseReason = 'CUSTOMER_REQUEST',
    chargedAt = CHARGE_DAY_0,
    notice = 'SENT',
    withPayment = true
}: {
    readonly origin?: RevocationOrigin;
    readonly pauseReason?: 'CUSTOMER_REQUEST' | 'COURTESY';
    readonly chargedAt?: Date;
    readonly notice?: BeforeCancelNoticeStatus;
    readonly withPayment?: boolean;
} = {}) {
    const fixture = await paymentFixture();
    const subscriptionId = fixture.started.subscriptionId;
    const authorizationId = fixture.started.authorizationId;
    subscriptionIds.push(subscriptionId);
    userIds.push(fixture.user.id);
    const db = getServiceTestDb();
    const base = await subscriptionRow(subscriptionId);

    const day = (n: number) => new Date(CHARGE_DAY_0.getTime() + n * DAY_MS);
    const setUp: Readonly<Record<RevocationOrigin, () => Promise<void>>> = {
        ACTIVE: async () => {},
        GRACE_PERIOD: async () => {
            await db
                .update(subscriptions)
                .set({ status: 'GRACE_PERIOD', graceStartedAt: day(2), graceEndsAt: day(12) })
                .where(eq(subscriptions.id, subscriptionId));
        },
        CANCEL_SCHEDULED: async () => {
            await fixture.provider.cancel({ authorizationId });
            await db
                .update(subscriptions)
                .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: day(31) })
                .where(eq(subscriptions.id, subscriptionId));
        },
        PAUSED: async () => {
            await fixture.provider.pause({ authorizationId });
            await db
                .update(subscriptions)
                .set({ status: 'PAUSED' })
                .where(eq(subscriptions.id, subscriptionId));
            await db.insert(subscriptionPauses).values([
                {
                    subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    requestedMonths: 1,
                    startsAt: new Date('2026-06-01T03:00:00.000Z'),
                    expectedEndAt: new Date('2026-07-01T03:00:00.000Z'),
                    actualEndAt: new Date('2026-07-01T03:00:00.000Z')
                },
                {
                    subscriptionId,
                    reason: pauseReason,
                    requestedMonths: 2,
                    startsAt: day(2),
                    expectedEndAt: day(62)
                }
            ]);
        }
    };
    await setUp[origin]();
    const payment = withPayment
        ? await seedCreditedPayment({ subscriptionId, factAt: chargedAt })
        : null;

    const sequence: string[] = [];
    let noticeStatus: BeforeCancelNoticeStatus = notice;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => {
        sequence.push('notice');
        return noticeStatus;
    });

    const coverageSeen: { event: CoverageChangedEvent; statusAtEmit: string | undefined }[] = [];
    const lossAtEmit: (Date | null)[] = [];
    let coverageBehaviour: 'OK' | 'THROW' = 'OK';
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            coverageSeen.push({ event, statusAtEmit: await committedStatus(subscriptionId) });
            lossAtEmit.push(await committedLoss(fixture.user.id));
            if (coverageBehaviour === 'THROW') throw new Error('coverage listener down');
        })
    };

    let cancelBehaviour: 'OK' | 'THROW' = 'OK';
    const real = fixture.provider as PaymentProvider;
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => {
        sequence.push('cancel');
        if (cancelBehaviour === 'THROW') throw new Error('provider cancel failed');
        return real.cancel(input);
    });
    const provider = new Proxy(real, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });

    const annotations: { kind: 'seen' | 'alive'; at: Date }[] = [];
    const cancellationSeen = {
        async annotateCancellationSeen({ seenAt }) {
            annotations.push({ kind: 'seen', at: seenAt });
        },
        async clearCancellationSeen({ seenAliveAt }) {
            annotations.push({ kind: 'alive', at: seenAliveAt });
        }
    } satisfies CancellationSeenAnnotator;

    const ports: RevokeSubscriptionPorts = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice: { beforeCancel },
        coverageNotices,
        cancellationSeen
    };

    /** Moves the fixture clock to `instant`. */
    const at = (instant: Date) => {
        fixture.clock.advance({ ms: instant.getTime() - fixture.clock.now().getTime() });
    };
    const authorizationStatus = async () => {
        const read = await real.readAuthorization({ authorizationId });
        return read.snapshot.status;
    };

    return {
        fixture,
        subscriptionId,
        authorizationId,
        userId: fixture.user.id,
        planVersionId: base.planVersionId ?? '',
        optionId: base.billingOptionId ?? '',
        payment,
        ports,
        sequence,
        beforeCancel,
        coverageSeen,
        lossAtEmit,
        coverageNotices,
        cancel,
        annotations,
        at,
        day,
        authorizationStatus,
        setNotice: (status: BeforeCancelNoticeStatus) => {
            noticeStatus = status;
        },
        setCancel: (behaviour: 'OK' | 'THROW') => {
            cancelBehaviour = behaviour;
        },
        setCoverage: (behaviour: 'OK' | 'THROW') => {
            coverageBehaviour = behaviour;
        }
    };
}

/** A revocation fixture as returned by `revocationFixture`. */
export type RevocationFixture = Awaited<ReturnType<typeof revocationFixture>>;

/** Everything a rejected act must leave untouched, read back for an equality check. */
export async function untouchedState(f: RevocationFixture) {
    const db = getServiceTestDb();
    const row = await subscriptionRow(f.subscriptionId);
    const paymentRefunds = f.payment
        ? await db.select().from(refunds).where(eq(refunds.paymentId, f.payment.id))
        : [];
    const pauses = await db
        .select()
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, f.subscriptionId));
    const outbox = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, f.userId));
    const losses = await db
        .select()
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, f.userId));
    const [link] = await db
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, f.subscriptionId));
    return {
        status: row.status,
        serviceEndsAt: row.serviceEndsAt,
        graceEndsAt: row.graceEndsAt,
        updatedAt: row.updatedAt,
        refunds: paymentRefunds,
        pauses,
        outbox,
        losses,
        link,
        calls: f.cancel.mock.calls.length,
        notices: f.beforeCancel.mock.calls.length
    };
}

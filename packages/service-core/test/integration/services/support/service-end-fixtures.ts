/**
 * Fixtures for S12 and its run (HOS-1569, B8a.2). Every helper writes through the transaction it
 * receives, so a test run inside `withServiceTestTransaction` leaves no row behind. The run reads
 * the GLOBAL population of the shared database, so its tests pass the test transaction as `db`
 * and read "now" in 2001 ({@link serviceEndNow}), before every committed `CANCEL_SCHEDULED` other
 * suites leave (2026): the run only sees and locks its own rows (notas I-5). Reuses
 * `addon-orphan-fixtures.ts` and `coverage-fixtures.ts` without editing them.
 */
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    type DrizzleClient,
    eq,
    providerLinks,
    sql,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { vi } from 'vitest';
import type { EndScheduledServicesPorts } from '../../../../src/services/billing/subscription/end-scheduled-services.service';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service';
import type { SuccessionCloser } from '../../../../src/services/billing/subscription/subscription-billing-ports';
import { orphanPorts, seedComplement } from './addon-orphan-fixtures';
import { seedCoveragePlanVersion } from './coverage-fixtures';

/** The instant every S12 run test reads as "now" (2001: isolated from other suites, notas I-5). */
export const serviceEndNow = new Date('2001-06-01T12:00:00.000Z');

/** An end-of-service date already reached at {@link serviceEndNow}. */
export const serviceEndPast = new Date('2001-05-31T00:00:00.000Z');

/** An end-of-service date not yet reached at {@link serviceEndNow}. */
export const serviceEndFuture = new Date('2001-07-01T00:00:00.000Z');

/** The `updated_at` every seeded row starts with. */
export const seededUpdatedAt = new Date('2001-05-01T10:00:00.000Z');

/** A PRINCIPAL row with an end-of-service date (the orphan fixture's `seedPrincipal` has none). */
export async function seedServiceEndPrincipal(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly vertical: string;
        readonly status: string;
        readonly serviceEndsAt?: Date | null;
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly predecessorId?: string | null;
        readonly grace?: boolean;
    }
): Promise<{ readonly subscriptionId: string }> {
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(tx, input.vertical);
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            planVersionId,
            billingOptionId,
            paymentMethod: input.paymentMethod ?? 'CARD',
            status: input.status,
            class: 'PRINCIPAL',
            serviceEndsAt: input.serviceEndsAt ?? null,
            succeedsId: input.predecessorId ?? null,
            graceStartedAt: input.grace ? new Date('2001-05-20T10:00:00.000Z') : null,
            graceEndsAt: input.grace ? new Date('2001-05-27T10:00:00.000Z') : null,
            updatedAt: seededUpdatedAt
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('service-end fixture principal missing');
    return { subscriptionId: row.id };
}

/** A COMPLEMENTO row linked to a REAL preapproval of the fake (or to none). */
export async function seedServiceEndComplement(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly vertical: string;
        readonly status: string;
        readonly serviceEndsAt?: Date | null;
        readonly authorizationId?: string | null;
    }
): Promise<{ readonly subscriptionId: string }> {
    const { subscriptionId } = await seedComplement(tx, {
        userId: input.userId,
        vertical: input.vertical,
        status: input.status,
        serviceEndsAt: input.serviceEndsAt ?? null,
        withLink: false
    });
    if (input.authorizationId)
        await tx.insert(providerLinks).values({
            subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: input.authorizationId
        });
    return { subscriptionId };
}

/**
 * The fake behind a Proxy whose `cancel` is a spy, plus a recording notice, a stub of our
 * before-cancel notice and a log the doubles below append to.
 */
export function serviceEndHarness() {
    const clock = { now: () => serviceEndNow };
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => fake.cancel(input));
    const provider = new Proxy(fake as unknown as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    const events: CoverageChangedEvent[] = [];
    const coverageNotices = {
        async emitCoverageChanged(event: CoverageChangedEvent) {
            events.push(event);
        }
    };
    const beforeCancelCalls: Parameters<BeforeCancelNotice['beforeCancel']>[0][] = [];
    const beforeCancelNotice: BeforeCancelNotice = {
        async beforeCancel(input) {
            beforeCancelCalls.push(input);
            return 'SENT';
        }
    };
    const log: string[] = [];
    return {
        clock,
        fake,
        provider,
        cancel,
        events,
        coverageNotices,
        beforeCancelCalls,
        beforeCancelNotice,
        log
    };
}

/** A real, approved preapproval of the fake; cancelled first when asked (S11 cancelled it). */
export async function fakePreapproval(
    fake: FakePaymentProvider,
    input: { readonly cancelled: boolean }
): Promise<string> {
    const { authorizationId } = await fake.authorize({
        reference: `service-end-${crypto.randomUUID()}`,
        amount: { amountMinor: 500000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'S12 fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId });
    if (input.cancelled) await fake.cancel({ authorizationId });
    return authorizationId;
}

/** A `SuccessionCloser` that records each call (and appends `closer` to `log`). */
export function recordingSuccessionCloser(log: string[]) {
    const calls: { readonly predecessorSubscriptionId: string; readonly tx: DrizzleClient }[] = [];
    const successionCloser: SuccessionCloser = {
        async closeSuccession(input) {
            log.push('closer');
            calls.push(input);
        }
    };
    return { successionCloser, calls };
}

/** A `SuccessionCloser` that always throws (S18's port failing). */
export function failingSuccessionCloser(): SuccessionCloser {
    return {
        async closeSuccession() {
            throw new Error('succession closer down');
        }
    };
}

/**
 * The run's ports over the test transaction: the harness, the programmable `ficha` and anchors of
 * `orphanPorts`, and a `políticaDeAddon` that appends `addonPolicy` to `log` on each read.
 */
export function serviceEndPorts(
    tx: DrizzleClient,
    harness: ReturnType<typeof serviceEndHarness>,
    extra: { readonly successionCloser?: SuccessionCloser } = {}
) {
    const orphan = orphanPorts(tx);
    const ports: EndScheduledServicesPorts = {
        clock: harness.clock,
        provider: harness.provider,
        beforeCancelNotice: harness.beforeCancelNotice,
        coverageNotices: harness.coverageNotices,
        addonPolicy: async (input) => {
            harness.log.push('addonPolicy');
            return orphan.ports.addonPolicy(input);
        },
        listing: orphan.ports.listing,
        liveAnchors: orphan.ports.liveAnchors,
        successionCloser: extra.successionCloser
    };
    return { ports, setListing: orphan.setListing };
}

/** The coverage loss of a `(user, vertical)`, or null. */
export async function readCoverageLoss(
    tx: DrizzleClient,
    input: { readonly userId: string; readonly vertical: string }
) {
    const [row] = await tx
        .select({ lostAt: coverageLosses.lostAt, updatedAt: coverageLosses.updatedAt })
        .from(coverageLosses)
        .where(
            and(
                eq(coverageLosses.userId, input.userId),
                eq(coverageLosses.vertical, input.vertical)
            )
        );
    return row ?? null;
}

/**
 * The physical version of a subscription row (`ctid`): every UPDATE writes a new tuple, so a
 * changed `ctid` proves a write even inside one transaction, where the `set_updated_at` trigger
 * (extras 002) stamps every update with the same transaction-start `NOW()`.
 */
export async function readRowVersion(tx: DrizzleClient, subscriptionId: string): Promise<string> {
    const result = await tx.execute<{ version: string }>(
        sql`SELECT ctid::text AS version FROM subscription WHERE id = ${subscriptionId}`
    );
    const version = result.rows?.[0]?.version;
    if (!version) throw new Error(`subscription ${subscriptionId} missing`);
    return version;
}

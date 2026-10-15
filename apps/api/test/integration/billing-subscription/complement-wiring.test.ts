import {
    and,
    emailOutbox,
    eq,
    getDb,
    isNull,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    complementNow,
    retireComplementRows,
    seedCommittedComplement
} from '../../../../../packages/service-core/test/integration/services/support/complement-fixtures';
import { billingReconciliationSweepJob } from '../../../src/cron/jobs/billing-reconciliation-sweep.job';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { buildMercadoPagoNoticePorts } from '../../../src/routes/webhooks/mercadopago-ports';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';

const at = new Date('2026-10-20T12:00:00.000Z');
const clock = { now: () => at };

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});

afterEach(async () => {
    await retireComplementRows();
});

describe('HOS-1562 AC:B7:22 los puertos de producción pausan los complementos por la raíz real', () => {
    it('TEST:B7:14 suspends the grace principal and pauses its linked complement through real cron ports', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedCommittedComplement({
            fake,
            principalStatus: 'GRACE_PERIOD',
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const principalAuthorization = await fake.authorize({
            reference: `principal-${crypto.randomUUID()}`,
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'principal grace fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `principal-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: principalAuthorization.authorizationId });
        const db = getDb();
        const graceEndsAt = new Date(complementNow.getTime() - 1);
        await db.insert(providerLinks).values({
            subscriptionId: seeded.principalId,
            provider: 'MERCADO_PAGO',
            providerId: principalAuthorization.authorizationId
        });
        await db
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(complementNow.getTime() - 20 * 86_400_000),
                graceEndsAt
            })
            .where(eq(subscriptions.id, seeded.principalId));
        await beforeCancelNotice.beforeCancel({
            subscriptionId: seeded.principalId,
            userId: seeded.userId,
            kind: 'ARREARS_SUSPENSION',
            occurrenceId: `${seeded.principalId}:grace-expired:${graceEndsAt.toISOString()}`
        });
        await db
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.recipientUserId, seeded.userId));
        injectPaymentProvider({ provider: fake as unknown as PaymentProvider });
        const receiverPorts = buildMercadoPagoNoticePorts();
        expect(typeof receiverPorts.complements.addonPolicy).toBe('function');
        expect(typeof receiverPorts.complements.listing).toBe('function');

        await billingReconciliationSweepJob.handler({
            logger: { info() {}, warn() {}, error() {}, debug() {} },
            startedAt: at,
            runId: crypto.randomUUID(),
            correlationId: crypto.randomUUID(),
            dryRun: false
        });

        const [principal] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.principalId));
        const [complement] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        const pauses = await db
            .select({ expectedEndAt: subscriptionPauses.expectedEndAt })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, seeded.complementId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );

        expect(principal?.status).toBe('SUSPENDED');
        expect(complement?.status).toBe('PAUSED');
        expect(pauses).toHaveLength(1);
        expect(pauses[0]?.expectedEndAt).toBeNull();
    });
});

import { randomUUID } from 'node:crypto';
import { and, billingDeadlineVersions, emailOutbox, eq, getDb } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { initApp } from '../../../src/app';
import { billingReconciliationSweepJob } from '../../../src/cron/jobs/billing-reconciliation-sweep.job';
import type { CronJobContext } from '../../../src/cron/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    SIGNING_KEY
} from './mercadopago-delegates-fixtures';

const START = new Date('2026-10-12T12:00:00.000Z');

/** Shared API, database and HTTP-provider setup for the period charge proofs. */
export async function startPeriodChargesFixture() {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
    await testDb.setup();
    validateApiEnv();
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({ clock, idNamespace: randomUUID() });
    const subjects = createSubjects();
    const server = await startFakeProviderServer({ provider: fake, clock });
    const app = initApp({
        clock,
        paymentProvider: new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        })
    });
    await getDb()
        .insert(billingDeadlineVersions)
        .values({
            version: 1,
            values: {
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '13': { daysBefore: [5, 1] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            }
        })
        .onConflictDoNothing();
    const billingOptionId = await createSignupOption();
    const lifterId = await createLifter();

    return {
        app,
        billingOptionId,
        clock,
        fake,
        lifterId,
        server,
        subjects,
        async runSweep() {
            const ctx: CronJobContext = {
                logger: { info() {}, warn() {}, error() {}, debug() {} },
                startedAt: clock.now(),
                runId: randomUUID(),
                correlationId: randomUUID(),
                dryRun: false
            };
            return billingReconciliationSweepJob.handler(ctx);
        },
        async markOutboxSent(input: { readonly userId: string; readonly template: string }) {
            return getDb()
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, input.userId),
                        eq(emailOutbox.template, input.template)
                    )
                );
        },
        async stop() {
            await server.close();
            await testDb.teardown();
        }
    };
}

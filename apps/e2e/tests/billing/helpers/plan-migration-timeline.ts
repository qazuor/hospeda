import { randomUUID } from 'node:crypto';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import type { FakeProviderRequest } from '@repo/payments/fake-server';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import {
    API_URL,
    decodeHtmlEntities,
    deliverNotices,
    type FakeWorld,
    runCron
} from '../../../fixtures/arrears-cycle.ts';
import { waitForSubscriptionStatus } from '../../../fixtures/cancellation-flow.ts';
import {
    acceptedRunId,
    cronTriggerUrl,
    waitForAcceptedCronRun
} from '../../../fixtures/cron-run-wait.ts';
import { execSQL } from '../../../fixtures/db-helpers.ts';

const CronBody = z.object({
    success: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    data: z
        .object({
            success: z.boolean().optional(),
            details: z.record(z.string(), z.unknown()).optional()
        })
        .optional()
});

/** Outcome of one admin cron trigger with its full `details` object. */
export interface CronOutcome {
    readonly success: boolean;
    readonly details: Readonly<Record<string, unknown>>;
}

/**
 * Trigger an admin cron and keep every `details` key.
 *
 * `runCron` (fixtures/arrears-cycle.ts) parses `details` down to
 * `failedSubscriptionIds`; `plan-migration-application` reports its per-verdict
 * counts (`waiting`, `appliedManual`, `appliedCard`, ...) there, so this reads
 * them whole, from the HTTP body (201) or from `cron_runs` (202, exclusive job).
 */
export async function runCronDetails(args: {
    readonly jobName: string;
    readonly adminCookie: string;
}): Promise<CronOutcome> {
    const response = await fetch(cronTriggerUrl({ apiUrl: API_URL, jobName: args.jobName }), {
        method: 'POST',
        headers: { cookie: args.adminCookie }
    });
    const text = await response.text();
    if (response.status === 202) {
        const runId = acceptedRunId(JSON.parse(text));
        if (!runId) throw new Error(`Cron ${args.jobName} answered 202 without a run id: ${text}`);
        const run = await waitForAcceptedCronRun({ runId, jobName: args.jobName });
        return { success: run.success, details: run.details };
    }
    if (response.status !== 201)
        throw new Error(`Expected cron ${args.jobName} HTTP 201; got ${response.status}: ${text}`);
    const body = CronBody.parse(JSON.parse(text));
    const data = body.data ?? body;
    return { success: data.success ?? false, details: data.details ?? {} };
}

/** Read one numeric counter from cron details (absent counts as zero). */
export function detailCount(outcome: CronOutcome, key: string): number {
    const value = outcome.details[key];
    return typeof value === 'number' ? value : 0;
}

/** One card payer whose provider renewals the timeline drives. */
export interface RenewalPayer {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    /**
     * Local day (`YYYY-MM-DD`) of the migration date. When set, the renewal whose
     * FOLLOWING charge lands on or after it is declined instead of credited, so the
     * payer enters grace in the last cycle before the migration date.
     */
    readonly declineLastBefore?: string;
}

function oneProviderCycleLater(at: Date): Date {
    // Mirrors the fake's advanceNextCharge: setUTCMonth(+1).
    const next = new Date(at);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
}

async function succeededPayments(subscriptionId: string): Promise<number> {
    const [row] = await execSQL<{ total: number }>(
        `SELECT count(*)::int AS total FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED'`,
        [subscriptionId]
    );
    return row?.total ?? 0;
}

async function creditRenewal(args: {
    readonly world: FakeWorld;
    readonly payer: RenewalPayer;
}): Promise<void> {
    const before = await succeededPayments(args.payer.subscriptionId);
    const { snapshot } = await args.world.fakeServer.provider.readAuthorization({
        authorizationId: args.payer.authorizationId
    });
    if (!snapshot.amount) throw new Error(`No amount on ${args.payer.authorizationId}.`);
    await args.world.fakeServer.provider.charge({
        authorizationId: args.payer.authorizationId,
        amount: snapshot.amount,
        reference: `b12-${randomUUID()}`
    });
    await deliverNotices({ fakeServer: args.world.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
    const deadline = Date.now() + 30_000;
    while (Date.now() <= deadline) {
        if ((await succeededPayments(args.payer.subscriptionId)) > before) return;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Renewal of ${args.payer.subscriptionId} never became a SUCCEEDED payment.`);
}

/**
 * Move the shared clock to `at`, crediting (or declining) every provider renewal
 * that falls due on the way, each followed by the reconciliation sweep that copies
 * the provider's next charge date onto the subscription (HOS-1685). `S37` refuses
 * a row whose next charge day is not its application date, so the card payers
 * must really renew up to it.
 *
 * @returns The subscriptions whose renewal was declined (they are in grace now)
 */
export async function advanceThroughRenewals(args: {
    readonly world: FakeWorld;
    readonly adminCookie: string;
    readonly payers: readonly RenewalPayer[];
    readonly at: Date;
}): Promise<{ readonly declined: readonly string[] }> {
    let payers = [...args.payers];
    const declined: string[] = [];
    for (let cycle = 0; cycle < 12; cycle += 1) {
        const due: { readonly payer: RenewalPayer; readonly chargeAt: Date }[] = [];
        for (const payer of payers) {
            const { snapshot } = await args.world.fakeServer.provider.readAuthorization({
                authorizationId: payer.authorizationId
            });
            if (snapshot.status !== 'active' || !snapshot.nextChargeAt) continue;
            const chargeAt = new Date(snapshot.nextChargeAt);
            if (chargeAt.getTime() <= args.at.getTime()) due.push({ payer, chargeAt });
        }
        if (due.length === 0) break;
        const latest = Math.max(...due.map(({ chargeAt }) => chargeAt.getTime()));
        const stepAt = Math.min(latest + 60_000, args.at.getTime());
        if (stepAt > args.world.clock.now().getTime())
            await args.world.fakeServer.setClock({ at: new Date(stepAt) });
        for (const { payer, chargeAt } of due) {
            const following = getLocalDateString({ instant: oneProviderCycleLater(chargeAt) });
            if (payer.declineLastBefore && following >= payer.declineLastBefore) {
                await args.world.fakeServer.provider.declineCharge({
                    authorizationId: payer.authorizationId,
                    declineReason: 'cc_rejected_other_reason'
                });
                await deliverNotices({ fakeServer: args.world.fakeServer });
                await waitForSubscriptionStatus({
                    subscriptionId: payer.subscriptionId,
                    status: 'GRACE_PERIOD',
                    timeoutMs: 30_000
                });
                declined.push(payer.subscriptionId);
                payers = payers.filter((other) => other !== payer);
            } else {
                await creditRenewal({ world: args.world, payer });
            }
        }
        await runCron({ jobName: 'billing-reconciliation-sweep', adminCookie: args.adminCookie });
    }
    if (args.at.getTime() > args.world.clock.now().getTime())
        await args.world.fakeServer.setClock({ at: args.at });
    return { declined };
}

/** The provider amount mutations (`changeAmount`) the fake received, in order. */
export function changeAmountRequests(
    requests: readonly FakeProviderRequest[]
): readonly { readonly index: number; readonly request: FakeProviderRequest }[] {
    return requests
        .map((request, index) => ({ request, index }))
        .filter(
            ({ request }) =>
                request.method === 'PUT' &&
                request.path.startsWith('/preapproval/') &&
                typeof request.body === 'object' &&
                request.body !== null &&
                'auto_recurring' in request.body
        );
}

/** The comment React renders between two adjacent text nodes. */
const REACT_TEXT_MARKER = '<!-- -->';

/**
 * Plain text of a captured mail. React's exact text-node marker (`<!-- -->`)
 * leaves nothing behind: React puts one between adjacent text nodes, so
 * `pasará al plan {name}.` renders as `pasará al plan <!-- -->Name<!-- -->.`, and
 * a space there would split it into `Name .`. Then every tag becomes a space and
 * any stray `<` left behind is dropped too, so no markup can survive a partial
 * match.
 */
export function mailText(html: string): string {
    const stripped = html
        .split(REACT_TEXT_MARKER)
        .join('')
        .replace(/<[^>]*>/g, ' ')
        .replace(/</g, ' ');
    return decodeHtmlEntities(stripped).replace(/\s+/g, ' ').trim();
}

/** Minor units in the notification templates' `formatCurrency` shape (`$2.500,00`). */
export function formatMinorAmount(minor: number): string {
    return `$${(minor / 100).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

/** Wait until `count` mails with `subject` reached `to`; returns them in arrival order. */
export async function waitForMailCount(args: {
    readonly world: FakeWorld;
    readonly to: string;
    readonly subject: string;
    readonly count: number;
}): Promise<readonly ReturnType<FakeWorld['mailCapture']['mails']>[number][]> {
    const deadline = Date.now() + 30_000;
    while (Date.now() <= deadline) {
        const found = args.world.mailCapture
            .mailsTo({ to: args.to })
            .filter(({ subject }) => subject === args.subject);
        if (found.length >= args.count) return found;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Expected ${args.count} "${args.subject}" mails to ${args.to}.`);
}

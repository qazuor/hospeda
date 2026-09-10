/**
 * @file subscription-charge-receipt-sites.guard.test.ts
 * @description Static guard: every site that settles a MercadoPago
 * `subscription_authorized_payment` into `billing_payments` must also dispatch
 * that charge's customer receipt.
 *
 * ## The defect class
 *
 * HOS-1238: the live webhook handler recorded a recurring charge and
 * acknowledged MercadoPago without telling the customer anything. Since HOS-171
 * that handler is the ONLY way a Hospeda subscription is ever charged, so the
 * gap covered every paying subscriber on the platform — measured over four real
 * staging charges, all four silent.
 *
 * It was not one forgotten line. There are TWO settlement sites — the live
 * handler and the dead-letter retry cron, which re-settles exactly the charges
 * whose live delivery failed, i.e. the ones most likely to have left a debited
 * customer uninformed. The repo's recurring failure mode is a correct gate in one
 * of N places, so the property worth freezing is not "the handler sends a
 * receipt" but "every settler does".
 *
 * ## Why `routeAddonAuthorizedPayment` is the anchor
 *
 * A name-anchored guard dies at the first rename, and it dies silently inside the
 * very PR that does the renaming. So this anchors on the token a settlement site
 * cannot exist without: before resolving a plan subscription, every such site MUST
 * first ask whether the preapproval belongs to a recurring add-on
 * (`routeAddonAuthorizedPayment`). Skipping it books an add-on's charge as a plan
 * renewal and burns its payment id (HOS-847 PR 5) — which is why a future third
 * settler will carry that call, and will therefore be discovered here rather than
 * shipping mute.
 *
 * The guard deliberately carries NO exemption list. An exemption is exactly where
 * the next regression would sit.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = resolve(__dirname, '../../src');

/**
 * The module that DEFINES the add-on routing. It is the only file allowed to name
 * `routeAddonAuthorizedPayment` without dispatching a receipt, because it settles
 * an ADD-ON's own preapproval rather than a plan subscription — a different
 * product domain with its own lifecycle (HOS-847).
 */
const ADDON_ROUTER_DEFINITION = 'routes/webhooks/mercadopago/addon-recurring-handler.ts';

/** The receipt dispatcher every plan-charge settler must reach. */
const RECEIPT_DISPATCHER = 'dispatchSubscriptionChargeReceipt';

/** A CALL to the add-on router — the marker of "this file settles an authorized payment". */
const ADDON_ROUTING_CALL = /\brouteAddonAuthorizedPayment\s*\(/;

/**
 * Every `.ts` file under `apps/api/src`, as repo-relative paths.
 *
 * @param dir - Directory to walk.
 * @returns Absolute paths of every `.ts` file beneath it.
 */
function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectTsFiles(full));
        } else if (entry.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Strips block and line comments, so the prose in this repo's generous docblocks
 * cannot satisfy — or trip — an assertion about live code.
 *
 * @param source - Raw module source.
 * @returns The same source with every comment removed.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('HOS-1238 guard: every authorized-payment settler dispatches its receipt', () => {
    const settlementSites = collectTsFiles(API_SRC)
        .map((absolute) => ({
            path: relative(API_SRC, absolute).split('\\').join('/'),
            code: stripComments(readFileSync(absolute, 'utf-8'))
        }))
        .filter(
            (file) => file.path !== ADDON_ROUTER_DEFINITION && ADDON_ROUTING_CALL.test(file.code)
        );

    // Without this the guard could pass vacuously: a rename of the anchor would
    // leave zero sites to check and every assertion below would be satisfied by an
    // empty list. Two sites exist today (the live handler and the dead-letter retry
    // cron); a third is allowed, zero is not.
    it('finds the settlement sites it is meant to check', () => {
        expect(
            settlementSites.map((f) => f.path).sort(),
            'No file under apps/api/src calls routeAddonAuthorizedPayment() any more, so ' +
                'this guard has nothing to check and would pass on a codebase that sends no ' +
                'receipts at all. The anchor was renamed or the add-on routing was removed — ' +
                'either way, re-point the guard deliberately rather than leaving it vacuous.'
        ).toEqual([
            'cron/jobs/webhook-retry.job.ts',
            'routes/webhooks/mercadopago/subscription-payment-handler.ts'
        ]);
    });

    it.each([
        'cron/jobs/webhook-retry.job.ts',
        'routes/webhooks/mercadopago/subscription-payment-handler.ts'
    ])('%s dispatches the charge receipt', (path) => {
        const file = settlementSites.find((f) => f.path === path);
        expect(file, `${path} is no longer a settlement site — update this guard`).toBeDefined();
        expect(
            file?.code,
            `${path} settles a subscription_authorized_payment into billing_payments but never ` +
                `calls ${RECEIPT_DISPATCHER}. A charge recorded without a receipt is HOS-1238: ` +
                'the customer is debited and told nothing, and the absence of the email is ' +
                'indistinguishable from a silent failure. Dispatch the receipt from this site ' +
                "too — it shares the live handler's per-paymentId idempotency key, so adding it " +
                'cannot produce a duplicate.'
        ).toMatch(new RegExp(`\\b${RECEIPT_DISPATCHER}\\s*\\(`));
    });

    // The dispatcher must stay the single place the receipt decision is made. A
    // second direct call to the sender from a settlement site would bypass the
    // cleared-status gate and the cross-path idempotency lookup at once — which is
    // how a correct gate in one file comes to coexist with a broken one two files
    // over.
    it.each([
        'cron/jobs/webhook-retry.job.ts',
        'routes/webhooks/mercadopago/subscription-payment-handler.ts'
    ])("%s does not reach the sender behind the dispatcher's back", (path) => {
        const file = settlementSites.find((f) => f.path === path);
        expect(
            file?.code,
            `${path} calls sendPaymentSuccessNotification directly. That skips both gates the ` +
                `dispatcher owns: the cleared-charge check (so a rejected charge could mail a ` +
                'receipt) and the per-paymentId lookup (so one charge could mail two). Route ' +
                `the send through ${RECEIPT_DISPATCHER} instead.`
        ).not.toMatch(/\bsendPaymentSuccessNotification\s*\(/);
    });
});

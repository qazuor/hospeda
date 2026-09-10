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
 * It was not one forgotten line. There are THREE settlement sites: the live
 * handler; the dead-letter retry cron, which re-settles exactly the charges whose
 * live delivery failed; and `backfillPayment`, whose whole subject is a charge the
 * webhooks acknowledged so MercadoPago never retried. Each of the last two is, by
 * construction, more likely than the first to be handling a customer who was
 * debited and never told. The repo's recurring failure mode is a correct gate in
 * one of N places, so the property worth freezing is not "the handler sends a
 * receipt" but "every settler does".
 *
 * ## What this guard checks, stated no wider than its predicate
 *
 * It checks the three files named in `CHECKED_SITES` — two DISCOVERED by the anchor
 * below, one LISTED explicitly because the anchor cannot see it. It does not, and
 * cannot, prove that no fourth settler exists anywhere in the repo; an earlier
 * version of this header claimed to freeze "every site that settles a
 * subscription_authorized_payment", which asserted more than the predicate proves.
 * What the anchor does buy is that a new site of the COMMON shape — one that routes
 * add-ons, which any authorized-payment settler must — is discovered automatically
 * and fails the exactness check until it is added deliberately.
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
 * A settler the anchor CANNOT discover, listed explicitly.
 *
 * `backfillPayment` (HOS-765) reconstructs a `billing_payments` row for a charge the
 * webhooks acknowledged and MercadoPago therefore never retried — so its typical
 * subject is an orphaned recurring charge, with the customer debited and never told.
 * It routes no add-ons, so the anchor is blind to it, and the original version of
 * this guard claimed to freeze "every site that settles a
 * subscription_authorized_payment" while its predicate could not see this one: it
 * asserted more than it proved.
 *
 * Listing it matters beyond tidiness, because writing that row SUPPRESSES the only
 * other dispatch — the dead-letter cron checks `paymentAlreadyRecorded` before its
 * own receipt and then resolves the event silently.
 */
const EXPLICIT_SETTLERS = ['services/billing/payment-reconcile.service.ts'] as const;

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
    const allFiles = collectTsFiles(API_SRC).map((absolute) => ({
        path: relative(API_SRC, absolute).split('\\').join('/'),
        code: stripComments(readFileSync(absolute, 'utf-8'))
    }));

    /** Discovered by the anchor: anything that routes add-ons settles plan charges too. */
    const discoveredSites = allFiles.filter(
        (file) => file.path !== ADDON_ROUTER_DEFINITION && ADDON_ROUTING_CALL.test(file.code)
    );

    /** Everything the guard checks: the discovered sites plus the listed one. */
    const settlementSites = [
        ...discoveredSites,
        ...EXPLICIT_SETTLERS.map((path) => {
            const file = allFiles.find((f) => f.path === path);
            if (!file) {
                throw new Error(
                    `${path} is listed in EXPLICIT_SETTLERS but no longer exists under ` +
                        'apps/api/src. If it was renamed, update the list; if it was deleted, ' +
                        'remove the entry — leaving it stale makes every assertion about it ' +
                        'match nothing (HOS-1238).'
                );
            }
            return file;
        })
    ];

    /** The three sites the assertions below run over, as `it.each` rows. */
    const CHECKED_SITES = [
        'cron/jobs/webhook-retry.job.ts',
        'routes/webhooks/mercadopago/subscription-payment-handler.ts',
        'services/billing/payment-reconcile.service.ts'
    ] as const;

    // Without this the guard could pass vacuously: a rename of the anchor would
    // leave zero sites to check and every assertion below would be satisfied by an
    // empty list.
    //
    // The list is EXACT, so a newly-added settler fails here first and has to be
    // added to the three assertions below deliberately. That is the intent — an
    // approximate "at least one" would let a third site ship unchecked — but it does
    // mean this test is the one that tells you a site appeared, not that the site is
    // wrong.
    it('finds the settlement sites it is meant to check', () => {
        expect(
            discoveredSites.map((f) => f.path).sort(),
            'No file under apps/api/src calls routeAddonAuthorizedPayment() any more, so the ' +
                'anchor discovers nothing and the assertions below would be satisfied by an ' +
                'empty list. The anchor was renamed or the add-on routing was removed — either ' +
                'way, re-point the guard deliberately rather than leaving it vacuous.'
        ).toEqual([
            'cron/jobs/webhook-retry.job.ts',
            'routes/webhooks/mercadopago/subscription-payment-handler.ts'
        ]);
        expect(settlementSites.map((f) => f.path).sort()).toEqual([...CHECKED_SITES].sort());
    });

    it.each(CHECKED_SITES)('%s dispatches the charge receipt', (path) => {
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

    // The gate inside `dispatchSubscriptionChargeReceipt` can only protect a caller
    // that hands it the truth, and the dead-letter cron did not: it passed the
    // LITERAL `'succeeded'`, reasoning that a re-settled authorized payment must have
    // cleared because it carries a `payment.id`. A REJECTED charge carries one too,
    // and the only early return on that path is `if (!details.paymentId)`. The result
    // was the thing the dispatcher's own docblock calls impossible — a receipt for
    // money that never arrived — mailed while dunning sent the failure notice for the
    // same charge.
    //
    // A unit test per site cannot close this class: the next site gets written
    // without one. So the property is frozen statically. The status is MAPPED, never
    // asserted.
    it.each(CHECKED_SITES)('%s passes a derived charge status, never a literal', (path) => {
        const file = settlementSites.find((f) => f.path === path);
        expect(file, `${path} is no longer a settlement site — update this guard`).toBeDefined();
        const literals = [...(file?.code ?? '').matchAll(/chargeStatus:\s*(['"`])/g)];
        expect(
            literals.map((m) => m[0]),
            `${path} hands \`chargeStatus\` a string LITERAL. The dispatcher's cleared-charge ` +
                'gate is the only thing between a rejected charge and a receipt saying the money ' +
                'arrived, and it reads whatever the caller passes — so a literal defeats it from ' +
                'the outside while leaving the gate itself looking intact. Pass ' +
                '`mapMpStatusToQZPayStatus(details)`, or a binding already derived from it.'
        ).toEqual([]);
    });

    // The dispatcher must stay the single place the receipt decision is made. A
    // second direct call to the sender from a settlement site would bypass the
    // cleared-status gate and the cross-path idempotency lookup at once — which is
    // how a correct gate in one file comes to coexist with a broken one two files
    // over.
    it.each(CHECKED_SITES)("%s does not reach the sender behind the dispatcher's back", (path) => {
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

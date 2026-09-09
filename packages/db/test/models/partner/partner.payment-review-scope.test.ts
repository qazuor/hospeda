/**
 * HOS-1299 — what `findDueForPaymentReview` is allowed to ask an admin about.
 *
 * The predicate is SQL, so these assertions are over the source of the method
 * body. That is deliberate and not a shortcut: the property being defended is
 * "this clause exists and is expressed this way", and a runtime test against a
 * database would only prove it for the rows that test happened to insert —
 * passing just as well against a predicate that lets `comp` through, until the
 * first comped partner exists.
 *
 * The clause that matters most is the one that looks WRONG at a glance: an
 * issue entirely about partners who do not pay, containing a branch that skips
 * partners who do not pay. The two exemptions are the whole reason:
 *
 * - `comp` — HOS-1160 opens complimentary subscriptions to partners, granting
 *   them through `reconcilePartnerForSubscription`, which seals `starts_at`
 *   (it must, or `partner-unpaid-reaper` archives the comped partner on day
 *   90). So a comped partner has a sealed start date and no payments, forever,
 *   on purpose — the exact shape this cron hunts for.
 * - `courtesy` — HOS-180 gifted cycles. Same shape, same answer.
 *
 * Without the exclusion an admin receives an email asking whether to take down
 * a partner the platform deliberately gave the product to.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITLEMENT_GRANTING_STATUSES } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTNER_MODEL = path.resolve(__dirname, '../../../src/models/partner/partner.model.ts');

/**
 * The method body, comments stripped.
 *
 * Both are needed. Sliced, because the same file holds `findUnpaidProvisioned`,
 * whose predicate is a different question about a different population — a
 * whole-file match would be satisfied by the wrong method. Stripped, because
 * the method's own docblock explains at length why `comp` is excluded, so a
 * naive `toMatch(/comp/)` would be green on a file whose predicate lost the
 * clause and kept the paragraph.
 */
function readMethodBody(): string {
    const source = readFileSync(PARTNER_MODEL, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

    const start = source.indexOf('async findDueForPaymentReview');
    expect(start, 'findDueForPaymentReview not found — was it renamed?').toBeGreaterThan(-1);
    const end = source.indexOf('async findUnpaidProvisioned', start);
    expect(end, 'findUnpaidProvisioned not found after it — the slice is wrong').toBeGreaterThan(
        start
    );

    return source.slice(start, end);
}

describe('HOS-1160 — a comped partner is never accused of not paying', () => {
    it('exempts every entitlement-granting status, comp and courtesy included', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert — the exclusion is expressed through the shared set, so a
        // future status that grants entitlements without a charge is exempt the
        // day it is added rather than the day somebody notices.
        expect(body).toMatch(/inArray\(\s*partnerSubscriptions\.status/);
        expect(body).toMatch(/ENTITLEMENT_GRANTING_STATUSES/);
    });

    it('does not hardcode the exempt statuses', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert — a literal list is how `comp` gets dropped: somebody
        // "simplifies" the shared set to the one status they were thinking
        // about, and every comped partner starts receiving the takedown
        // question. The hardcoded form is what is forbidden, not a particular
        // spelling of the safe one.
        expect(body).not.toMatch(/'active'\s*,\s*'trialing'/);
        expect(body).not.toMatch(/\[\s*'active'\s*\]/);
        expect(body).not.toMatch(/status,\s*'active'/);
    });

    it('relies on a set that really does contain comp and courtesy', () => {
        // Assert — the clause above is only worth anything if the set it points
        // at carries the two exemptions. If a future edit removes them from
        // `@repo/billing`, this file must fail rather than keep vouching for a
        // guarantee that moved out from under it.
        expect(ENTITLEMENT_GRANTING_STATUSES).toContain('comp');
        expect(ENTITLEMENT_GRANTING_STATUSES).toContain('courtesy');
    });

    /**
     * The positive half: without it every negative above is satisfied by an
     * empty or deleted method.
     */
    it('still narrows to active partners past their confirmed period', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert
        expect(body).toMatch(/paymentConfirmedThrough/);
        expect(body).toMatch(/contentApprovedAt/);
        expect(body).toMatch(/isNull\(partners\.paymentReviewState\)/);
    });
});

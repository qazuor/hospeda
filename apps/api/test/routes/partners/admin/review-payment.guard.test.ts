/**
 * HOS-1299 — static guards over the payment-review surface.
 *
 * These are over the SOURCE, not over a request, and that is deliberate.
 * `applyRouteMiddlewares` mounts `options.middlewares` with
 * `app.use(honoPath, mw)`: path-scoped but AGNOSTIC TO THE METHOD, so a request
 * test asserting "this route 403s an actor without the permission" can be
 * satisfied by a SIBLING route sharing the path and never touch the route under
 * test. The contract here is about what the definition declares, so the
 * assertion is over the definition.
 *
 * Two properties, and the second is the whole feature:
 *
 * 1. The route is an admin route gated by `PARTNER_MANAGE`, like every other
 *    partner admin endpoint. It decides whether a listing stays up.
 * 2. Neither the route nor the service writes `revokedAt` or `endsAt` on this
 *    path. Both are one-line edits that look like tidying and both silently
 *    break the owner's decision: `revokedAt` earns a permanent 410 Gone for a
 *    partner who merely lapsed, and `endsAt` arms `partner-expiry`, which
 *    archives unattended — the automatic takedown, rebuilt through the back
 *    door.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');

const REVIEW_PAYMENT_ROUTE = path.resolve(
    __dirname,
    '../../../../src/routes/partners/admin/review-payment.ts'
);
const PAYMENT_REVIEW_JOB = path.resolve(
    __dirname,
    '../../../../src/cron/jobs/partner-payment-review.job.ts'
);
const PARTNER_SERVICE = path.join(
    REPO_ROOT,
    'packages/service-core/src/services/partner/partner.service.ts'
);

/**
 * Strips block and line comments before matching.
 *
 * Without it every negative assertion below is defeated by its own
 * documentation: both files explain at length why they do NOT write `revokedAt`,
 * so a naive `not.toMatch(/revokedAt/)` would be red on a correct file and green
 * on a broken one whose author deleted the comment.
 */
const readCode = (file: string): string =>
    readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

describe('HOS-1299 — the payment review route is an admin route behind PARTNER_MANAGE', () => {
    it('declares createAdminRoute and requiredPermissions: [PARTNER_MANAGE]', () => {
        const code = readCode(REVIEW_PAYMENT_ROUTE);
        expect(code).toMatch(/createAdminRoute/);
        expect(code).toMatch(/requiredPermissions:\s*\[\s*PermissionEnum\.PARTNER_MANAGE\s*\]/);
    });

    /**
     * The positive half. Without it the negatives below pass against a file
     * that was deleted or emptied.
     */
    it('is mounted on the partner id and answers the two decisions', () => {
        const code = readCode(REVIEW_PAYMENT_ROUTE);
        expect(code).toMatch(/path:\s*'\/\{id\}\/review-payment'/);
        expect(code).toMatch(/'confirmed-paid'/);
        expect(code).toMatch(/'not-paid'/);
    });
});

describe('HOS-1299 — nothing on this path arms an unattended takedown', () => {
    it('the cron writes no partner column other than paymentReviewState', () => {
        const code = readCode(PAYMENT_REVIEW_JOB);
        // The job's single `model.update` is the one write it is allowed. Any
        // of these appearing means it started deciding instead of asking.
        expect(code).not.toMatch(/subscriptionStatus/);
        expect(code).not.toMatch(/lifecycleState/);
        expect(code).not.toMatch(/endsAt/);
        expect(code).not.toMatch(/revokedAt/);
        expect(code).toMatch(/paymentReviewState/);
    });

    it('the cron hands the model the canonical exempt set, never a literal', () => {
        // Arrange — the model applies whatever set it is given, so THIS is
        // where "a comped partner is never accused" is actually decided. Its
        // sibling guard in `packages/db` cannot see it: the set is injected
        // precisely so `@repo/db` does not have to import `@repo/billing`,
        // whose single barrel drags the MercadoPago adapter into every module
        // graph that touches a model.
        const code = readCode(PAYMENT_REVIEW_JOB);

        // Act + Assert
        expect(code).toMatch(/exemptSubscriptionStatuses:\s*ENTITLEMENT_GRANTING_STATUSES/);
        expect(code).not.toMatch(/exemptSubscriptionStatuses:\s*\[/);
    });

    it('the review route itself writes nothing — it delegates to the service', () => {
        const code = readCode(REVIEW_PAYMENT_ROUTE);
        expect(code).toMatch(/partnerService\.reviewPayment/);
        expect(code).not.toMatch(/revokedAt/);
        expect(code).not.toMatch(/endsAt/);
    });

    it('reviewPayment never writes revokedAt or endsAt', () => {
        // Scoped to the method body: the same file holds `revoke()`, which
        // legitimately writes all three revocation columns, so a whole-file
        // match would be vacuous in the direction that matters.
        const code = readCode(PARTNER_SERVICE);
        const start = code.indexOf('public async reviewPayment');
        expect(start, 'reviewPayment not found — was it renamed?').toBeGreaterThan(-1);
        const end = code.indexOf('public async revoke', start);
        expect(end, 'revoke not found after reviewPayment — the slice is wrong').toBeGreaterThan(
            start
        );
        const body = code.slice(start, end);

        expect(body).not.toMatch(/revokedAt/);
        expect(body).not.toMatch(/revokedById/);
        expect(body).not.toMatch(/revokeReason/);
        expect(body).not.toMatch(/endsAt/);
        // And the positive: the slice really is the method, not an empty span.
        expect(body).toMatch(/paymentConfirmedThrough/);
    });
});

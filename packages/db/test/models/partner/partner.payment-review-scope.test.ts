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
 *
 * The exempt SET is injected by the caller rather than imported here — see the
 * method's docblock for why — so this file defends the model's half (it applies
 * whatever it is given, and degrades safely when given nothing) and its sibling
 * in `apps/api` defends the caller's half (it passes the canonical set, never a
 * literal). Neither is sufficient alone: this one would pass against a caller
 * that hands over `['active']`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    it('filters the link-row exclusion by the injected status set', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert
        expect(body).toMatch(/inArray\(\s*partnerSubscriptions\.status/);
        expect(body).toMatch(/input\.exemptSubscriptionStatuses/);
    });

    it('does not hardcode the exempt statuses', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert — a literal list is how `comp` gets dropped: somebody
        // "simplifies" the injected set down to the one status they were
        // thinking about, and every comped partner starts receiving the
        // takedown question.
        expect(body).not.toMatch(/'active'\s*,\s*'trialing'/);
        expect(body).not.toMatch(/\[\s*'active'\s*\]/);
        expect(body).not.toMatch(/status,\s*'active'/);
    });

    it('degrades to excluding every linked partner when handed an empty set', () => {
        // Arrange + Act
        const body = readMethodBody();

        // Assert — an empty array makes `inArray` degenerate to false, which
        // makes the NOT EXISTS always true and drops every subscription-governed
        // partner, comped ones included, into the alert. The guard against that
        // has to be in the source, because the failure is silent and only shows
        // up as an admin being asked about somebody we comped.
        expect(body).toMatch(/exemptSubscriptionStatuses\.length\s*>\s*0/);
        expect(body).toMatch(/hasExemptSet/);
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

    it('does not import @repo/billing — that barrel carries the MercadoPago adapter', () => {
        // Arrange — `packages/db` sits in nearly every module graph in the
        // monorepo, and `@repo/billing` exports exactly one barrel, which pulls
        // `adapters/mercadopago.ts` and through it `@repo/logger`'s
        // `createLogger`. Importing it here turned two unit shards red on suites
        // that have nothing to do with partners, because their `@repo/logger`
        // mock does not define that export.
        const source = readFileSync(PARTNER_MODEL, 'utf-8');

        // Act + Assert
        expect(source).not.toMatch(/from\s+'@repo\/billing'/);
    });
});

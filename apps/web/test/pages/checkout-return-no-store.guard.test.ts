/**
 * @file checkout-return-no-store.guard.test.ts
 * @description Static guard: every MercadoPago return page must opt OUT of
 * shared caching (H-15).
 *
 * The three return pages receive MercadoPago's redirect with `payment_id`,
 * `status` and `collection_id` in the query string and render the outcome of
 * ONE specific buyer's payment. None of them may ever be served from a shared
 * cache: a hit would hand one buyer's payment state to the next visitor.
 *
 * Before H-15 only `failure.astro` declared it, so the other two were protected
 * by omission (no Cache Rule happened to capture them) rather than by
 * declaration. This guard turns that implicit protection into an asserted one:
 * adding a fourth return page, or dropping the call from an existing one, fails
 * CI.
 *
 * Why a static guard rather than three runtime tests: the defect is "N call
 * sites forgot the gate", so the assertion has to be over the SET of pages, not
 * over one page's behaviour. A runtime test per page cannot fail for a page
 * nobody remembered to write a test for.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CHECKOUT_PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout');

/**
 * Pages that render a payment-provider return and therefore MUST be no-store.
 */
const RETURN_PAGES = ['failure.astro', 'pending.astro', 'success.astro'] as const;

/**
 * Pages in the same directory that are deliberately NOT provider returns.
 * `index.astro` is the outbound checkout page: it shows the plan the visitor
 * chose, not the result of a payment.
 */
const NON_RETURN_PAGES = ['index.astro'] as const;

/**
 * Matches a real CALL to the shared helper at statement position — start of a
 * line, optional leading whitespace, immediately followed by the opening
 * argument brace. Anchored deliberately: an unanchored `includes()` would also
 * match the helper's name inside a comment or its own import line, so deleting
 * the call while leaving the import behind would still pass.
 */
const HELPER_CALL = /^[ \t]*setCheckoutReturnNoStore\(\{/m;

/**
 * Matches a hand-rolled `Cache-Control` header set at statement position.
 */
const HAND_ROLLED_HEADER = /^[ \t]*Astro\.response\.headers\.set\(\s*['"]Cache-Control['"]/m;

describe('checkout return pages — no-store guard (H-15)', () => {
    it('accounts for every .astro page in the checkout directory', () => {
        // Verifies the instrument before trusting its verdict. If a new page is
        // added to the directory and classified nowhere, the per-page checks
        // below would still pass while leaving that page unprotected — so an
        // unclassified page fails here instead.
        const onDisk = readdirSync(CHECKOUT_PAGES_DIR)
            .filter((file) => file.endsWith('.astro'))
            .sort();

        expect(onDisk).toEqual([...RETURN_PAGES, ...NON_RETURN_PAGES].sort());
    });

    it.each(RETURN_PAGES)('%s calls setCheckoutReturnNoStore', (page) => {
        const src = readFileSync(resolve(CHECKOUT_PAGES_DIR, page), 'utf8');

        expect(src).toMatch(HELPER_CALL);
    });

    it.each(RETURN_PAGES)('%s does not hand-roll the header instead', (page) => {
        const src = readFileSync(resolve(CHECKOUT_PAGES_DIR, page), 'utf8');

        // One helper, one place to audit. A hand-rolled `headers.set` would
        // satisfy a human reader but drift from the shared value over time.
        expect(src).not.toMatch(HAND_ROLLED_HEADER);
    });
});

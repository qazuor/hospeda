/**
 * @file checkout-cache.ts
 * @description Shared cache policy for the MercadoPago return pages (H-15).
 *
 * The three checkout return pages (`success`, `pending`, `failure`) receive
 * MercadoPago's redirect carrying `payment_id`, `status` and `collection_id`,
 * and render the outcome of ONE specific buyer's payment. A shared-cache hit on
 * any of them would serve one buyer's payment state to the next visitor.
 *
 * Before H-15 only `failure.astro` declared this, for a narrower reason (its
 * retry CTA is role-variant). The other two were protected by omission — no
 * Cache Rule happened to capture them — which is a property of today's edge
 * configuration, not of the pages. A broader rule added later would have swept
 * them in. This helper makes the policy explicit and gives it one call site to
 * audit; `test/pages/checkout-return-no-store.guard.test.ts` fails CI if a
 * return page stops calling it.
 *
 * It is deliberately NOT applied in `MarketingLayout`: that layout is shared
 * with the pricing pages, which opt INTO edge caching. The opt-out belongs to
 * the return pages, not to every page that happens to use the same shell.
 */

/**
 * Parameters for {@link setCheckoutReturnNoStore}.
 */
export interface SetCheckoutReturnNoStoreParams {
    /**
     * The response whose headers should be marked uncacheable.
     *
     * Typed as "something with headers" rather than as `Response`: in a page's
     * frontmatter `Astro.response` is a `ResponseInit & { readonly headers:
     * Headers }`, not a constructed `Response`. Asking for the full interface
     * fails `astro check` at every call site.
     */
    readonly response: { readonly headers: Headers };
}

/**
 * Mark a payment-provider return page as uncacheable by any shared cache.
 *
 * Call this in the frontmatter of every checkout return page, before rendering.
 *
 * @param params - The response to mark.
 *
 * @example
 * ```astro
 * ---
 * import { setCheckoutReturnNoStore } from '@/lib/billing/checkout-cache';
 *
 * setCheckoutReturnNoStore({ response: Astro.response });
 * ---
 * ```
 */
export function setCheckoutReturnNoStore({ response }: SetCheckoutReturnNoStoreParams): void {
    // Written as a LITERAL on purpose, not hoisted into an exported constant.
    // `test/static-guards/cacheable-responses-declare-tags.test.ts` reads source
    // text: it classifies a `Cache-Control` set from an identifier as opaque
    // and therefore policed as cacheable ("I cannot tell" resolves to "watch
    // it"), which is the right default and exactly what a constant here would
    // have defeated. Keeping the value inline lets the guard read it as
    // `private` and pass on its own terms, rather than needing an exemption
    // that would weaken it for everyone.
    //
    // `private` bars shared caches (Cloudflare, any intermediary proxy);
    // `no-store` additionally bars the browser's own disk cache, so a back
    // navigation after logout cannot resurrect the rendered payment result.
    response.headers.set('Cache-Control', 'private, no-store');
}

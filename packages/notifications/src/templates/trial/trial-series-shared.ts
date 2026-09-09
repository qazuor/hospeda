/**
 * Shared props and styles for the nine emails of the Hospeda-owned trial series
 * (HOS-1012 §4).
 *
 * What is shared here is the FRAME — the prop shape every send receives and the
 * visual tokens they render with. The copy is deliberately NOT shared: each of
 * the nine templates writes its own heading and body, because the tone shifting
 * across the series is the requirement the redesign exists for. One template
 * parameterised by a day count satisfies every structural check and fails that
 * requirement in silence, which is precisely what the previous
 * `TrialEndingReminder` did.
 *
 * These templates are Spanish-only, matching the other 57 templates in this
 * package — none of them uses `@repo/i18n` (owner decision, 2026-09-01).
 *
 * @module templates/trial/trial-series-shared
 */

/**
 * Props every send in the trial series receives.
 *
 * The shape is identical across the nine so the dispatch switch in
 * `notification.service.ts` stays a flat mapping with no per-send argument
 * assembly. `trialEndDate` is the same instant in all of them — the moment the
 * trial ends — and each template frames it for its own position in the series
 * (still ahead, today, already past).
 */
export interface TrialSeriesEmailProps {
    /** Host's display name. */
    readonly recipientName: string;
    /** Display name of the plan the trial was running on. */
    readonly planName: string;
    /** ISO date at which the trial ends (or ended). */
    readonly trialEndDate: string;
    /** Vertical-specific pricing page, carrying the interval the customer originally chose. */
    readonly upgradeUrl: string;
    /**
     * The trial's billing vertical (HOS-1283) — the raw
     * `billing_subscriptions.product_domain` string, e.g. `'accommodation'` /
     * `'gastronomy'` / `'experience'`, or `null`/`undefined` on a pre-domain
     * row. Every template that names a listing, its photos, or what shows up
     * in a search resolves this via `resolveTrialSeriesCopy`
     * (`../../utils/product-domain-copy.js`) instead of hardcoding
     * accommodation wording. Omitted or unrecognized fails open to
     * accommodation copy — see that function's doc.
     */
    readonly productDomain?: string | null;
}

/**
 * Visual tokens for the series.
 *
 * Three accent boxes, matching the arc: `calmBox` for the sends that are not
 * warning about anything, `warningBox` for the ones that name the risk, and
 * `alertBox` for the day the listing actually comes down.
 */
export const trialSeriesStyles = {
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    calmBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #3aa7d9',
        padding: '24px',
        margin: '24px 0'
    },
    warningBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
        padding: '24px',
        margin: '24px 0'
    },
    alertBox: {
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        borderLeft: '4px solid #dc2626',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};

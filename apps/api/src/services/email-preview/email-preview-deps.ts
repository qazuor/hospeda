/**
 * Runtime collaborators of the admin email preview (HOS-2519 §6.3, D7).
 *
 * The preview renders every catalog entry through the production renderers,
 * but it must never read or write the database: the outbox registry is built
 * with fake readers and a fake, non-writing claim-secret issuer (AC-4.6).
 *
 * @module services/email-preview/email-preview-deps
 */

import type {
    EmailCatalogRenderDeps,
    ListingNamesReader,
    PartnerClaimSecretIssuer,
    ReconciliationSubjectsReader
} from '@repo/notifications';
import { createOutboxMailRenderer } from '@repo/notifications';
import { buildOutboxRendererRegistry } from '../email-outbox/outbox-renderer-registry.js';

/** Claim secret the preview's fake issuer returns. Obviously fake, never persisted. */
export const PREVIEW_PARTNER_CLAIM_SECRET = 'preview-claim-secret';

/** Fake listing-name reader: a fixed fictional name per requested id, no I/O. */
export const previewReadListingNames: ListingNamesReader = async ({ ids }) =>
    new Map(ids.map((id, index) => [id, `Ficha de ejemplo ${index + 1}`]));

/** Fake reconciliation-subjects reader: fixed fictional details, no I/O. */
export const previewReadReconciliationSubjects: ReconciliationSubjectsReader = async ({
    subscriptionIds,
    addonInstanceIds
}) => ({
    subscriptions: new Map(
        subscriptionIds.map((id) => [
            id,
            {
                holderName: 'Ana Ejemplo',
                holderEmail: 'ana.ejemplo@example.com',
                vertical: 'accommodation',
                planName: 'Plan Profesional',
                cycle: 'monthly',
                amountMinor: 1_500_000,
                currency: 'ARS',
                status: 'ACTIVE',
                listingNames: ['Cabañas del Río (ejemplo)']
            }
        ])
    ),
    addonInstances: new Map(
        addonInstanceIds.map((id) => [
            id,
            {
                holderName: 'Ana Ejemplo',
                holderEmail: 'ana.ejemplo@example.com',
                addonName: 'Destacado (ejemplo)',
                status: 'ACTIVE'
            }
        ])
    ),
    openMarks: new Map()
});

/** Fake claim-secret issuer: returns a fixed secret and writes nothing. */
export const previewIssuePartnerClaimSecret: PartnerClaimSecretIssuer = async () => ({
    secret: PREVIEW_PARTNER_CLAIM_SECRET
});

/** Input of {@link buildEmailPreviewDeps}. */
export interface BuildEmailPreviewDepsInput {
    /** Site base URL used in CTA links. */
    readonly siteUrl: string;
    /** Admin panel base URL for the reconciliation summary's links. */
    readonly adminUrl?: string;
    /** Non-production marker (e.g. `STAGING`) for the reconciliation summary header. */
    readonly environmentLabel?: string;
}

/**
 * Builds the catalog render dependencies for the preview: the site URL and an
 * outbox renderer composed from the production registry with the fakes above.
 *
 * @param input - Site URL plus the optional admin URL and environment label.
 * @returns The render dependencies.
 *
 * @example
 * ```ts
 * const deps = buildEmailPreviewDeps({ siteUrl: env.HOSPEDA_SITE_URL, adminUrl: env.HOSPEDA_ADMIN_URL });
 * ```
 */
export function buildEmailPreviewDeps(input: BuildEmailPreviewDepsInput): EmailCatalogRenderDeps {
    const registry = buildOutboxRendererRegistry({
        siteUrl: input.siteUrl,
        readListingNames: previewReadListingNames,
        readReconciliationSubjects: previewReadReconciliationSubjects,
        issuePartnerClaimSecret: previewIssuePartnerClaimSecret,
        ...(input.adminUrl ? { adminUrl: input.adminUrl } : {}),
        ...(input.environmentLabel ? { environmentLabel: input.environmentLabel } : {})
    });
    return {
        siteUrl: input.siteUrl,
        outboxRenderer: createOutboxMailRenderer({ renderers: registry })
    };
}

/**
 * Composition of the email outbox renderer registry (HOS-2519 D7).
 *
 * Holds the one place that decides which renderer serves each outbox template
 * key. The production sender (`cron/jobs/email-outbox-sender.job.ts`) wraps it
 * with `createOutboxMailRenderer`; the admin email preview builds it with fake,
 * non-writing readers so a preview never touches the database. It lives under
 * `services/` so the preview does not import a cron module.
 *
 * @module services/email-outbox/outbox-renderer-registry
 */

import type {
    ListingNamesReader,
    OutboxMailRenderer,
    PartnerClaimSecretIssuer,
    ReconciliationSubjectsReader
} from '@repo/notifications';
import {
    createBillingCourtesyRenderers,
    createBillingGraceReminderRenderers,
    createBillingLatePaymentRefundRenderers,
    createBillingManualInstallmentOpenedRenderers,
    createBillingManualPaymentRenderers,
    createBillingOneTimeAddonActivatedRenderers,
    createBillingPlanMigrationRenderers,
    createBillingPromoRenderers,
    createBillingProviderWatchRenderers,
    createBillingReconciliationRenderers,
    createBillingRenewalRenderers,
    createBillingSignupRenderers,
    createListingArchivedRenderers,
    createListingRetentionRenderers,
    createPartnerApplicationRenderers,
    createTrialCampaignRenderers,
    createVerticalListingRenderers,
    OUTBOX_MAIL_RENDERERS
} from '@repo/notifications';
import { resolveLatePaymentRefundMailCopy } from '../../utils/billing-late-payment-refund-mail-copy.js';
import { resolveManualInstallmentMailCopy } from '../../utils/billing-manual-installment-mail-copy.js';
import { resolveOneTimeAddonActivatedMailCopy } from '../../utils/billing-one-time-addon-activated-mail-copy.js';
import { readListingNames } from '../../utils/listing-publication/listing-names-reader.js';
import { apiLogger } from '../../utils/logger.js';
import { issuePartnerClaimSecret } from '../../utils/partner-application/partner-claim-secret.js';
import { resolvePartnerMailCopy } from '../../utils/partner-application/partner-mail-copy.js';
import { resolveReconciliationReasonLabel } from '../../utils/reconciliation-summary/reconciliation-reason-label.js';
import { readReconciliationSubjects } from '../../utils/reconciliation-summary/reconciliation-subjects-reader.js';

/** Input of {@link buildOutboxRendererRegistry}. */
export interface BuildOutboxRendererRegistryInput {
    /** Site base URL used in the mails' links. */
    readonly siteUrl: string;
    /** Resolves listing names; defaults to the database reader. */
    readonly readListingNames?: ListingNamesReader;
    /** Resolves the reconciliation summary's subjects; defaults to the database reader. */
    readonly readReconciliationSubjects?: ReconciliationSubjectsReader;
    /** Admin panel base URL for the summary's links. Absent: no links. */
    readonly adminUrl?: string;
    /** Non-production marker (e.g. `STAGING`) for the summary header. Absent in production. */
    readonly environmentLabel?: string;
    /** Issues and persists a claim secret; tests and the preview inject a fake to avoid database writes. */
    readonly issuePartnerClaimSecret?: PartnerClaimSecretIssuer;
}

/**
 * Builds the outbox renderer registry: shared, trial, renewal, grace, promo,
 * plan migration, courtesy, provider watch, reconciliation, manual payment and
 * installment, late refund, one-time add-on, signup, vertical listing,
 * on-archive, pre-archive/pre-deletion retention, and partner application
 * notices, keyed by outbox template identifier.
 *
 * Every database-backed collaborator is an optional input that defaults to the
 * production reader or writer; pass fakes to render without I/O.
 *
 * @param input - Registry configuration.
 * @returns Renderers by outbox template identifier.
 *
 * @example
 * ```ts
 * const registry = buildOutboxRendererRegistry({ siteUrl: env.HOSPEDA_SITE_URL });
 * const keys = Object.keys(registry);
 * ```
 */
export function buildOutboxRendererRegistry(
    input: BuildOutboxRendererRegistryInput
): Record<string, OutboxMailRenderer> {
    return {
        ...OUTBOX_MAIL_RENDERERS,
        ...createTrialCampaignRenderers({ siteUrl: input.siteUrl }),
        ...createBillingRenewalRenderers({ siteUrl: input.siteUrl }),
        ...createBillingGraceReminderRenderers({ siteUrl: input.siteUrl }),
        ...createBillingPromoRenderers({ siteUrl: input.siteUrl }),
        ...createBillingPlanMigrationRenderers({ siteUrl: input.siteUrl }),
        ...createBillingCourtesyRenderers(),
        ...createBillingProviderWatchRenderers({
            ...(input.adminUrl ? { adminUrl: input.adminUrl } : {})
        }),
        ...createBillingReconciliationRenderers({
            siteUrl: input.siteUrl,
            readSubjects: input.readReconciliationSubjects ?? readReconciliationSubjects,
            resolveReasonLabel: resolveReconciliationReasonLabel,
            ...(input.adminUrl ? { adminUrl: input.adminUrl } : {}),
            ...(input.environmentLabel ? { environmentLabel: input.environmentLabel } : {}),
            onEnrichmentError: ({ error }) =>
                apiLogger.warn(
                    { error: error instanceof Error ? error.message : String(error) },
                    'Reconciliation notice: subjects could not be resolved; sending without them'
                )
        }),
        ...createBillingManualPaymentRenderers({
            readSubjects: input.readReconciliationSubjects ?? readReconciliationSubjects,
            ...(input.adminUrl ? { adminUrl: input.adminUrl } : {}),
            onEnrichmentError: ({ error }) =>
                apiLogger.warn(
                    { error: error instanceof Error ? error.message : String(error) },
                    'Manual installment notice: subject could not be resolved; sending without it'
                )
        }),
        ...createBillingManualInstallmentOpenedRenderers({
            siteUrl: input.siteUrl,
            resolveCopy: resolveManualInstallmentMailCopy
        }),
        ...createBillingLatePaymentRefundRenderers({
            resolveCopy: resolveLatePaymentRefundMailCopy
        }),
        ...createBillingOneTimeAddonActivatedRenderers({
            siteUrl: input.siteUrl,
            readListingNames: input.readListingNames ?? readListingNames,
            resolveCopy: resolveOneTimeAddonActivatedMailCopy
        }),
        ...createBillingSignupRenderers({ siteUrl: input.siteUrl }),
        ...createVerticalListingRenderers({
            siteUrl: input.siteUrl,
            readListingNames: input.readListingNames ?? readListingNames
        }),
        ...createListingArchivedRenderers({ siteUrl: input.siteUrl }),
        ...createListingRetentionRenderers({ siteUrl: input.siteUrl }),
        ...createPartnerApplicationRenderers({
            siteUrl: input.siteUrl,
            issueClaimSecret: input.issuePartnerClaimSecret ?? issuePartnerClaimSecret,
            resolveCopy: resolvePartnerMailCopy
        })
    };
}

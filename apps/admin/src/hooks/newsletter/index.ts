/**
 * Newsletter admin hooks barrel (SPEC-101 T-101-30).
 *
 * Aggregates every TanStack Query hook the admin newsletter pages
 * consume so callers can do a single import:
 *
 *   import { useNewsletterCampaigns, useSendCampaign } from '@/hooks/newsletter';
 */

export {
    type CampaignFailedDelivery,
    type CampaignMetrics,
    campaignMetricsQueryKeys,
    useCampaignErrors,
    useCampaignMetrics
} from './use-campaign-metrics';

export {
    type NewsletterCampaignListFilters,
    newsletterCampaignQueryKeys,
    useCancelCampaign,
    useCreateCampaign,
    useDeleteCampaign,
    useNewsletterCampaign,
    useNewsletterCampaigns,
    useSendCampaign,
    useTestSendCampaign,
    useUpdateCampaign
} from './use-newsletter-campaigns';
export {
    type NewsletterSubscriberListFilters,
    newsletterSubscriberQueryKeys,
    useNewsletterSubscriberStats,
    useNewsletterSubscribers
} from './use-newsletter-subscribers';

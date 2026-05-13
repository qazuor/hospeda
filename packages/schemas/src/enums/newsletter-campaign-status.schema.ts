import { z } from 'zod';
import { NewsletterCampaignStatusEnum } from './newsletter-campaign-status.enum.js';

export const NewsletterCampaignStatusEnumSchema = z.nativeEnum(NewsletterCampaignStatusEnum, {
    error: () => ({ message: 'zodError.enums.newsletterCampaignStatus.invalid' })
});

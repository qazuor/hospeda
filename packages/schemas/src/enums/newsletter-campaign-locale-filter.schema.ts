import { z } from 'zod';
import { NewsletterCampaignLocaleFilterEnum } from './newsletter-campaign-locale-filter.enum.js';

export const NewsletterCampaignLocaleFilterEnumSchema = z.nativeEnum(
    NewsletterCampaignLocaleFilterEnum,
    {
        error: () => ({ message: 'zodError.enums.newsletterCampaignLocaleFilter.invalid' })
    }
);

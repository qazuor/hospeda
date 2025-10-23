import { z } from 'zod';
import { CampaignStatusEnum } from './campaign-status.enum';

export const CampaignStatusSchema = z.nativeEnum(CampaignStatusEnum, {
    message: 'zodError.enums.campaignStatus.invalid'
});

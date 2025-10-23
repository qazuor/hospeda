import { z } from 'zod';
import { CampaignChannelEnum } from './campaign-channel.enum';

export const CampaignChannelSchema = z.nativeEnum(CampaignChannelEnum, {
    message: 'zodError.enums.campaignChannel.invalid'
});

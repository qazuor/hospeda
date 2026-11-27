import { BuildingsIcon, ChatIcon, MapIcon, PriceIcon, StarIcon } from '@repo/icons';

/** Tourist benefit cards shared by the public benefits page and the tourist landing. */
export const TOURIST_BENEFIT_CARDS = [
    {
        Icon: BuildingsIcon,
        titleKey: 'benefits.tourist.1.title',
        descKey: 'benefits.tourist.1.desc'
    },
    { Icon: PriceIcon, titleKey: 'benefits.tourist.2.title', descKey: 'benefits.tourist.2.desc' },
    { Icon: StarIcon, titleKey: 'benefits.tourist.3.title', descKey: 'benefits.tourist.3.desc' },
    { Icon: MapIcon, titleKey: 'benefits.tourist.4.title', descKey: 'benefits.tourist.4.desc' },
    { Icon: ChatIcon, titleKey: 'benefits.tourist.5.title', descKey: 'benefits.tourist.5.desc' }
] as const;

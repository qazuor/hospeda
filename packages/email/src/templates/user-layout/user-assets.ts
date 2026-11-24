/**
 * Hosted images of the USER email layout (HOS-2565 PR-4, spec §9.3).
 *
 * Every file lives in `apps/web/public/email/user/` and is resolved per environment
 * through `resolveEmailAssetUrl`, like the isotipo (HOS-2540). They are PNGs with
 * semi-transparent fills, so they read on the light card and do not glow on a dark
 * one. A test checks that each path exists on disk.
 *
 * @module templates/user-layout/user-assets
 */

import type { EmailAssetPath } from '../../email-assets.js';

/** Paths of the fixed user-layout images (header, footer, icons). */
export const EMAIL_USER_ASSET_PATHS = {
    /** Blue-to-teal wave band on top of the card (1200x112, rendered 600x56). */
    headerWave: '/email/user/header-wave@2x.png',
    /** "Descubrí el Litoral" in Caveat, teal (440x88, rendered 220x44). */
    tagline: '/email/user/tagline@2x.png',
    /** Wave on top of the footer band (1200x64, rendered 600x32). */
    footerWave: '/email/user/footer-wave@2x.png',
    calloutInfo: '/email/user/callout-info@2x.png',
    calloutSuccess: '/email/user/callout-success@2x.png',
    calloutWarning: '/email/user/callout-warning@2x.png',
    calloutDanger: '/email/user/callout-danger@2x.png',
    channelSecurity: '/email/user/channel-security@2x.png',
    channelWeb: '/email/user/channel-web@2x.png',
    channelContact: '/email/user/channel-contact@2x.png',
    trustSupport: '/email/user/trust-support@2x.png',
    trustPayments: '/email/user/trust-payments@2x.png',
    trustFees: '/email/user/trust-fees@2x.png',
    socialInstagram: '/email/user/social-instagram@2x.png',
    socialFacebook: '/email/user/social-facebook@2x.png',
    socialX: '/email/user/social-x@2x.png'
} as const satisfies Readonly<Record<string, EmailAssetPath>>;

/** The six illustrations a user mail can declare, one per mail family. */
export const EMAIL_ILLUSTRATIONS = [
    'payments',
    'listings',
    'account',
    'plan',
    'messages',
    'alerts'
] as const;

/** One illustration a user mail can declare (HOS-2565 PR-4). */
export type EmailIllustration = (typeof EMAIL_ILLUSTRATIONS)[number];

/** Path of each illustration (256x256, rendered 112x112, 84x84 on mobile). */
export const EMAIL_ILLUSTRATION_PATHS: Readonly<Record<EmailIllustration, EmailAssetPath>> = {
    payments: '/email/user/ill-payments@2x.png',
    listings: '/email/user/ill-listings@2x.png',
    account: '/email/user/ill-account@2x.png',
    plan: '/email/user/ill-plan@2x.png',
    messages: '/email/user/ill-messages@2x.png',
    alerts: '/email/user/ill-alerts@2x.png'
};

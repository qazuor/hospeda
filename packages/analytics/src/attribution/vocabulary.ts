/**
 * Closed UTM vocabulary for campaign attribution (HOS-2359, owner decision OD-4).
 *
 * Every `utm_*` value Hospeda emits comes from these lists, and {@link UtmParamsSchema}
 * pins which `source`/`campaign` combinations are valid for each `medium`. Adding a
 * value is a one-line change here; inventing one at a call site is a compile error and
 * a runtime {@link InvalidUtmParamsError}.
 */
import { z } from 'zod';

/** Every allowed `utm_source`. */
export const UTM_SOURCES = [
    'email',
    'whatsapp',
    'facebook',
    'x',
    'telegram',
    'share',
    'copy',
    'qr',
    'instagram',
    'google-business'
] as const;

/** An allowed `utm_source`. */
export type UtmSource = (typeof UTM_SOURCES)[number];

/** Every allowed `utm_medium`. */
export const UTM_MEDIUMS = [
    'transactional',
    'campaign',
    'share',
    'print',
    'direct-outreach',
    'profile'
] as const;

/** An allowed `utm_medium`. */
export type UtmMedium = (typeof UTM_MEDIUMS)[number];

/**
 * Entity types that render share buttons (`utm_campaign` for `medium=share`).
 * `venue` and `experience` share from their detail-page gallery (HOS-2520), with
 * the same names the QR vocabulary already uses for those entities.
 */
export const SHARE_CAMPAIGNS = ['accommodation', 'event', 'post', 'venue', 'experience'] as const;

/** A share-button campaign. */
export type ShareCampaign = (typeof SHARE_CAMPAIGNS)[number];

/** Printed QR code campaigns (`utm_campaign` for `medium=print`). */
export const QR_CAMPAIGNS = [
    'accommodation',
    'venue',
    'experience',
    'host-trade',
    'certificate',
    'manual'
] as const;

/** A printed QR code campaign. */
export type QrCampaign = (typeof QR_CAMPAIGNS)[number];

/** Presentation audiences (`utm_campaign = presentacion-<audience>`). */
export const PRESENTATION_AUDIENCES = [
    'alojamientos',
    'comer-y-salir',
    'experiencias',
    'proveedores',
    'aliados',
    'editores'
] as const;

/** A presentation audience. */
export type PresentationAudience = (typeof PRESENTATION_AUDIENCES)[number];

/** Sources a share button may use. */
export const SHARE_SOURCES = ['whatsapp', 'facebook', 'x', 'telegram', 'share', 'copy'] as const;

/** Sources a presentation short link may use. */
export const DIRECT_OUTREACH_SOURCES = ['whatsapp', 'facebook', 'x', 'telegram', 'copy'] as const;

/** Sources a profile/bio link may use. */
export const PROFILE_SOURCES = ['instagram', 'google-business'] as const;

/** Kebab-case token charset used for free-form campaign and content values. */
export const UTM_TOKEN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Maximum length of an email `utm_campaign` (template key or campaign slug). */
export const UTM_EMAIL_CAMPAIGN_MAX_LENGTH = 100;

/** Maximum length of a `utm_content` link slot. */
export const UTM_CONTENT_MAX_LENGTH = 40;

const kebabToken = (max: number) => z.string().min(1).max(max).regex(UTM_TOKEN_REGEX);

const emailShape = {
    source: z.literal('email'),
    campaign: kebabToken(UTM_EMAIL_CAMPAIGN_MAX_LENGTH),
    content: kebabToken(UTM_CONTENT_MAX_LENGTH)
};

const PRESENTATION_CAMPAIGNS = PRESENTATION_AUDIENCES.map(
    (audience) => `presentacion-${audience}` as const
);

/**
 * Zod schema of a valid UTM combination: a discriminated union on `medium` that pins
 * the allowed `source`, `campaign` and `content` per medium (OD-4).
 */
export const UtmParamsSchema = z.discriminatedUnion('medium', [
    z.object({ medium: z.literal('transactional'), ...emailShape }).strict(),
    z.object({ medium: z.literal('campaign'), ...emailShape }).strict(),
    z
        .object({
            medium: z.literal('share'),
            source: z.enum(SHARE_SOURCES),
            campaign: z.enum(SHARE_CAMPAIGNS)
        })
        .strict(),
    z
        .object({
            medium: z.literal('print'),
            source: z.literal('qr'),
            campaign: z.enum(QR_CAMPAIGNS),
            content: kebabToken(UTM_CONTENT_MAX_LENGTH).optional()
        })
        .strict(),
    z
        .object({
            medium: z.literal('direct-outreach'),
            source: z.enum(DIRECT_OUTREACH_SOURCES),
            campaign: z.enum(PRESENTATION_CAMPAIGNS as [string, ...string[]])
        })
        .strict(),
    z
        .object({
            medium: z.literal('profile'),
            source: z.enum(PROFILE_SOURCES),
            campaign: z.literal('bio')
        })
        .strict()
]);

/** Email UTM parameters (transactional template or newsletter campaign). */
export type EmailUtmParams = {
    readonly source: 'email';
    readonly medium: 'transactional' | 'campaign';
    readonly campaign: string;
    readonly content: string;
};

/** Share-button UTM parameters. */
export type ShareUtmParams = {
    readonly source: (typeof SHARE_SOURCES)[number];
    readonly medium: 'share';
    readonly campaign: ShareCampaign;
};

/** Printed QR code UTM parameters. */
export type PrintUtmParams = {
    readonly source: 'qr';
    readonly medium: 'print';
    readonly campaign: QrCampaign;
    readonly content?: string;
};

/** Presentation short-link UTM parameters. */
export type DirectOutreachUtmParams = {
    readonly source: (typeof DIRECT_OUTREACH_SOURCES)[number];
    readonly medium: 'direct-outreach';
    readonly campaign: `presentacion-${PresentationAudience}`;
};

/** Profile/bio link UTM parameters. */
export type ProfileUtmParams = {
    readonly source: (typeof PROFILE_SOURCES)[number];
    readonly medium: 'profile';
    readonly campaign: 'bio';
};

/** Any valid UTM combination (compile-time mirror of {@link UtmParamsSchema}). */
export type UtmParams =
    | EmailUtmParams
    | ShareUtmParams
    | PrintUtmParams
    | DirectOutreachUtmParams
    | ProfileUtmParams;

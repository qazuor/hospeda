/**
 * @module entities/newsletter/newsletter-subscriber.schema
 *
 * Base Zod schema for the `newsletter_subscribers` entity (SPEC-101).
 */

import { z } from 'zod';
import { NewsletterChannelEnum } from '../../enums/newsletter-channel.enum.js';
import { NewsletterContentTypeEnum } from '../../enums/newsletter-content-type.enum.js';
import { NewsletterSourceEnum } from '../../enums/newsletter-source.enum.js';
import { NewsletterSubscriberStatusEnum } from '../../enums/newsletter-subscriber-status.enum.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * Per-content-type opt-in flags persisted on
 * `newsletter_subscribers.preferences`. Every {@link NewsletterContentTypeEnum}
 * value is a required boolean — `true` means the subscriber wants campaigns of
 * that content type, `false` means skip. The DB default backfills all keys to
 * `true`, so a parsed row is always complete.
 *
 * The schema is intentionally a closed `z.object(...)` (not a `z.record`) so
 * unknown content types are rejected and the inferred type is `Record<enum,
 * boolean>` with full literal keys.
 */
export const NewsletterContentPreferencesSchema = z.object({
    [NewsletterContentTypeEnum.OFFERS]: z.boolean(),
    [NewsletterContentTypeEnum.EVENTS]: z.boolean(),
    [NewsletterContentTypeEnum.GUIDES]: z.boolean(),
    [NewsletterContentTypeEnum.PRODUCT_NEWS]: z.boolean()
});

/** TypeScript type inferred from {@link NewsletterContentPreferencesSchema}. */
export type NewsletterContentPreferences = z.infer<typeof NewsletterContentPreferencesSchema>;

/**
 * Core newsletter subscriber schema — mirrors the `newsletter_subscribers` DB table.
 *
 * One row per (user, channel) pair. MVP only uses `channel='email'`.
 * `locale` uses {@link LanguageEnumSchema} (`es | en | pt`) — the same set of
 * supported locales as the rest of the platform.
 *
 * @example
 * ```ts
 * const subscriber = NewsletterSubscriberSchema.parse(row);
 * ```
 */
export const NewsletterSubscriberSchema = z.object({
    id: z.string().uuid(),

    /** FK → users.id. */
    userId: z.string().uuid(),

    /** Recipient email captured at subscribe time (denormalised for dispatch). */
    email: z
        .string()
        .email({ message: 'zodError.entity.newsletterSubscriber.email.email' })
        .max(255, { message: 'zodError.entity.newsletterSubscriber.email.max' }),

    /** Delivery channel. MVP: always 'email'. */
    channel: z.nativeEnum(NewsletterChannelEnum),

    /** Lifecycle state. */
    status: z.nativeEnum(NewsletterSubscriberStatusEnum),

    /** Locale at subscribe time — used for audience segmentation. */
    locale: LanguageEnumSchema,

    /** Acquisition source — used for analytics. */
    source: z.nativeEnum(NewsletterSourceEnum),

    /** Per-content-type opt-in flags. All keys present, all-true by default. */
    preferences: NewsletterContentPreferencesSchema,

    // ---- Consent audit (Ley 25.326 AR / GDPR) ----

    /** IP address captured at subscribe time. NULL for `source='migration'` rows. */
    consentIp: z
        .string()
        .max(45, { message: 'zodError.entity.newsletterSubscriber.consentIp.max' })
        .nullable(),

    /** Full User-Agent header captured at subscribe time. NULL for `source='migration'` rows. */
    consentUa: z.string().nullable(),

    /** Version label of the consent text shown at subscribe time. */
    consentVersion: z
        .string()
        .max(20, { message: 'zodError.entity.newsletterSubscriber.consentVersion.max' })
        .nullable(),

    // ---- Lifecycle timestamps ----

    /** When the row was inserted (before verification). */
    subscribedAt: z.union([z.string().datetime(), z.date()]),

    /** When status transitioned to ACTIVE via HMAC token verification. */
    verifiedAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** When status transitioned to UNSUBSCRIBED. */
    unsubscribedAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** When status transitioned to BOUNCED (Brevo hard-bounce webhook). */
    bouncedAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** When status transitioned to COMPLAINED (Brevo spam-complaint webhook). */
    complainedAt: z.union([z.string().datetime(), z.date()]).nullable(),

    // ---- Audit columns ----

    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()]),

    /** Soft delete only — consent audit trail must survive. */
    deletedAt: z.union([z.string().datetime(), z.date()]).nullable()
});

/** TypeScript type inferred from {@link NewsletterSubscriberSchema}. */
export type NewsletterSubscriber = z.infer<typeof NewsletterSubscriberSchema>;

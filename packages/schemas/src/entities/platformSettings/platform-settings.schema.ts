import { z } from 'zod';

/**
 * Platform settings — Zod schemas (SPEC-156).
 *
 * Source of truth for the shape of every supported `platform_settings.key`
 * value, plus the discriminated union response the API returns.
 *
 * Storage: the DB column is a JSONB blob keyed by an opaque string. Validation
 * happens at the application boundary (route handlers + service writes) via the
 * discriminated union below — the DB never sees an invalid value because every
 * `upsert` goes through Zod first.
 *
 * **Compatibility (per packages/schemas/CLAUDE.md "additive-only" policy)**:
 * once a value schema ships, fields may only be added (as `.optional()`) or
 * widened. Renames/removals require the three-phase migration. The key enum is
 * append-only.
 */

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * Supported `platform_settings.key` values. Append-only — never remove a key
 * without a migration plan, because stored rows would lose their type binding.
 */
export const PlatformSettingsKeySchema = z.enum([
    'seo.defaults',
    'maintenance.mode',
    'announcements.global',
    'billing.paidSignupsFreeze',
    'billing.addonPurchasesFreeze',
    'billing.providerWatchAuthorization',
    'analytics.sessionRecording'
]);

/** TypeScript type for the supported key set. */
export type PlatformSettingsKey = z.infer<typeof PlatformSettingsKeySchema>;

// ---------------------------------------------------------------------------
// `seo.defaults` value
// ---------------------------------------------------------------------------

/**
 * Value shape for `seo.defaults`. Mirrors the 3 fields previously stored in
 * the admin's `localStorage.SEO_SETTINGS_KEY` (per audit `04-settings.md`
 * §4.1) plus the SSR-time read by the web app.
 */
export const SeoDefaultsValueSchema = z.object({
    /** Meta `<title>` template. `%s` is replaced by the page-specific title. */
    metaTitleTemplate: z.string().min(1).max(255),
    /** Fallback `<meta name="description">` when a page does not set its own. */
    metaDescriptionDefault: z.string().min(1).max(500),
    /** Default Open Graph image URL. */
    ogImageDefault: z.string().url(),
    /**
     * Whether publishing or updating indexable public content notifies the
     * search engines through IndexNow (HOS-585 G-1).
     *
     * `.default(false)` rather than a bare `.optional()`, deliberately, and it
     * carries two guarantees at once:
     *
     * 1. **Additive-only compliance.** Rows written before this field existed
     *    parse without it, so no stored `seo.defaults` value is invalidated —
     *    the policy at the top of this file. A required boolean here would make
     *    every pre-existing row fail `safeParse` and take the admin page down.
     * 2. **Off is the safe default.** Consumers get a plain `boolean`, never
     *    `undefined`, and a fresh deployment does not start emitting on its own
     *    before anyone has verified the key file is published and reachable.
     *    The first ping must be a deliberate act.
     *
     * This flag is NOT the only condition: the emitter also requires a
     * production environment and a configured key. See the spec's §6.5.
     */
    indexNowEnabled: z.boolean().default(false)
});

/** Inferred type for the `seo.defaults` value. */
export type SeoDefaultsValue = z.infer<typeof SeoDefaultsValueSchema>;

// ---------------------------------------------------------------------------
// `maintenance.mode` value
// ---------------------------------------------------------------------------

/**
 * Value shape for `maintenance.mode`. When `enabled` is true, the platform
 * shows a maintenance page to non-SUPER_ADMIN visitors.
 */
export const MaintenanceModeValueSchema = z.object({
    /** Whether maintenance mode is active. */
    enabled: z.boolean(),
    /** Optional message shown on the maintenance page (i18n upstream). */
    message: z.string().max(500).optional()
});

/** Inferred type for the `maintenance.mode` value. */
export type MaintenanceModeValue = z.infer<typeof MaintenanceModeValueSchema>;

// ---------------------------------------------------------------------------
// `announcements.global` value
// ---------------------------------------------------------------------------

/** Visual variant for a global announcement banner. */
export const AnnouncementVariantSchema = z.enum(['info', 'warning', 'danger']);

/** Visual variant for a global announcement banner. */
export type AnnouncementVariant = z.infer<typeof AnnouncementVariantSchema>;

/**
 * A single global announcement item. Stored as part of the
 * `announcements.global` array; rendered cross-device by web + admin via the
 * public endpoint `GET /api/v1/public/announcements`.
 */
export const AnnouncementItemSchema = z.object({
    /** Stable client-generated identifier (UUID) for editing/dismissing. */
    id: z.string().uuid(),
    /** Localized message text — all three locales required per `04 §8.2`. */
    text: z.object({
        es: z.string().min(1).max(1000),
        en: z.string().min(1).max(1000),
        pt: z.string().min(1).max(1000)
    }),
    /** Visual style. */
    variant: AnnouncementVariantSchema,
    /** Whether the user can dismiss this banner. */
    dismissible: z.boolean(),
    /** Optional start of the active window (ISO-8601). Absent = always-on. */
    startsAt: z.string().datetime({ offset: true }).optional(),
    /** Optional end of the active window (ISO-8601). Absent = no expiry. */
    endsAt: z.string().datetime({ offset: true }).optional()
});

/** Inferred type for a single announcement item. */
export type AnnouncementItem = z.infer<typeof AnnouncementItemSchema>;

/**
 * Value shape for `announcements.global`. An array of zero or more announcement
 * items. The public endpoint filters by date window server-side before
 * returning.
 */
export const AnnouncementsValueSchema = z.array(AnnouncementItemSchema);

/** Inferred type for the `announcements.global` value. */
export type AnnouncementsValue = z.infer<typeof AnnouncementsValueSchema>;

/**
 * Value shape for `billing.paidSignupsFreeze` (HOS-1749). While `frozen` is
 * true, new self-service paid signups are refused with 409
 * `NEW_PAID_SIGNUPS_FROZEN`: the card checkout (S1) and the first publish that
 * would start a trial (PB1/T1). An absent row means "not frozen".
 */
export const PaidSignupsFreezeValueSchema = z.object({
    /** Whether new self-service paid signups are paused. */
    frozen: z.boolean()
});

/** Inferred type for the `billing.paidSignupsFreeze` value. */
export type PaidSignupsFreezeValue = z.infer<typeof PaidSignupsFreezeValueSchema>;

/** Value shape for the independent addon purchase freeze. */
/** Stored value for the global addon purchase freeze setting. */
export const AddonPurchasesFreezeValueSchema = z.object({ frozen: z.boolean() });
/** Parsed value of the global addon purchase freeze setting. */
export type AddonPurchasesFreezeValue = z.infer<typeof AddonPurchasesFreezeValueSchema>;

/**
 * What the owner submits to authorize the provider watch battery (HOS-1512, AC:B1:15, AC:B1:20).
 *
 * The production run refuses unless `month` is the current month on the market clock and
 * `maxChargeMinor` is EXACTLY the sum of the declared maximum charges of the account's money-moving
 * measurements (the API computes that sum and refuses any other value); the whole run's charges are
 * also capped at `maxChargeMinor`; the environment guard aborts, sending nothing, when `GET /users/me` answers another account id.
 * An absent row means "not authorized". Money is an integer in minor units (ARS centavos).
 *
 * The consumption fields are NOT part of the input: a new authorization is always unconsumed.
 */
export const ProviderWatchAuthorizationInputSchema = z.object({
    /** Market-time month the authorization covers, `YYYY-MM`. */
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM'),
    /** The amount authorized for ONE run, in ARS centavos: the exact sum of the money-moving measurements. */
    maxChargeMinor: z.number().int().positive(),
    /** The Mercado Pago account id the owner confirmed (read by the API, never typed). */
    accountId: z.string().regex(/^\d{1,20}$/, 'Expected a numeric Mercado Pago account id'),
    /** Nickname of that account, kept for the owner to recognize it. */
    accountNickname: z.string().max(255).optional()
});

/** Input type of the provider watch authorization. */
export type ProviderWatchAuthorizationInput = z.infer<typeof ProviderWatchAuthorizationInputSchema>;

/**
 * Value shape for `billing.providerWatchAuthorization`: the input plus the one-shot consumption
 * state. One authorization allows ONE run within its month; the run that STARTS consumes it,
 * atomically, and a re-run needs a new authorization. `accountId` is optional here only so a
 * hand-edited row without it still parses: the run refuses it.
 */
export const ProviderWatchAuthorizationValueSchema = ProviderWatchAuthorizationInputSchema.partial({
    accountId: true
}).extend({
    /** When the authorization was consumed (ISO-8601). Absent while unconsumed. */
    consumedAt: z.string().datetime({ offset: true }).optional(),
    /** The run that consumed it. Absent while unconsumed. */
    consumedByRunId: z.string().uuid().optional()
});

/** Inferred type for the `billing.providerWatchAuthorization` value. */
export type ProviderWatchAuthorizationValue = z.infer<typeof ProviderWatchAuthorizationValueSchema>;

// ---------------------------------------------------------------------------
// `analytics.sessionRecording` value (HOS-2347)
// ---------------------------------------------------------------------------

/** The only retention periods the owner allows for replays and heatmaps, in days. */
export const SESSION_RECORDING_RETENTION_DAYS_OPTIONS = [14, 30, 60] as const;

/** Retention applied when the setting carries none (owner decision 2026-11-18). */
export const DEFAULT_SESSION_RECORDING_RETENTION_DAYS = 30 as const;

/** Zod enum of the allowed retention periods: `14 | 30 | 60`. */
export const SessionRecordingRetentionDaysSchema = z.union([
    z.literal(14),
    z.literal(30),
    z.literal(60)
]);

/** Inferred type of a retention period in days. */
export type SessionRecordingRetentionDays = z.infer<typeof SessionRecordingRetentionDaysSchema>;

/**
 * Body of `POST /api/v1/admin/session-recording/purge` (HOS-2347): the period
 * the admin saw and confirmed. The server answers 409 when it no longer matches
 * the stored one, so a purge never deletes more than what was confirmed.
 */
export const SessionRecordingPurgeRequestSchema = z
    .object({
        /** The retention the admin confirmed in the dialog, in days. */
        retentionDays: SessionRecordingRetentionDaysSchema
    })
    .strict();

/** Inferred type of the purge request body. */
export type SessionRecordingPurgeRequest = z.infer<typeof SessionRecordingPurgeRequestSchema>;

/**
 * Response of `POST /api/v1/admin/session-recording/purge` (HOS-2347): the
 * counts of what the purge deleted and the period actually used.
 */
export const SessionRecordingPurgeResponseSchema = z.object({
    /** Rows deleted from Umami's `session_replay` table. */
    replaysDeleted: z.number().int().nonnegative(),
    /** Rows deleted from Umami's `heatmap_event` table. */
    heatmapEventsDeleted: z.number().int().nonnegative(),
    /** Saved-replay pointers (`session_replay_saved`) removed. */
    savedReplaysDeleted: z.number().int().nonnegative(),
    /** Retention period the purge used, in days. */
    retentionDays: SessionRecordingRetentionDaysSchema,
    /** True when the time budget stopped the purge early; the next daily run finishes it. */
    stoppedEarly: z.boolean()
});

/** Inferred type of the purge response. */
export type SessionRecordingPurgeResponse = z.infer<typeof SessionRecordingPurgeResponseSchema>;

/**
 * Value shape for `analytics.sessionRecording` (HOS-2347). The ONE switch that
 * decides whether the public web injects the Umami session recorder
 * (`recorder.js`, replays + heatmaps). Every recorder parameter lives in Umami
 * and is managed as code by `pnpm umami:setup`; this value is a single boolean.
 * An absent row means `enabled: false` (fail closed).
 */
export const SessionRecordingValueSchema = z.object({
    /** Whether the web may load the session recorder for consenting visitors. */
    enabled: z.boolean(),
    /**
     * Days a replay or heatmap event is kept before the daily purge deletes it
     * (HOS-2347 retention). Additive: a row written before this field existed
     * parses to the default (30).
     */
    retentionDays: SessionRecordingRetentionDaysSchema.default(
        DEFAULT_SESSION_RECORDING_RETENTION_DAYS
    )
});

/**
 * Partial write of `analytics.sessionRecording` accepted by the admin PATCH
 * (HOS-2347). A field left out keeps its stored value; the service merges it,
 * so a client that sends only `enabled` never resets the period (and the other
 * way round). At least one field is required.
 */
export const SessionRecordingPatchSchema = z
    .object({
        /** Whether the web may load the session recorder. */
        enabled: z.boolean().optional(),
        /** Retention in days. */
        retentionDays: SessionRecordingRetentionDaysSchema.optional()
    })
    .refine((value) => value.enabled !== undefined || value.retentionDays !== undefined, {
        message: 'At least one of enabled or retentionDays is required'
    });

/** Inferred type for the `analytics.sessionRecording` value. */
export type SessionRecordingValue = z.infer<typeof SessionRecordingValueSchema>;

/**
 * Body of `GET /api/v1/public/session-recording` (HOS-2347 §6.3). Strict, with
 * exactly one key: the public read never exposes `updatedAt` or `updatedBy`.
 */
export const PublicSessionRecordingResponseSchema = z
    .object({
        /** Whether the web may load the session recorder. */
        enabled: z.boolean()
    })
    .strict();

/** Inferred type for the public session recording response. */
export type PublicSessionRecordingResponse = z.infer<typeof PublicSessionRecordingResponseSchema>;

// ---------------------------------------------------------------------------
// Discriminated union response
// ---------------------------------------------------------------------------

/**
 * Response shape for `GET /api/v1/admin/platform-settings/:key`. Discriminated
 * by `key` so consumers (admin pages, hooks) get the correctly typed `value`
 * for the key requested. `updatedAt` is serialized as an ISO-8601 string at
 * the API boundary (DB stores `timestamptz`).
 */
export const PlatformSettingsResponseSchema = z.discriminatedUnion('key', [
    z.object({
        key: z.literal('seo.defaults'),
        value: SeoDefaultsValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('maintenance.mode'),
        value: MaintenanceModeValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('announcements.global'),
        value: AnnouncementsValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('billing.paidSignupsFreeze'),
        value: PaidSignupsFreezeValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('billing.addonPurchasesFreeze'),
        value: AddonPurchasesFreezeValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('billing.providerWatchAuthorization'),
        value: ProviderWatchAuthorizationValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    }),
    z.object({
        key: z.literal('analytics.sessionRecording'),
        value: SessionRecordingValueSchema,
        updatedAt: z.string().datetime({ offset: true }),
        updatedBy: z.string().uuid()
    })
]);

/** Inferred response type. */
export type PlatformSettingsResponse = z.infer<typeof PlatformSettingsResponseSchema>;

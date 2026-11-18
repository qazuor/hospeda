import { CACHE_TAG_HOME, CACHE_TAG_SITE_CONFIG } from '@repo/cache-tags';
import { type PlatformSettingRecord, PlatformSettingsModel } from '@repo/db';
import {
    AddonPurchasesFreezeValueSchema,
    type AnnouncementItem,
    AnnouncementsValueSchema,
    DEFAULT_SESSION_RECORDING_RETENTION_DAYS,
    MaintenanceModeValueSchema,
    PaidSignupsFreezeValueSchema,
    PermissionEnum,
    type PlatformSettingsKey,
    PlatformSettingsKeySchema,
    type ProviderWatchAuthorizationInput,
    ProviderWatchAuthorizationInputSchema,
    type ProviderWatchAuthorizationValue,
    ProviderWatchAuthorizationValueSchema,
    SeoDefaultsValueSchema,
    ServiceErrorCode,
    type SessionRecordingRetentionDays,
    SessionRecordingValueSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Platform Settings service (SPEC-156, PR-1).
 *
 * Handles reads and upserts of the cross-device platform settings stored in the
 * `platform_settings` table. Key-value shape, not CRUD-by-id, so it extends
 * `BaseService` (not `BaseCrudService`).
 *
 * Permission model (per tech-analysis D1):
 *   - `seo.defaults` read → `SETTINGS_GENERAL_VIEW`
 *   - `seo.defaults` write → `SETTINGS_GENERAL_WRITE`
 *   - `maintenance.mode` and `announcements.global` (read or write) → `MAINTENANCE_MODE_WRITE`
 *     (SUPER_ADMIN-only — V1 collapses read+write into the single critical perm).
 *   - `billing.paidSignupsFreeze` read → `BILLING_SETTINGS_VIEW`
 *   - `billing.paidSignupsFreeze` write → `BILLING_SETTINGS_WRITE`
 *   - `billing.addonPurchasesFreeze` read → `BILLING_SETTINGS_VIEW`
 *   - `billing.addonPurchasesFreeze` write → `BILLING_SETTINGS_WRITE`
 *   - `billing.providerWatchAuthorization` read → `BILLING_SETTINGS_VIEW`
 *   - `billing.providerWatchAuthorization` write → `BILLING_PROVIDER_WATCH_MANAGE` (SUPER_ADMIN-only: it
 *     authorizes real money to move at the provider, and the owner custodies it, HOS-1512). It is
 *     written ONLY by {@link PlatformSettingsService.setProviderWatchAuthorization}: the API
 *     reads the provider account first, so the generic `upsert` refuses this key.
 *   - `analytics.sessionRecording` (read or write) → `ANALYTICS_SESSION_RECORDING_MANAGE`
 *     (HOS-2347; granted to SUPER_ADMIN by the seed, not locked (D-3); same
 *     read+write collapse as `MAINTENANCE_MODE_WRITE`).
 *
 * Side effect (per tech-analysis D7; tag purge since HOS-369 W1-1): a
 * successful write to `seo.defaults` purges the `site-config` and `home`
 * cache tags against the cached `RevalidationService` instance — settings are
 * not posts, so `revalidateByEntityType({ entityType: 'post' })` was always a
 * hack; `robots.txt`/`llms.txt` emit `site-config` and the home page reads
 * SEO defaults too, so this is the honest mapping. The call is best-effort —
 * failure is logged but does NOT roll back the upsert (revalidation is a
 * cache concern, not a data consistency concern).
 */

// ---------------------------------------------------------------------------
// Input validation schemas (inline — these are service-method input shapes,
// not API contracts; the API contract lives in @repo/schemas as
// PlatformSettingsResponseSchema).
// ---------------------------------------------------------------------------

const GetInputSchema = z.object({
    key: PlatformSettingsKeySchema
});

const UpsertInputSchema = z.discriminatedUnion('key', [
    z.object({ key: z.literal('seo.defaults'), value: SeoDefaultsValueSchema }),
    z.object({ key: z.literal('maintenance.mode'), value: MaintenanceModeValueSchema }),
    z.object({ key: z.literal('announcements.global'), value: AnnouncementsValueSchema }),
    z.object({ key: z.literal('billing.paidSignupsFreeze'), value: PaidSignupsFreezeValueSchema }),
    z.object({
        key: z.literal('billing.addonPurchasesFreeze'),
        value: AddonPurchasesFreezeValueSchema
    }),
    z.object({
        key: z.literal('analytics.sessionRecording'),
        value: SessionRecordingValueSchema
    })
    // `billing.providerWatchAuthorization` is deliberately absent: it is written only through
    // `setProviderWatchAuthorization`, after the API confirmed the provider account (HOS-1512 D5).
]);

// ---------------------------------------------------------------------------
// Permission mappers
// ---------------------------------------------------------------------------

function requiredReadPermission(key: PlatformSettingsKey): PermissionEnum {
    switch (key) {
        case 'seo.defaults':
            return PermissionEnum.SETTINGS_GENERAL_VIEW;
        case 'maintenance.mode':
        case 'announcements.global':
            return PermissionEnum.MAINTENANCE_MODE_WRITE;
        case 'billing.paidSignupsFreeze':
        case 'billing.addonPurchasesFreeze':
        case 'billing.providerWatchAuthorization':
            return PermissionEnum.BILLING_SETTINGS_VIEW;
        case 'analytics.sessionRecording':
            return PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE;
        default: {
            const exhaustive: never = key;
            return exhaustive;
        }
    }
}

function requiredWritePermission(key: PlatformSettingsKey): PermissionEnum {
    switch (key) {
        case 'seo.defaults':
            return PermissionEnum.SETTINGS_GENERAL_WRITE;
        case 'maintenance.mode':
        case 'announcements.global':
            return PermissionEnum.MAINTENANCE_MODE_WRITE;
        case 'billing.paidSignupsFreeze':
        case 'billing.addonPurchasesFreeze':
            return PermissionEnum.BILLING_SETTINGS_WRITE;
        case 'billing.providerWatchAuthorization':
            return PermissionEnum.BILLING_PROVIDER_WATCH_MANAGE;
        case 'analytics.sessionRecording':
            return PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE;
        default: {
            const exhaustive: never = key;
            return exhaustive;
        }
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PlatformSettingsService extends BaseService {
    private readonly model: PlatformSettingsModel;

    constructor(config: ServiceConfig, model?: PlatformSettingsModel) {
        super(config, 'platform_settings');
        this.model = model ?? new PlatformSettingsModel();
    }

    /**
     * Reads a setting row by key. Returns `null` when the key has never been
     * written (callers should fall back to built-in defaults).
     */
    async get(
        input: { actor: Actor; key: PlatformSettingsKey },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PlatformSettingRecord | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'get',
            input,
            schema: GetInputSchema,
            ctx,
            execute: async (data, actor, resolvedCtx) => {
                this.checkReadPermission(actor, data.key);
                const row = await this.model.findByKey(data.key, resolvedCtx.tx);
                return row ?? null;
            }
        });
    }

    /**
     * Reads the currently-active global announcements. Public access — no
     * `Actor` required, no permission gate. Filters out items whose
     * `startsAt`/`endsAt` window does not include the supplied `now`
     * (defaults to current time).
     *
     * Returns `[]` when:
     *   - the `announcements.global` key has never been written, or
     *   - no announcement's window intersects `now`.
     *
     * The shape mirrors `AnnouncementsValueSchema`. Date comparisons use
     * ISO-8601 string ordering (lexicographic), which is correct for UTC-Z
     * timestamps and offset-bearing ISO-8601 strings produced by Date.toISOString
     * + AnnouncementItemSchema validation upstream.
     *
     * **Why this method instead of `get`**: `get` enforces a per-key permission
     * gate (MAINTENANCE_MODE_WRITE for announcements), which is appropriate
     * for the admin read but not for the public endpoint. This method is the
     * narrow read path the public route uses.
     */
    async findActiveAnnouncements(now: Date = new Date()): Promise<AnnouncementItem[]> {
        const row = await this.model.findByKey('announcements.global');
        if (!row) return [];
        const parsed = AnnouncementsValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Stored announcements.global value failed schema validation — returning empty list'
            );
            return [];
        }
        const nowIso = now.toISOString();
        return parsed.data.filter((item) => {
            if (item.startsAt && item.startsAt > nowIso) return false;
            if (item.endsAt && item.endsAt < nowIso) return false;
            return true;
        });
    }

    /**
     * Whether publishing or updating public content should notify the search
     * engines through IndexNow (HOS-585 G-1).
     *
     * **Why this method instead of `get`**: same reason as
     * {@link findActiveAnnouncements}. `get` enforces a per-key permission gate
     * meant for the admin read, and the only caller here is a fire-and-forget
     * hook running next to a content write — there is no actor to gate on and
     * nothing to gate: the answer is a single boolean the operator set for the
     * whole platform.
     *
     * **Read on every send, never cached.** The toggle's entire purpose is to
     * stop submissions without a deploy; a value memoized at startup would make
     * turning it off require the very restart it exists to avoid (AC-12).
     *
     * Fails closed. A missing row, an unparseable value, or a read error all
     * answer `false`: not notifying is always recoverable, and notifying when
     * the operator asked you not to is not.
     *
     * @returns Whether IndexNow notifications are enabled.
     */
    async isIndexNowEnabled(): Promise<boolean> {
        try {
            const row = await this.model.findByKey('seo.defaults');
            if (!row) return false;

            const parsed = SeoDefaultsValueSchema.safeParse(row.value);
            if (!parsed.success) {
                this.logger.warn(
                    { issues: parsed.error.issues },
                    'Stored seo.defaults value failed schema validation — IndexNow stays disabled'
                );
                return false;
            }

            return parsed.data.indexNowEnabled;
        } catch (error) {
            this.logger.warn(
                { error: error instanceof Error ? error.message : String(error) },
                'Could not read seo.defaults — IndexNow stays disabled'
            );
            return false;
        }
    }

    /**
     * Whether new self-service paid signups are paused (HOS-1749).
     *
     * **Why this method instead of `get`**: same reason as {@link isIndexNowEnabled}.
     * The callers are the checkout (S1) and the first publish (PB1), where there is
     * no admin actor to gate on: the answer is one platform-wide boolean.
     *
     * **Read on every call, never cached**: the switch exists to stop signups
     * without a deploy or a restart.
     *
     * A missing row answers `false` (never frozen by default). A stored value that
     * fails the schema answers `false` and logs a warning: every write goes through
     * Zod, so only a hand-edited row can be malformed. A read error is NOT
     * swallowed: it propagates, so the checkout or the publish fails as it would on
     * any other database error instead of silently opening or closing signups.
     *
     * @returns Whether new paid signups are frozen.
     */
    async isNewPaidSignupsFrozen(): Promise<boolean> {
        const row = await this.model.findByKey('billing.paidSignupsFreeze');
        if (!row) return false;
        const parsed = PaidSignupsFreezeValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Stored billing.paidSignupsFreeze value failed schema validation — signups stay open'
            );
            return false;
        }
        return parsed.data.frozen;
    }

    /**
     * Whether new addon purchases are paused (HOS-1749).
     * Reads the independent global switch on every call. Missing or malformed
     * values leave purchases open; database read errors propagate.
     *
     * @returns Whether new addon purchases are frozen.
     */
    async isAddonPurchasesFrozen(): Promise<boolean> {
        const row = await this.model.findByKey('billing.addonPurchasesFreeze');
        if (!row) return false;
        const parsed = AddonPurchasesFreezeValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Invalid addon purchase freeze; purchases stay open'
            );
            return false;
        }
        return parsed.data.frozen;
    }

    /**
     * Whether the public web may load the Umami session recorder (HOS-2347).
     *
     * **Why this method instead of `get`**: same reason as
     * {@link isNewPaidSignupsFrozen}. The only caller is the public endpoint
     * `GET /api/v1/public/session-recording`, which has no admin actor to gate
     * on; the answer is one platform-wide boolean.
     *
     * A missing row answers `false` (recording is off by default). A stored
     * value that fails the schema answers `false` and logs a warning. A read
     * error is NOT swallowed: it propagates so the route answers 500 and the
     * outage is visible. The web fails closed on a 500 anyway.
     *
     * @returns Whether session recording is switched on.
     */
    async isSessionRecordingEnabled(): Promise<boolean> {
        const row = await this.model.findByKey('analytics.sessionRecording');
        if (!row) return false;
        const parsed = SessionRecordingValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Stored analytics.sessionRecording value failed schema validation — recording stays off'
            );
            return false;
        }
        return parsed.data.enabled;
    }

    /**
     * How many days a Umami replay or heatmap event is kept (HOS-2347 retention).
     *
     * **Why this method instead of `get`**: the callers are the daily retention
     * cron and the manual purge, and the cron has no actor. The answer is one
     * platform-wide number.
     *
     * Independent of the on/off switch: old data has to go even while recording
     * is OFF. A missing row, a row written before the field existed, or a value
     * that fails the schema answers the default (30 days). A read error is NOT
     * swallowed, so the caller fails loudly instead of purging on a guess.
     *
     * @returns The configured retention in days: 14, 30 or 60.
     */
    async getSessionRecordingRetentionDays(): Promise<SessionRecordingRetentionDays> {
        const row = await this.model.findByKey('analytics.sessionRecording');
        if (!row) return DEFAULT_SESSION_RECORDING_RETENTION_DAYS;
        const parsed = SessionRecordingValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Stored analytics.sessionRecording value failed schema validation, using the default retention'
            );
            return DEFAULT_SESSION_RECORDING_RETENTION_DAYS;
        }
        return parsed.data.retentionDays;
    }

    /**
     * The owner's monthly authorization for the provider watch battery (HOS-1512).
     *
     * **Why this method instead of `get`**: the caller is a cron job with no admin actor.
     *
     * **Read on every run, never cached**: the authorization is renewed every month and the
     * production run must see the month in force NOW.
     *
     * Fails closed: a missing row or a value that fails the schema answers `null`, which means
     * "not authorized" (the production run refuses, a money-moving measurement aborts). A read
     * error is NOT swallowed.
     *
     * @returns The authorization, or `null` when none is in force.
     */
    async getProviderWatchAuthorization(): Promise<ProviderWatchAuthorizationValue | null> {
        const row = await this.model.findByKey('billing.providerWatchAuthorization');
        if (!row) return null;
        const parsed = ProviderWatchAuthorizationValueSchema.safeParse(row.value);
        if (!parsed.success) {
            this.logger.warn(
                { issues: parsed.error.issues },
                'Stored billing.providerWatchAuthorization value failed schema validation — treated as not authorized'
            );
            return null;
        }
        return parsed.data;
    }

    /**
     * Writes the owner's monthly authorization for the provider watch battery (HOS-1512). Always a
     * NEW authorization: the consumption fields are never accepted, so it is unconsumed. Requires
     * `BILLING_PROVIDER_WATCH_MANAGE`. The caller (the admin route) has already read the provider account
     * and confirmed `accountId` with the owner.
     *
     * @param input.actor - The owner
     * @param input.value - Month, exact maximum charge and the confirmed account id
     * @returns The stored row
     */
    async setProviderWatchAuthorization(
        input: { actor: Actor; value: ProviderWatchAuthorizationInput },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PlatformSettingRecord>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setProviderWatchAuthorization',
            input,
            schema: z.object({ value: ProviderWatchAuthorizationInputSchema }),
            ctx,
            execute: async (data, actor, resolvedCtx) => {
                this.checkWritePermission(actor, 'billing.providerWatchAuthorization');
                return this.model.upsertByKey(
                    'billing.providerWatchAuthorization',
                    data.value,
                    actor.id,
                    resolvedCtx.tx
                );
            }
        });
    }

    /**
     * Upserts a setting row. The value shape is validated by a per-key Zod
     * branch (discriminated union) so an SEO payload sent under
     * `maintenance.mode` is rejected before it reaches the DB.
     *
     * Side effect: writes to `seo.defaults` trigger a best-effort revalidation
     * of all post pages + the home (per tech-analysis D7). Revalidation
     * failures are logged and swallowed — they never roll back the upsert.
     */
    async upsert(
        input: { actor: Actor; key: PlatformSettingsKey; value: unknown },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PlatformSettingRecord>> {
        return this.runWithLoggingAndValidation({
            methodName: 'upsert',
            input,
            schema: UpsertInputSchema,
            ctx,
            execute: async (data, actor, resolvedCtx) => {
                this.checkWritePermission(actor, data.key);
                const row = await this.model.upsertByKey(
                    data.key,
                    data.value,
                    actor.id,
                    resolvedCtx.tx
                );
                if (data.key === 'seo.defaults') {
                    this.triggerSeoRevalidation();
                }
                return row;
            }
        });
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private checkReadPermission(actor: Actor, key: PlatformSettingsKey): void {
        const required = requiredReadPermission(key);
        if (!actor.permissions.includes(required)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                `Permission denied: ${required} required to view "${key}"`
            );
        }
    }

    private checkWritePermission(actor: Actor, key: PlatformSettingsKey): void {
        const required = requiredWritePermission(key);
        if (!actor.permissions.includes(required)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                `Permission denied: ${required} required to update "${key}"`
            );
        }
    }

    /**
     * Schedules a best-effort purge of the `site-config` and `home` cache
     * tags after a `seo.defaults` write. The web app reads SEO defaults at
     * SSR time, so stale meta tags persist until the relevant pages are
     * purged. If the revalidation service is not initialized (e.g. running
     * in a test harness without the global init), this is a silent no-op.
     */
    private triggerSeoRevalidation(): void {
        try {
            const svc = getRevalidationService();
            if (!svc) {
                this.logger.warn(
                    'SEO defaults: RevalidationService not initialized — revalidation skipped'
                );
                return;
            }
            // Fire-and-forget — revalidation should not block the response.
            void svc.revalidateTags({
                tags: [CACHE_TAG_SITE_CONFIG, CACHE_TAG_HOME],
                entityType: 'platform_settings',
                trigger: 'hook'
            });
        } catch (error) {
            this.logger.warn(
                { error },
                'SEO defaults: revalidation scheduling failed (best-effort, non-blocking)'
            );
        }
    }
}

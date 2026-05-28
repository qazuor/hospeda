import { type PlatformSettingRecord, PlatformSettingsModel } from '@repo/db';
import {
    type AnnouncementItem,
    AnnouncementsValueSchema,
    MaintenanceModeValueSchema,
    PermissionEnum,
    type PlatformSettingsKey,
    PlatformSettingsKeySchema,
    SeoDefaultsValueSchema,
    ServiceErrorCode
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
 *
 * Side effect (per tech-analysis D7): a successful write to `seo.defaults`
 * fires `revalidateByEntityType({ entityType: 'post' })` against the cached
 * `RevalidationService` instance. The call is best-effort — failure is logged
 * but does NOT roll back the upsert (revalidation is a cache concern, not a
 * data consistency concern).
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
    z.object({ key: z.literal('announcements.global'), value: AnnouncementsValueSchema })
]);

// ---------------------------------------------------------------------------
// Permission mappers
// ---------------------------------------------------------------------------

function requiredReadPermission(key: PlatformSettingsKey): PermissionEnum {
    return key === 'seo.defaults'
        ? PermissionEnum.SETTINGS_GENERAL_VIEW
        : PermissionEnum.MAINTENANCE_MODE_WRITE;
}

function requiredWritePermission(key: PlatformSettingsKey): PermissionEnum {
    return key === 'seo.defaults'
        ? PermissionEnum.SETTINGS_GENERAL_WRITE
        : PermissionEnum.MAINTENANCE_MODE_WRITE;
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
     * Schedules a best-effort revalidation of all post pages after a
     * `seo.defaults` write. The web app reads SEO defaults at SSR time, so
     * stale meta tags persist until the relevant pages are regenerated. If
     * the revalidation service is not initialized (e.g. running in a test
     * harness without the global init), this is a silent no-op.
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
            void svc.revalidateByEntityType({ entityType: 'post', trigger: 'hook' });
        } catch (error) {
            this.logger.warn(
                { error },
                'SEO defaults: revalidation scheduling failed (best-effort, non-blocking)'
            );
        }
    }
}

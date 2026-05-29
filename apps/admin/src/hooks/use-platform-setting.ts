/**
 * Hook layer for reading + writing `platform_settings.{key}` (SPEC-156 PR-3).
 *
 * Reads via `GET /api/v1/admin/platform-settings/{key}` and writes via the
 * matching `PATCH`. Both hooks are TanStack Query primitives that compose
 * with the per-page form state on `/platform/critical` (T-029) and
 * `/platform/configuration/seo` (T-030).
 *
 * One-time migration:
 * - On read, when the API row is `null` AND a `LegacyStorageAdapter` is
 *   provided, the adapter pulls the dev-only value previously stored under
 *   the legacy `localStorage` key so the page can seed its form with it.
 * - On successful save, the matching `localStorage` entry is removed so the
 *   legacy fallback no longer applies once the API holds the source of
 *   truth.
 *
 * The result shape is `{ row, legacyValue, source }` so the caller can tell
 * apart API-persisted state (`source: 'api'`) from migrated localStorage
 * state (`source: 'legacy'`) from defaults (`source: 'default'`).
 *
 * @module use-platform-setting
 */

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';
import type {
    AnnouncementsValue,
    MaintenanceModeValue,
    PlatformSettingsKey,
    SeoDefaultsValue
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Type-level mapping: key -> value shape
// ---------------------------------------------------------------------------

/**
 * Conditional type mapping a `PlatformSettingsKey` to its concrete value
 * shape. Kept in sync with the discriminated union in
 * `@repo/schemas` (`platform-settings.schema.ts`).
 */
export type PlatformSettingValue<K extends PlatformSettingsKey> = K extends 'seo.defaults'
    ? SeoDefaultsValue
    : K extends 'maintenance.mode'
      ? MaintenanceModeValue
      : K extends 'announcements.global'
        ? AnnouncementsValue
        : never;

/**
 * Shape of a single row returned by `GET /api/v1/admin/platform-settings/{key}`.
 */
export type PlatformSettingRow<K extends PlatformSettingsKey> = {
    readonly key: K;
    readonly value: PlatformSettingValue<K>;
    readonly updatedAt: string;
    readonly updatedBy: string;
};

// ---------------------------------------------------------------------------
// Query-key factory
// ---------------------------------------------------------------------------

/**
 * TanStack Query key factory for platform-settings queries. The detail-level
 * key is keyed by the platform_settings `key` so cross-key invalidations stay
 * scoped.
 */
export const platformSettingsQueryKeys = {
    all: ['platform-settings'] as const,
    detail: <K extends PlatformSettingsKey>(key: K) => ['platform-settings', key] as const
} as const;

// ---------------------------------------------------------------------------
// Legacy storage adapter
// ---------------------------------------------------------------------------

/**
 * Adapter wrapping the legacy `localStorage` key for a given platform
 * setting. The `read` function returns a parsed value (matching the API
 * shape) or `null` when the key is absent or malformed.
 */
export type LegacyStorageAdapter<V> = {
    readonly legacyKey: string;
    readonly read: () => V | null;
};

const safeGetItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeRemoveItem = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch (err) {
        adminLogger.warn(`Failed to remove legacy localStorage key '${key}'`, { err });
    }
};

/**
 * Pre-built adapters for the legacy keys used by the admin pages before the
 * `platform_settings` API existed. Each adapter translates the legacy
 * `localStorage` shape (often a primitive or a shape with different field
 * names) into the API-canonical value type.
 */
export const legacyAdapters = {
    /**
     * `/platform/critical` used to store the maintenance flag as a bare
     * boolean under `hospeda-admin-maintenance-mode`. Mapped to
     * `MaintenanceModeValue` with `enabled` set and no message.
     */
    maintenanceMode: {
        legacyKey: 'hospeda-admin-maintenance-mode',
        read: (): MaintenanceModeValue | null => {
            const raw = safeGetItem('hospeda-admin-maintenance-mode');
            if (raw === null) return null;
            try {
                const parsed: unknown = JSON.parse(raw);
                if (typeof parsed === 'boolean') return { enabled: parsed };
                return null;
            } catch {
                return null;
            }
        }
    } satisfies LegacyStorageAdapter<MaintenanceModeValue>,

    /**
     * `/platform/configuration/seo` used to store the SEO defaults under
     * `hospeda-admin-seo-settings` with the old field names
     * (`titleTemplate`, `defaultDescription`, `defaultOgImage`). The adapter
     * translates those into the new API field names
     * (`metaTitleTemplate`, `metaDescriptionDefault`, `ogImageDefault`).
     * Missing fields cause the adapter to fall back to `null` (no migration)
     * rather than persist partial state.
     */
    seoDefaults: {
        legacyKey: 'hospeda-admin-seo-settings',
        read: (): SeoDefaultsValue | null => {
            const raw = safeGetItem('hospeda-admin-seo-settings');
            if (raw === null) return null;
            try {
                const parsed = JSON.parse(raw) as Record<string, unknown> | null;
                if (parsed === null || typeof parsed !== 'object') return null;
                const titleTemplate = parsed.titleTemplate ?? parsed.metaTitleTemplate;
                const defaultDescription =
                    parsed.defaultDescription ?? parsed.metaDescriptionDefault;
                const defaultOgImage = parsed.defaultOgImage ?? parsed.ogImageDefault;
                if (
                    typeof titleTemplate !== 'string' ||
                    typeof defaultDescription !== 'string' ||
                    typeof defaultOgImage !== 'string'
                ) {
                    return null;
                }
                return {
                    metaTitleTemplate: titleTemplate,
                    metaDescriptionDefault: defaultDescription,
                    ogImageDefault: defaultOgImage
                };
            } catch {
                return null;
            }
        }
    } satisfies LegacyStorageAdapter<SeoDefaultsValue>
} as const;

// ---------------------------------------------------------------------------
// Read hook
// ---------------------------------------------------------------------------

/**
 * Result returned by `usePlatformSetting`. `source` indicates where the
 * returned `value` came from so the caller can render different affordances
 * (e.g. a "draft from local cache" badge while `source === 'legacy'`).
 */
export type PlatformSettingReadResult<K extends PlatformSettingsKey> = {
    /** API-persisted row (with timestamps) or `null` if the key was never written. */
    readonly row: PlatformSettingRow<K> | null;
    /** Legacy value pulled from `localStorage`, only set when `row === null`. */
    readonly legacyValue: PlatformSettingValue<K> | null;
};

/**
 * Read the current value for a `platform_settings` key.
 *
 * When the API row is missing and a `legacyAdapter` is provided, the hook
 * also returns the legacy `localStorage` value so the caller can prefill its
 * form. The API is the source of truth; the legacy value is only a
 * migration aid (cleared on first save).
 *
 * @example
 * ```tsx
 * const { data, isLoading } = usePlatformSetting({
 *   key: 'maintenance.mode',
 *   legacyAdapter: legacyAdapters.maintenanceMode,
 * });
 * const value = data?.row?.value ?? data?.legacyValue ?? { enabled: false };
 * ```
 */
export function usePlatformSetting<K extends PlatformSettingsKey>({
    key,
    legacyAdapter
}: {
    readonly key: K;
    readonly legacyAdapter?: LegacyStorageAdapter<PlatformSettingValue<K>>;
}) {
    return useQuery({
        queryKey: platformSettingsQueryKeys.detail(key),
        queryFn: async (): Promise<PlatformSettingReadResult<K>> => {
            const response = await fetchApi<unknown>({
                path: `/api/v1/admin/platform-settings/${encodeURIComponent(key)}`
            });
            const apiResponse = response.data as {
                success?: boolean;
                data?: PlatformSettingRow<K> | null;
            };
            const row = (apiResponse.data ?? null) as PlatformSettingRow<K> | null;
            const legacyValue = row === null && legacyAdapter ? legacyAdapter.read() : null;
            return { row, legacyValue };
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000
    });
}

// ---------------------------------------------------------------------------
// Write hook
// ---------------------------------------------------------------------------

/**
 * Mutate a `platform_settings` key.
 *
 * On success: writes the returned row into the query cache and removes the
 * legacy `localStorage` entry (when `legacyAdapter` is provided), so future
 * reads come from the API exclusively.
 *
 * @example
 * ```tsx
 * const save = useUpdatePlatformSetting({
 *   key: 'maintenance.mode',
 *   legacyAdapter: legacyAdapters.maintenanceMode,
 * });
 * await save.mutateAsync({ enabled: true });
 * ```
 */
export function useUpdatePlatformSetting<K extends PlatformSettingsKey>({
    key,
    legacyAdapter
}: {
    readonly key: K;
    readonly legacyAdapter?: Pick<LegacyStorageAdapter<PlatformSettingValue<K>>, 'legacyKey'>;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (value: PlatformSettingValue<K>): Promise<PlatformSettingRow<K>> => {
            const response = await fetchApi<unknown>({
                path: `/api/v1/admin/platform-settings/${encodeURIComponent(key)}`,
                method: 'PATCH',
                body: { value }
            });
            const apiResponse = response.data as {
                success?: boolean;
                data: PlatformSettingRow<K>;
            };
            return apiResponse.data;
        },
        onSuccess: (updatedRow) => {
            queryClient.setQueryData(platformSettingsQueryKeys.detail(key), {
                row: updatedRow,
                legacyValue: null
            } satisfies PlatformSettingReadResult<K>);
            queryClient.invalidateQueries({ queryKey: platformSettingsQueryKeys.all });

            if (legacyAdapter?.legacyKey) {
                safeRemoveItem(legacyAdapter.legacyKey);
            }
        }
    });
}

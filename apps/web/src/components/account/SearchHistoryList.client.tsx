/**
 * @file SearchHistoryList.client.tsx
 * @description React island for the search history page (SPEC-289 P3).
 *
 * Renders the authenticated user's past search entries with:
 *  - Query summary + compact filter chips, relative timestamp, result count
 *    (kit `ListRow`s, see `search-history/SearchHistoryEntries.tsx`)
 *  - "Re-run" action (rebuilds the search URL and navigates)
 *  - Delete-one and "Clear all" actions, both asked with the kit ConfirmDialog
 *  - Recording state (read-only; the switch lives in Preferences, HOS-2479)
 *  - Plan gate as a kit LockedState with the catalog plan names (HOS-2554)
 *
 * HOS-2501: kit Sections, Skeleton, ErrorState, EmptyState and LockedState.
 *
 * All API calls go to `/api/v1/protected/search-history/*`.
 * The initial `searchHistoryEnabled` state is provided by the Astro page
 * (fetched server-side) to avoid a flash on mount.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { SearchIcon } from '@repo/icons';
import type { SearchHistoryFilters, UserSearchHistoryListItem } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './SearchHistoryList.module.css';
import { SearchHistoryEntries } from './search-history/SearchHistoryEntries';
import {
    Button,
    EmptyState,
    ErrorState,
    LockedState,
    Section,
    Skeleton,
    StatusPill,
    TextLink,
    useConfirm
} from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of each item returned by GET /api/v1/protected/search-history */
interface SearchHistoryApiItem {
    readonly id: string;
    readonly userId: string;
    readonly queryText: string | null;
    readonly filtersJson: SearchHistoryFilters | null;
    readonly resultCount: number | null;
    /** ISO timestamp string from JSON serialization */
    readonly createdAt: string;
}

/** List response envelope */
interface HistoryListResponse {
    readonly success: boolean;
    readonly data?: {
        readonly items?: SearchHistoryApiItem[];
    };
    /**
     * `code` carries the `ServiceErrorCode` (e.g. `ENTITLEMENT_REQUIRED`) so
     * `fetchEntries` can special-case the free-tier plan gate (BETA-148)
     * instead of surfacing a generic error for every non-2xx response.
     */
    readonly error?: { readonly code?: string | null; readonly message?: string };
}

/** Generic mutation response envelope */
interface MutationResponse {
    readonly success: boolean;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
    };
}

/** Props for the SearchHistoryList island */
export interface SearchHistoryListProps {
    /** Active locale for i18n and URL building */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
    /**
     * Authenticated user ID.
     * NOTE: not used for API calls — the session cookie is authoritative for
     * all protected endpoints. Reserved for future display purposes.
     */
    readonly userId: string;
    /**
     * Initial value of the `searchHistoryEnabled` preference.
     * Fetched server-side to avoid a flash on mount.
     */
    readonly initialHistoryEnabled: boolean;
    /**
     * HOS-2554: catalog names of the plans that carry search history, read by the SSR page
     * (the catalog reader is server-only). Empty when the catalog could not be read.
     */
    readonly gatePlanNames?: readonly string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Search history list island.
 *
 * Lists the authenticated user's past searches, provides re-run, delete,
 * clear-all, and opt-out toggle actions.
 */
export function SearchHistoryList({
    locale,
    apiUrl,
    userId: _userId,
    initialHistoryEnabled,
    gatePlanNames = []
}: SearchHistoryListProps) {
    // Memoized so `t` keeps a stable reference across renders — otherwise it
    // recreates on every render, which cascades into the useCallback deps
    // below (fetchEntries, etc.) and re-triggers the mount effect in an
    // infinite loop (fetch -> setState -> render -> new `t` -> fetch -> ...).
    // Same fix as ExternalReputationSection.client.tsx.
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [entries, setEntries] = useState<SearchHistoryApiItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /**
     * True when the last fetch was blocked by the `CAN_VIEW_SEARCH_HISTORY`
     * entitlement gate (403 `ENTITLEMENT_REQUIRED`) — i.e. a free-tier user.
     * Renders the existing upsell/empty-state copy plus an upgrade CTA
     * instead of the generic error message (BETA-148).
     */
    const [entitlementRequired, setEntitlementRequired] = useState(false);
    // HOS-2479: read-only here; the switch lives in Preferences.
    const isHistoryEnabled = initialHistoryEnabled;
    const { confirm: askConfirmation, confirmDialog } = useConfirm({ locale });

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Pre-compute translated strings that appear in callbacks to avoid stale
    // deps on the `t` function (same pattern as PreferenceToggles).
    const fetchErrorMsg = t('account.searchHistory.errorFetch', 'No se pudo cargar el historial');
    const deleteErrorMsg = t(
        'account.searchHistory.deleteError',
        'No se pudo eliminar la búsqueda'
    );
    const clearErrorMsg = t('account.searchHistory.clearError', 'No se pudo borrar el historial');
    const deleteSuccessMsg = t('account.searchHistory.deleteSuccess', 'Búsqueda eliminada');
    const clearSuccessMsg = t('account.searchHistory.clearSuccess', 'Historial borrado');

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchEntries = useCallback(async () => {
        if (!isMountedRef.current) return;
        setLoading(true);
        setError(null);
        setEntitlementRequired(false);
        try {
            const res = await fetch(`${base}/api/v1/protected/search-history`, {
                credentials: 'include'
            });

            // Parse the JSON body BEFORE branching on `res.ok` (BETA-148): the
            // `gateSearchHistory` entitlement gate
            // (apps/api/src/middlewares/tourist-entitlements.ts) returns a 403
            // with `code: 'ENTITLEMENT_REQUIRED'` and a friendly upgrade
            // message for free-tier users. That case must render the
            // existing upsell/empty-state UI instead of the generic error
            // below, so the body has to be read regardless of status.
            let body: HistoryListResponse | null = null;
            try {
                body = (await res.json()) as HistoryListResponse;
            } catch {
                // Non-JSON body — `body` stays null, generic message is used.
            }

            if (!res.ok) {
                if (res.status === 403 && body?.error?.code === 'ENTITLEMENT_REQUIRED') {
                    if (isMountedRef.current) {
                        setEntries([]);
                        setEntitlementRequired(true);
                    }
                    return;
                }
                throw new Error(
                    translateApiError({ error: body?.error, t, fallback: fetchErrorMsg })
                );
            }

            if (!body?.success) {
                throw new Error(
                    translateApiError({ error: body?.error, t, fallback: fetchErrorMsg })
                );
            }
            if (isMountedRef.current) {
                setEntries(body.data?.items ?? []);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : fetchErrorMsg);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [base, fetchErrorMsg, t]);

    useEffect(() => {
        void fetchEntries();
    }, [fetchEntries]);

    // ── Delete one ────────────────────────────────────────────────────────────

    /**
     * Hard-delete a single history entry. Asks with the kit ConfirmDialog; the
     * dialog runs the request and stays open with a retry when it fails.
     */
    const requestDelete = useCallback(
        async (entry: SearchHistoryApiItem) => {
            await askConfirmation({
                title: t('account.searchHistory.deleteConfirmTitle'),
                description: t('account.searchHistory.deleteConfirmBody', undefined, {
                    query: entry.queryText ?? t('account.searchHistory.noQuery')
                }),
                confirmLabel: t('account.searchHistory.deleteOneConfirm'),
                cancelLabel: t('account.searchHistory.clearAllCancel'),
                onConfirm: async () => {
                    const res = await fetch(`${base}/api/v1/protected/search-history/${entry.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    const body = (await res.json()) as MutationResponse;
                    if (!res.ok || !body.success) {
                        throw new Error(
                            translateApiError({ error: body.error, t, fallback: deleteErrorMsg })
                        );
                    }
                    if (isMountedRef.current) {
                        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                        addToast({ type: 'success', message: deleteSuccessMsg });
                    }
                }
            });
        },
        [base, askConfirmation, deleteErrorMsg, deleteSuccessMsg, t]
    );

    // ── Clear all ─────────────────────────────────────────────────────────────

    /** Hard-delete all history entries for this user, after the kit ConfirmDialog. */
    const requestClearAll = useCallback(async () => {
        await askConfirmation({
            title: t('account.searchHistory.clearConfirmTitle'),
            description: t('account.searchHistory.clearConfirmBody'),
            confirmLabel: t('account.searchHistory.clearAllInline'),
            cancelLabel: t('account.searchHistory.clearAllCancel'),
            onConfirm: async () => {
                const res = await fetch(`${base}/api/v1/protected/search-history`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const body = (await res.json()) as MutationResponse;
                if (!res.ok || !body.success) {
                    throw new Error(
                        translateApiError({ error: body.error, t, fallback: clearErrorMsg })
                    );
                }
                if (isMountedRef.current) {
                    setEntries([]);
                    addToast({ type: 'success', message: clearSuccessMsg });
                }
            }
        });
    }, [base, clearErrorMsg, clearSuccessMsg, askConfirmation, t]);

    // ── Render ────────────────────────────────────────────────────────────────

    // Locale-aware upgrade CTA target for the plan gate (BETA-148). Built locally
    // rather than trusting the API gate's raw `details.upgradeUrl`
    // (`/billing/plans`, not a real web route). Points at the tourist pricing
    // page, not the owner one (BETA-174): this is a tourist-only feature.
    const preferencesHref = buildUrl({ locale, path: 'mi-cuenta/preferencias' });
    const upgradeUrl = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist });

    if (loading) {
        return (
            <Section
                title={t('account.searchHistory.listTitle')}
                helpId="section:account.search-history-list"
            >
                <Skeleton.Row locale={locale} />
                <Skeleton.Row locale={locale} />
            </Section>
        );
    }

    if (error) {
        return (
            <ErrorState
                locale={locale}
                description={error}
                onRetry={() => fetchEntries()}
            />
        );
    }

    // The plan gate: the catalog plan names come from the SSR page (HOS-2554).
    if (entitlementRequired) {
        return (
            <LockedState
                locale={locale}
                reason={{
                    kind: 'plan',
                    feature: t('account.pages.searchHistory.title'),
                    description: t('account.searchHistory.optOut.description'),
                    plans: gatePlanNames.map((name) => ({ name })),
                    plansHref: upgradeUrl
                }}
            />
        );
    }

    const isEmpty = entries.length === 0;

    return (
        <div className={styles.groups}>
            {/* ── Recording state (HOS-2479): the switch lives in Preferences ── */}
            <Section
                title={t('account.searchHistory.recordingTitle')}
                description={t('account.searchHistory.optOut.description')}
                helpId="section:account.search-history-recording"
            >
                <div className={styles.recording}>
                    <StatusPill tone={isHistoryEnabled ? 'success' : 'neutral'}>
                        {isHistoryEnabled
                            ? t('account.searchHistory.optOut.enabled')
                            : t('account.searchHistory.optOut.disabled')}
                    </StatusPill>
                    <TextLink href={preferencesHref}>
                        {t('account.preferences.changeInPreferences')}
                    </TextLink>
                </div>
            </Section>

            {/* ── The saved searches ───────────────────────────────────────── */}
            <Section
                title={t('account.searchHistory.listTitle')}
                helpId="section:account.search-history-list"
                actions={
                    isEmpty ? undefined : (
                        <Button
                            variant="danger-ghost"
                            size="sm"
                            onClick={() => void requestClearAll()}
                        >
                            {t('account.searchHistory.clearAll')}
                        </Button>
                    )
                }
            >
                {isEmpty ? (
                    <EmptyState
                        title={t('account.searchHistory.empty.title')}
                        description={t('account.searchHistory.empty.body')}
                        icon={<SearchIcon size={28} />}
                    />
                ) : (
                    <SearchHistoryEntries
                        entries={entries}
                        locale={locale}
                        onDelete={(entry) => void requestDelete(entry)}
                    />
                )}
            </Section>
            {confirmDialog}
        </div>
    );
}

// Exported type alias so tests can import the exact item shape.
// UserSearchHistoryListItem is re-exported for downstream consumers.
export type { SearchHistoryApiItem, UserSearchHistoryListItem };

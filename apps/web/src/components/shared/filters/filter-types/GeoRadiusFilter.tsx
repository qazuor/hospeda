/**
 * @file GeoRadiusFilter.tsx
 * @description Composite location filter that lets the user center their search
 * on their device location (browser geolocation API), a caller-provided
 * destination, or a specific point of interest (HOS-142 G-6 — autocomplete
 * against the public POI catalog), plus a radius preset row. Emits a single
 * `GeoRadiusState` value through `onChange`; the FilterSidebar dispatches a
 * `SET_GEO` action with that value (or `null` to clear). Component-local state
 * tracks the pending geolocation request and any error message; the result is
 * lifted to the reducer immediately on success.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SelectableItem } from '@/components/form/SearchableSelect.client';
import { SearchableSelect } from '@/components/form/SearchableSelect.client';
import { pointOfInterestApi } from '@/lib/api/endpoints';
import type { SupportedLocale } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { resolveI18nText } from '@/lib/resolve-i18n-text';
import type { GeoRadiusFilterConfig, GeoRadiusState } from './filter.types';
import styles from './GeoRadiusFilter.module.css';

const DEFAULT_RADIUS_PRESETS = [5, 10, 25, 50, 100] as const;

/** Number of results fetched per POI autocomplete request (featured-only or `q`-matched). */
const POI_AUTOCOMPLETE_PAGE_SIZE = 20;

interface GeoRadiusFilterProps {
    readonly config: GeoRadiusFilterConfig;
    readonly value: GeoRadiusState | undefined;
    readonly onChange: (next: GeoRadiusState | null) => void;
    readonly locale: SupportedLocale;
}

type BrowserStatus = 'idle' | 'pending' | 'error';
type GeoMode = 'browser' | 'destination' | 'poi';

/**
 * Resolves a `PointOfInterestPublic`-shaped API item to a `SearchableSelect`
 * option, applying the same i18n-by-`nameI18n` resolution the rest of the web
 * app uses for POIs since HOS-138 (falls back to `slug` when every locale is
 * empty — a POI is always at least slug-identifiable).
 */
function toPoiSelectableItem(
    poi: {
        readonly id: string;
        readonly slug: string;
        readonly nameI18n?: unknown;
        readonly isFeatured?: boolean;
    },
    locale: SupportedLocale
): SelectableItem {
    return {
        id: poi.id,
        label: resolveI18nText(poi.nameI18n as never, locale) || poi.slug,
        featured: Boolean(poi.isFeatured)
    };
}

/**
 * Composite geo filter. Renders a mode picker (browser vs destination vs POI),
 * the mode-specific control, and a row of radius preset chips that re-applies
 * the same center with the new radius. Clearing happens through the
 * FilterSidebar group reset button — there is no explicit "X" inside the
 * component.
 */
export function GeoRadiusFilter({ config, value, onChange, locale }: GeoRadiusFilterProps) {
    const presets = config.radiusPresets ?? DEFAULT_RADIUS_PRESETS;
    const initialMode = value?.mode ?? 'destination';
    const [mode, setMode] = useState<GeoMode>(initialMode);
    const [browserStatus, setBrowserStatus] = useState<BrowserStatus>('idle');
    const [destSelection, setDestSelection] = useState<string>(value?.destId ?? '');
    // HOS-142 G-6: the currently selected POI, resolved to a display label.
    // Unlike `destSelection` (matched against the fully-loaded
    // `destinationOptions` array), the POI picker never holds the full
    // 914-row catalog in memory — the label has to be fetched, either as
    // part of picking it from the autocomplete (immediate) or resolved once
    // on mount when hydrating a `?poiId=`/`?poiSlug=` URL param (see effect
    // below).
    const [poiItem, setPoiItem] = useState<SelectableItem | null>(null);

    const activeRadius = value?.radius ?? presets[0] ?? 25;
    const poiModeEnabled = Boolean(config.poiModeLabel);

    function applyDestination(destId: string, radius: number) {
        const dest = config.destinationOptions.find((opt) => opt.value === destId);
        if (!dest) return;
        onChange({
            mode: 'destination',
            lat: dest.lat,
            long: dest.long,
            radius,
            destId: dest.value
        });
    }

    // Resolve the display label for an already-selected POI (from a
    // `?poiId=`/`?poiSlug=` URL param hydrated by `initStateFromParams`) that
    // this component instance hasn't fetched yet. Skips re-fetching once
    // `poiItem` already matches the current selection (e.g. after the user
    // just picked it from the dropdown — `handlePoiSelect` already set it).
    useEffect(() => {
        if (value?.mode !== 'poi') return;
        if (!value.poiId && !value.poiSlug) return;
        if (poiItem && (poiItem.id === value.poiId || !value.poiId)) return;

        let cancelled = false;
        async function resolveSelectedPoi() {
            const result = value?.poiId
                ? await pointOfInterestApi.getById({ id: value.poiId })
                : await pointOfInterestApi.getBySlug({ slug: value?.poiSlug as string });
            if (cancelled) return;
            if (!result.ok || !result.data) {
                webLogger.warn('GeoRadiusFilter: failed to resolve selected POI label', {
                    poiId: value?.poiId,
                    poiSlug: value?.poiSlug,
                    error: result.ok ? undefined : result.error.message
                });
                return;
            }
            setPoiItem(toPoiSelectableItem(result.data, locale));
        }
        void resolveSelectedPoi();
        return () => {
            cancelled = true;
        };
        // `poiItem` IS a real dependency (read inside the effect body via the
        // early-return guard above) — the guard itself is what prevents the
        // re-run-after-`setPoiItem` from re-fetching: once `poiItem.id`
        // matches `value.poiId`, the effect exits on its next run before
        // reaching the fetch.
    }, [value?.mode, value?.poiId, value?.poiSlug, locale, poiItem]);

    /**
     * Fetches POI autocomplete options. Empty query -> the featured/
     * high-priority subset (OQ-1: "shown first when nothing is typed").
     * Non-empty query -> a full-catalog `q` text search, still sorted by
     * `displayWeight` desc so featured/high-priority POIs rank first among
     * the matches too. Reuses the existing public list endpoint contract
     * (NG-3) — no new API surface.
     */
    const loadPoiItems = useCallback(
        async (query: string): Promise<ReadonlyArray<SelectableItem>> => {
            const trimmed = query.trim();
            const result = await pointOfInterestApi.list({
                q: trimmed || undefined,
                isFeatured: trimmed ? undefined : true,
                pageSize: POI_AUTOCOMPLETE_PAGE_SIZE,
                sortBy: 'displayWeight',
                sortOrder: 'desc'
            });
            if (!result.ok) {
                webLogger.warn('GeoRadiusFilter: POI autocomplete search failed', {
                    error: result.error.message
                });
                return [];
            }
            return result.data.items.map((poi) => toPoiSelectableItem(poi, locale));
        },
        [locale]
    );

    const handlePoiSelect = useCallback(
        (item: SelectableItem | null) => {
            if (!item) {
                setPoiItem(null);
                onChange(null);
                return;
            }
            setPoiItem(item);
            onChange({ mode: 'poi', poiId: item.id, radius: activeRadius });
        },
        [onChange, activeRadius]
    );

    function handleBrowserRequest(radius: number) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setBrowserStatus('error');
            return;
        }
        setBrowserStatus('pending');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setBrowserStatus('idle');
                onChange({
                    mode: 'browser',
                    lat: pos.coords.latitude,
                    long: pos.coords.longitude,
                    radius
                });
            },
            () => {
                setBrowserStatus('error');
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
        );
    }

    function handlePresetClick(radius: number) {
        if (mode === 'destination') {
            if (destSelection) applyDestination(destSelection, radius);
            return;
        }
        if (mode === 'poi') {
            // Re-apply the same selected POI with the new radius; a no-op
            // (radius has nothing to attach to) when no POI is selected yet.
            if (value?.mode === 'poi' && (value.poiId || value.poiSlug)) {
                onChange({ ...value, radius });
            }
            return;
        }
        // Browser mode: reuse the captured coords when available, otherwise
        // prompt again with the new radius baked in.
        if (value?.mode === 'browser') {
            onChange({ ...value, radius });
            return;
        }
        handleBrowserRequest(radius);
    }

    function handleModeChange(nextMode: GeoMode) {
        setMode(nextMode);
        if (nextMode === 'destination') {
            setBrowserStatus('idle');
            if (destSelection) applyDestination(destSelection, activeRadius);
        } else if (nextMode === 'poi') {
            // Switching INTO poi mode keeps a previously selected POI (e.g.
            // the user bounced to 'destination' and back); otherwise there is
            // nothing to re-apply until the user picks one from the
            // autocomplete.
            if (value?.mode === 'poi' && (value.poiId || value.poiSlug)) {
                onChange({ ...value, radius: activeRadius });
            } else if (value?.mode !== 'poi') {
                onChange(null);
            }
        } else {
            // Switching INTO browser mode does not auto-prompt — the user has
            // to click the CTA so the browser permission UI lands in response
            // to a user gesture (Firefox + iOS Safari requirement).
            if (value?.mode !== 'browser') onChange(null);
        }
    }

    function handleDestChange(nextDestId: string) {
        setDestSelection(nextDestId);
        if (!nextDestId) {
            onChange(null);
            return;
        }
        applyDestination(nextDestId, activeRadius);
    }

    const browserActive = mode === 'browser' && value?.mode === 'browser';
    const browserButtonLabel =
        browserStatus === 'pending'
            ? config.browserPendingLabel
            : browserActive
              ? config.browserCtaLabel
              : config.browserCtaLabel;

    return (
        <div className={styles.root}>
            <fieldset className={styles.modeFieldset}>
                <legend className={styles.visuallyHidden}>{config.label}</legend>
                <label className={styles.modeOption}>
                    <input
                        type="radio"
                        name={`${config.id}_mode`}
                        value="destination"
                        checked={mode === 'destination'}
                        onChange={() => handleModeChange('destination')}
                    />
                    <span>{config.destinationModeLabel}</span>
                </label>
                <label className={styles.modeOption}>
                    <input
                        type="radio"
                        name={`${config.id}_mode`}
                        value="browser"
                        checked={mode === 'browser'}
                        onChange={() => handleModeChange('browser')}
                    />
                    <span>{config.browserModeLabel}</span>
                </label>
                {poiModeEnabled && (
                    <label className={styles.modeOption}>
                        <input
                            type="radio"
                            name={`${config.id}_mode`}
                            value="poi"
                            checked={mode === 'poi'}
                            onChange={() => handleModeChange('poi')}
                        />
                        <span>{config.poiModeLabel}</span>
                    </label>
                )}
            </fieldset>

            {mode === 'destination' && (
                <select
                    className={styles.destSelect}
                    value={destSelection}
                    onChange={(e) => handleDestChange(e.target.value)}
                    aria-label={config.destinationModeLabel}
                >
                    <option value="">{config.destinationPlaceholder}</option>
                    {config.destinationOptions.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                        >
                            {opt.featured ? `★ ${opt.label}` : opt.label}
                        </option>
                    ))}
                </select>
            )}

            {mode === 'poi' && poiModeEnabled && (
                <div className={styles.poiPicker}>
                    <SearchableSelect
                        locale={locale}
                        value={poiItem}
                        onChange={handlePoiSelect}
                        loadItems={loadPoiItems}
                        minQueryLength={0}
                        placeholder={config.poiPlaceholder}
                        loadingLabel={config.poiSearchingLabel}
                        emptyLabel={config.poiNoResultsLabel}
                        testId={`${config.id}-poi-picker`}
                    />
                </div>
            )}

            {mode === 'browser' && (
                <div className={styles.browserBlock}>
                    <button
                        type="button"
                        className={styles.browserCta}
                        onClick={() => handleBrowserRequest(activeRadius)}
                        disabled={browserStatus === 'pending'}
                        aria-busy={browserStatus === 'pending'}
                    >
                        {browserButtonLabel}
                    </button>
                    {browserStatus === 'error' && (
                        <p
                            className={styles.browserError}
                            role="alert"
                        >
                            {config.browserErrorLabel}
                        </p>
                    )}
                </div>
            )}

            {/* biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the radius preset toggle buttons; a real <fieldset> would inherit user-agent border/padding/margin that fight this row layout */}
            <div
                className={styles.presetRow}
                role="group"
                aria-label={config.label}
            >
                {presets.map((radius) => {
                    const isActive = value?.radius === radius;
                    return (
                        <button
                            key={radius}
                            type="button"
                            aria-pressed={isActive}
                            className={`${styles.presetChip} ${
                                isActive ? styles.presetChipActive : ''
                            }`}
                            onClick={() => handlePresetClick(radius)}
                        >
                            {radius}
                            {config.radiusUnitLabel}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

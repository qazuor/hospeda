/**
 * @file GeoRadiusFilter.tsx
 * @description Composite location filter that lets the user center their search
 * either on their device location (browser geolocation API) or on a
 * caller-provided destination, plus a radius preset row. Emits a single
 * `GeoRadiusState` value through `onChange`; the FilterSidebar dispatches a
 * `SET_GEO` action with that value (or `null` to clear). Component-local state
 * tracks the pending geolocation request and any error message; the result is
 * lifted to the reducer immediately on success.
 */

import type { SupportedLocale as _SupportedLocale } from '@/lib/i18n';
import { useState } from 'react';
import styles from './GeoRadiusFilter.module.css';
import type { GeoRadiusFilterConfig, GeoRadiusState } from './filter.types';

const DEFAULT_RADIUS_PRESETS = [5, 10, 25, 50, 100] as const;

interface GeoRadiusFilterProps {
    readonly config: GeoRadiusFilterConfig;
    readonly value: GeoRadiusState | undefined;
    readonly onChange: (next: GeoRadiusState | null) => void;
    readonly locale: _SupportedLocale;
}

type BrowserStatus = 'idle' | 'pending' | 'error';

/**
 * Composite geo filter. Renders a mode picker (browser vs destination), the
 * mode-specific control, and a row of radius preset chips that re-applies the
 * same center with the new radius. Clearing happens through the FilterSidebar
 * group reset button — there is no explicit "X" inside the component.
 */
export function GeoRadiusFilter({
    config,
    value,
    onChange,
    locale: _locale
}: GeoRadiusFilterProps) {
    const presets = config.radiusPresets ?? DEFAULT_RADIUS_PRESETS;
    const initialMode = value?.mode ?? 'destination';
    const [mode, setMode] = useState<'browser' | 'destination'>(initialMode);
    const [browserStatus, setBrowserStatus] = useState<BrowserStatus>('idle');
    const [destSelection, setDestSelection] = useState<string>(value?.destId ?? '');

    const activeRadius = value?.radius ?? presets[0] ?? 25;

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
        // Browser mode: reuse the captured coords when available, otherwise
        // prompt again with the new radius baked in.
        if (value?.mode === 'browser') {
            onChange({ ...value, radius });
            return;
        }
        handleBrowserRequest(radius);
    }

    function handleModeChange(nextMode: 'browser' | 'destination') {
        setMode(nextMode);
        if (nextMode === 'destination') {
            setBrowserStatus('idle');
            if (destSelection) applyDestination(destSelection, activeRadius);
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

            <div
                className={styles.presetRow}
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

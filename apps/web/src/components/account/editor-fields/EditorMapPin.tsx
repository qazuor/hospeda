/**
 * EditorMapPin — the map pin both listing editors use to place a point
 * (HOS-2496, spec HOS-2415 §6.8).
 *
 * - Reuses the accommodation editor's Leaflet map (`LocationPickerMap`), lazy
 *   loaded, so no new map dependency and no extra bundle on pages without it.
 * - Dragging the pin, or tapping the map, writes both coordinates at once.
 * - On a touch screen the map starts behind an activation overlay
 *   («Tocá para mover el pin»): a page scroll that crosses the map must not
 *   pan it or move the pin by accident. A mouse never sees the overlay.
 * - The raw latitude and longitude stay editable under a «Coordenadas»
 *   disclosure, for an owner who already has them, and as the keyboard path.
 *
 * Values are the editor's own strings; an empty pair means «no pin».
 *
 * @module components/account/editor-fields/EditorMapPin
 */

import { lazy, Suspense, useState } from 'react';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import fieldStyles from './EditorFields.module.css';
import styles from './EditorMapPin.module.css';

const LocationPickerMap = lazy(() =>
    import('@/components/host/editor/LocationPickerMap.client').then((mod) => ({
        default: mod.LocationPickerMap
    }))
);

/** Where the map opens when no pin is placed yet: Concepción del Uruguay. */
export const EDITOR_MAP_DEFAULT_CENTER = { lat: -32.4825, lng: -58.2372 } as const;

/** Decimals kept from a dragged pin (about 1 m). */
const PIN_DECIMALS = 6;

/** One coordinate input as the engine hands it over. */
export interface MapPinCoordinate {
    /** Zod key of the field, used for the DOM id. */
    readonly name: string;
    readonly value: string;
    readonly error?: string;
}

/** Props of {@link EditorMapPin}. */
export interface EditorMapPinProps {
    readonly locale: SupportedLocale;
    /** Field id prefix of the editor (`ce`, `acc`). */
    readonly idPrefix: string;
    readonly lat: MapPinCoordinate;
    readonly long: MapPinCoordinate;
    /** Receives both coordinates together, as strings. */
    readonly onChange: (next: { readonly lat: string; readonly long: string }) => void;
    /** Accessible name of the map, e.g. «Mapa del punto de encuentro». */
    readonly mapLabel: string;
    /** Locks the pin and the inputs (a plan that does not grant the map). */
    readonly disabled?: boolean;
}

/**
 * Parses a coordinate string; empty or invalid reads as `null`.
 *
 * @param params - The raw `value`.
 * @returns The number, or `null`.
 */
export function parseMapCoordinate({ value }: { readonly value: string }): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The shared map pin with its coordinates disclosure.
 *
 * @param props - See {@link EditorMapPinProps}.
 * @returns The map block.
 */
export function EditorMapPin({
    locale,
    idPrefix,
    lat,
    long,
    onChange,
    mapLabel,
    disabled = false
}: EditorMapPinProps) {
    const t = createT(locale);
    const [active, setActive] = useState(false);
    const latNumber = parseMapCoordinate({ value: lat.value });
    const longNumber = parseMapCoordinate({ value: long.value });
    const pin =
        latNumber !== null && longNumber !== null ? { lat: latNumber, lng: longNumber } : null;
    const hasCoordinateError = Boolean(lat.error || long.error);

    return (
        <div className={styles.root}>
            <div className={styles.mapFrame}>
                <Suspense
                    fallback={
                        <p className={styles.loading}>
                            {t('account.editorFields.location.mapLoading')}
                        </p>
                    }
                >
                    <LocationPickerMap
                        center={pin ?? EDITOR_MAP_DEFAULT_CENTER}
                        markerPosition={pin}
                        disabled={disabled}
                        ariaLabel={mapLabel}
                        onMove={(nextLat, nextLng) =>
                            onChange({
                                lat: nextLat.toFixed(PIN_DECIMALS),
                                long: nextLng.toFixed(PIN_DECIMALS)
                            })
                        }
                    />
                </Suspense>
                {active || disabled ? null : (
                    <button
                        type="button"
                        className={styles.touchOverlay}
                        onClick={() => setActive(true)}
                    >
                        <span className={styles.overlayLabel}>
                            {t('account.editorFields.location.touchToActivate')}
                        </span>
                    </button>
                )}
            </div>
            <p className={styles.hint}>
                {pin
                    ? t('account.editorFields.location.pinHint')
                    : t('account.editorFields.location.noPinHint')}
            </p>
            <details
                className={styles.coordinates}
                open={hasCoordinateError || undefined}
            >
                <summary className={styles.summary}>
                    {t('account.editorFields.location.coordinates')}
                </summary>
                <div className={fieldStyles.grid}>
                    <Field
                        locale={locale}
                        label={t('account.editorFields.location.latitude')}
                        id={buildFieldId({ prefix: idPrefix, name: lat.name })}
                        error={lat.error}
                        optional
                    >
                        <TextInput
                            type="text"
                            inputMode="decimal"
                            disabled={disabled}
                            value={lat.value}
                            onChange={(event) =>
                                onChange({ lat: event.target.value, long: long.value })
                            }
                        />
                    </Field>
                    <Field
                        locale={locale}
                        label={t('account.editorFields.location.longitude')}
                        id={buildFieldId({ prefix: idPrefix, name: long.name })}
                        error={long.error}
                        optional
                    >
                        <TextInput
                            type="text"
                            inputMode="decimal"
                            disabled={disabled}
                            value={long.value}
                            onChange={(event) =>
                                onChange({ lat: lat.value, long: event.target.value })
                            }
                        />
                    </Field>
                </div>
            </details>
        </div>
    );
}

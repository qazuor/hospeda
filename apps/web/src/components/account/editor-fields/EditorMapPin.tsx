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
 * Values are the editor's own strings; an empty pair means «no pin». An
 * editor that stores numbers (accommodation, meeting point) parses what it
 * receives, so each input keeps its own draft text: a half-typed «-» or «-32.»
 * would otherwise parse back to an empty box or «-32» and the owner could not
 * finish typing it.
 *
 * @module components/account/editor-fields/EditorMapPin
 */

import { lazy, type Ref, Suspense, useState } from 'react';
import { Disclosure } from '@/components/account/ui/Disclosure';
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
    /**
     * The map frame, so the section's «no pin» notice can scroll to it and
     * focus it ({@link focusEditorMap}).
     */
    readonly frameRef?: Ref<HTMLDivElement>;
}

/** Props of the internal {@link CoordinateInput}. */
interface CoordinateInputProps {
    readonly locale: SupportedLocale;
    readonly label: string;
    readonly id: string;
    readonly error?: string;
    readonly value: string;
    readonly disabled: boolean;
    readonly onChange: (value: string) => void;
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
 * Scrolls the map frame into view and focuses what places the pin there: the
 * touch activation overlay when it covers the map, else the Leaflet map itself,
 * else the frame.
 *
 * @param params - The map `frame` (null while not mounted: then nothing happens).
 * @returns Nothing.
 */
export function focusEditorMap({ frame }: { readonly frame: HTMLElement | null }): void {
    if (!frame) return;
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target =
        frame.querySelector<HTMLElement>('button') ??
        frame.querySelector<HTMLElement>('.leaflet-container') ??
        frame;
    target.focus({ preventScroll: true });
}

/**
 * One coordinate input with its own draft text.
 *
 * The draft follows the incoming value only when the two stop meaning the same
 * number (a dragged pin, a discard), never while the owner is mid-typing.
 *
 * @param props - See {@link CoordinateInputProps}.
 * @returns A kit `Field` with a decimal text input.
 */
function CoordinateInput({
    locale,
    label,
    id,
    error,
    value,
    disabled,
    onChange
}: CoordinateInputProps) {
    const [draft, setDraft] = useState(value);
    const [seen, setSeen] = useState(value);
    if (value !== seen) {
        setSeen(value);
        if (parseMapCoordinate({ value }) !== parseMapCoordinate({ value: draft })) {
            setDraft(value);
        }
    }

    return (
        <Field
            locale={locale}
            label={label}
            id={id}
            error={error}
            optional
        >
            <TextInput
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={draft}
                onChange={(event) => {
                    setDraft(event.target.value);
                    onChange(event.target.value);
                }}
            />
        </Field>
    );
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
    disabled = false,
    frameRef
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
            <div
                ref={frameRef}
                className={styles.mapFrame}
                tabIndex={-1}
                data-editor-map-frame=""
            >
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
            {/* Without a pin the section's top notice says it (owner decision 12). */}
            {pin ? (
                <p className={styles.hint}>{t('account.editorFields.location.pinHint')}</p>
            ) : null}
            <Disclosure
                defaultOpen={hasCoordinateError}
                summary={
                    pin
                        ? `${t('account.editorFields.location.coordinates')}: ${pin.lat.toFixed(PIN_DECIMALS)}, ${pin.lng.toFixed(PIN_DECIMALS)}`
                        : t('account.editorFields.location.enterCoordinates')
                }
            >
                <div className={fieldStyles.grid}>
                    <CoordinateInput
                        locale={locale}
                        label={t('account.editorFields.location.latitude')}
                        id={buildFieldId({ prefix: idPrefix, name: lat.name })}
                        error={lat.error}
                        value={lat.value}
                        disabled={disabled}
                        onChange={(next) => onChange({ lat: next, long: long.value })}
                    />
                    <CoordinateInput
                        locale={locale}
                        label={t('account.editorFields.location.longitude')}
                        id={buildFieldId({ prefix: idPrefix, name: long.name })}
                        error={long.error}
                        value={long.value}
                        disabled={disabled}
                        onChange={(next) => onChange({ lat: lat.value, long: next })}
                    />
                </div>
            </Disclosure>
        </div>
    );
}

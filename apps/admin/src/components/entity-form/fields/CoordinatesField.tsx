import { FieldWrapper } from '@/components/entity-form/components/FieldWrapper';
import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    CoordinatesFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Input, Label } from '@/components/ui-wrapped';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { DownloadIcon, InfoIcon, LoaderIcon, SearchIcon } from '@repo/icons';
import { clientOnly } from '@tanstack/react-start';
import * as React from 'react';
import { geocodeForward, geocodeReverse } from './nominatim-geocoding';

/**
 * The Leaflet view lives in its own module and is loaded via `clientOnly` +
 * `React.lazy` so (a) the `leaflet` runtime never reaches the SSR bundle and
 * (b) the "Map container is already initialized" race observed with
 * react-leaflet 4.x + React 19 StrictMode is sidestepped.
 *
 * Why `clientOnly` and not just `React.lazy`: the TanStack-Start babel
 * compiler strips the inner `import('./CoordinatesMapView')` from the server
 * build entirely (replaced with a throwing arrow function). `React.lazy`
 * alone still leaves the dynamic-import statement in the SSR bundle, which
 * Vite/Nitro resolves eagerly and inlines the leaflet chunk into the server
 * output — causing `ReferenceError: window is not defined` at runtime.
 * The lazy chunk resolves once per field instance on the client; the
 * `isMounted` guard below keeps the component from rendering on the server,
 * which is what the throwing function would otherwise reject.
 */
const LazyCoordinatesMapView = React.lazy(
    clientOnly(() =>
        import('./CoordinatesMapView').then((mod) => ({ default: mod.CoordinatesMapView }))
    )
);

/**
 * Coordinate value shape — mirrors `@repo/schemas#CoordinatesSchema`.
 * Strings (not numbers) so the value round-trips cleanly through the
 * JSONB column the API persists.
 */
export interface CoordinatesValue {
    lat: string;
    long: string;
}

export interface CoordinatesFieldProps {
    /** Field configuration. */
    config: FieldConfig;
    /** Current field value — `{ lat, long }` or undefined when empty. */
    value?: CoordinatesValue;
    /** Change handler — receives the new coordinate pair or `null` to clear. */
    onChange?: (value: CoordinatesValue | null) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    hasError?: boolean;
    errorMessage?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
}

const DEFAULT_FALLBACK_CENTER = { lat: -32.4825, lng: -58.2372 } as const; // Concepción del Uruguay
const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_ZOOM = 15;
const DEFAULT_FALLBACK_ZOOM = 12;

/**
 * Parses a `string` lat/long into a finite number, or `null` when the value
 * is missing or unparseable. Strings come from the form state directly.
 */
function parseCoord(input: string | undefined): number | null {
    if (input === undefined || input === '') return null;
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
}

/** Formats a number coordinate as a six-decimal string for storage. */
function formatCoord(n: number): string {
    return n.toFixed(6);
}

function isLatValid(lat: number): boolean {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

/**
 * Reads a string-valued sibling field from the form state, honouring both
 * the flat literal key seeded by `prepareFormValues` and the nested path
 * TanStack Form writes to (mirrors `EntityFormSection.readValue`).
 */
function readNestedString(
    values: Record<string, unknown>,
    id: string | undefined
): string | undefined {
    if (!id) return undefined;
    if (!id.includes('.')) {
        const flat = values[id];
        return typeof flat === 'string' && flat.length > 0 ? flat : undefined;
    }
    const parts = id.split('.');
    let current: unknown = values;
    for (const part of parts) {
        if (current === null || current === undefined) {
            current = undefined;
            break;
        }
        current = (current as Record<string, unknown>)[part];
    }
    if (typeof current === 'string' && current.length > 0) return current;
    const flat = values[id];
    return typeof flat === 'string' && flat.length > 0 ? flat : undefined;
}

function isLngValid(lng: number): boolean {
    return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * CoordinatesField — Leaflet-backed coordinate picker.
 *
 * Renders inline lat/long inputs plus a Leaflet map (OSM tiles, same stack as
 * apps/web) with a draggable marker. Clicking anywhere on the map drops /
 * moves the pin. The lat/long inputs stay editable as a manual fallback.
 *
 * Spec §4.6: the field stores `{ lat: string, long: string }` to align with
 * the JSONB column schema; numeric arithmetic happens internally.
 *
 * Geocoding (forward: address → coords, reverse: coords → address) is OUT
 * OF SCOPE for this phase — that lands in a follow-up with the Nominatim
 * integration.
 */
export function CoordinatesField({
    config,
    value,
    onChange,
    onBlur,
    onFocus,
    hasError = false,
    errorMessage,
    disabled = false,
    required = false,
    className
}: CoordinatesFieldProps) {
    const { t } = useTranslations();

    const typeConfig =
        config.type === FieldTypeEnum.COORDINATES
            ? (config.typeConfig as CoordinatesFieldConfig | undefined)
            : undefined;

    const fallbackCenter = typeConfig?.fallbackCenter ?? DEFAULT_FALLBACK_CENTER;
    const tileUrl = typeConfig?.tileUrl ?? DEFAULT_TILE_URL;
    const tileAttribution = typeConfig?.tileAttribution ?? DEFAULT_TILE_ATTRIBUTION;
    const zoomFilled = typeConfig?.defaultZoom ?? DEFAULT_ZOOM;
    const zoomEmpty = typeConfig?.fallbackZoom ?? DEFAULT_FALLBACK_ZOOM;

    const fieldId = `field-${config.id}`;
    const latId = `${fieldId}-lat`;
    const lngId = `${fieldId}-long`;

    const latNum = parseCoord(value?.lat);
    const lngNum = parseCoord(value?.long);
    const hasValidValue = latNum !== null && lngNum !== null;

    const handleLatChange = (raw: string) => {
        onChange?.({ lat: raw, long: value?.long ?? '' });
    };
    const handleLngChange = (raw: string) => {
        onChange?.({ lat: value?.lat ?? '', long: raw });
    };
    const handleMapMove = React.useCallback(
        (lat: number, lng: number) => {
            if (!isLatValid(lat) || !isLngValid(lng)) return;
            onChange?.({ lat: formatCoord(lat), long: formatCoord(lng) });
        },
        [onChange]
    );
    const handleClear = () => {
        onChange?.(null);
    };

    // ------------------------------------------------------------------
    // Geocoding (Nominatim)
    // ------------------------------------------------------------------
    const formContext = useEntityFormContext();
    const addressFields = typeConfig?.addressFields;
    const hasAddressWiring = Boolean(
        addressFields?.street || addressFields?.number || addressFields?.cityContext
    );

    const streetValue = readNestedString(formContext.values, addressFields?.street);
    const numberValue = readNestedString(formContext.values, addressFields?.number);
    const cityValue = readNestedString(formContext.values, addressFields?.cityContext);
    const geocodeReady = Boolean(streetValue || cityValue);
    const geocodeTooltip = [
        streetValue ? (numberValue ? `${streetValue} ${numberValue}` : streetValue) : undefined,
        cityValue
    ]
        .filter(Boolean)
        .join(', ');

    const [geocoding, setGeocoding] = React.useState<null | 'forward' | 'reverse'>(null);
    const [geocodeMessage, setGeocodeMessage] = React.useState<{
        kind: 'info' | 'error';
        text: string;
    } | null>(null);
    const abortRef = React.useRef<AbortController | null>(null);

    React.useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const runForwardGeocode = React.useCallback(async () => {
        if (!geocodeReady) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setGeocoding('forward');
        setGeocodeMessage(null);
        try {
            // Structured search disambiguates much better than `q=...` because
            // Nominatim's free-text matcher happily treats a city name like
            // "Concepción del Uruguay" as a street if it finds one anywhere
            // in the country.
            const result = await geocodeForward({
                street: streetValue,
                number: numberValue,
                city: cityValue,
                country: 'Argentina',
                countryCodes: typeConfig?.geocodingCountryCodes ?? ['ar'],
                signal: controller.signal
            });
            if (controller.signal.aborted) return;
            if (!result) {
                setGeocodeMessage({
                    kind: 'error',
                    text: t('admin-entities.fields.coordinates.geocodingForwardNotFound')
                });
                return;
            }
            onChange?.({ lat: formatCoord(result.lat), long: formatCoord(result.lng) });
            // If the user supplied a number but OSM had no exact match for it
            // on that road, Nominatim falls back to the street centreline and
            // drops the housenumber from the result. Flag that so the user
            // knows to drag the pin to the actual address.
            const numberRequested = !!numberValue?.trim();
            const numberMatched = !!result.matchedHouseNumber;
            if (numberRequested && !numberMatched) {
                setGeocodeMessage({
                    kind: 'info',
                    text: t('admin-entities.fields.coordinates.geocodingForwardStreetOnly', {
                        address: result.displayName
                    })
                });
            } else {
                setGeocodeMessage({
                    kind: 'info',
                    text: t('admin-entities.fields.coordinates.geocodingForwardFound', {
                        address: result.displayName
                    })
                });
            }
        } catch (err) {
            if (controller.signal.aborted) return;
            setGeocodeMessage({
                kind: 'error',
                text:
                    err instanceof Error
                        ? err.message
                        : t('admin-entities.fields.coordinates.geocodingNetworkError')
            });
        } finally {
            if (!controller.signal.aborted) setGeocoding(null);
        }
    }, [
        geocodeReady,
        streetValue,
        numberValue,
        cityValue,
        onChange,
        t,
        typeConfig?.geocodingCountryCodes
    ]);

    // ------------------------------------------------------------------
    // Reverse geocode flow: query → preview dialog → confirm-apply.
    // The user explicitly confirms what (if anything) we'll write back into
    // the sibling fields instead of trusting an automatic fill.
    // ------------------------------------------------------------------
    interface ReverseUpdate {
        readonly fieldId: string;
        readonly labelKey: 'streetLabel' | 'numberLabel';
        readonly value: string;
    }
    interface ReversePreview {
        readonly displayName: string;
        readonly updates: ReverseUpdate[];
    }
    const [reversePreview, setReversePreview] = React.useState<ReversePreview | null>(null);

    const runReverseGeocode = React.useCallback(async () => {
        if (latNum === null || lngNum === null) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setGeocoding('reverse');
        setGeocodeMessage(null);
        try {
            const result = await geocodeReverse(latNum, lngNum, {
                signal: controller.signal
            });
            if (controller.signal.aborted) return;
            if (!result) {
                setGeocodeMessage({
                    kind: 'error',
                    text: t('admin-entities.fields.coordinates.geocodingReverseNotFound')
                });
                return;
            }
            // Compute the would-be updates without applying. The confirm
            // dialog (rendered below) lists them and an explicit confirm
            // commits them — overwriting whatever the user had typed (the
            // operator asked for "load address" UX, not a merge).
            //
            // When the reverse result lacks a field (e.g. Nominatim has no
            // house number on that point), we still queue an empty-string
            // update so a stale value the user typed for a different
            // location gets cleared.
            const updates: ReverseUpdate[] = [];
            if (addressFields?.street) {
                const resolved = result.street ?? '';
                if (resolved !== (streetValue ?? '')) {
                    updates.push({
                        fieldId: addressFields.street,
                        labelKey: 'streetLabel',
                        value: resolved
                    });
                }
            }
            if (addressFields?.number) {
                const resolved = result.number ?? '';
                if (resolved !== (numberValue ?? '')) {
                    updates.push({
                        fieldId: addressFields.number,
                        labelKey: 'numberLabel',
                        value: resolved
                    });
                }
            }
            setReversePreview({ displayName: result.displayName, updates });
        } catch (err) {
            if (controller.signal.aborted) return;
            setGeocodeMessage({
                kind: 'error',
                text:
                    err instanceof Error
                        ? err.message
                        : t('admin-entities.fields.coordinates.geocodingNetworkError')
            });
        } finally {
            if (!controller.signal.aborted) setGeocoding(null);
        }
    }, [latNum, lngNum, addressFields?.street, addressFields?.number, streetValue, numberValue, t]);

    const applyReverseUpdates = React.useCallback(() => {
        if (!reversePreview) return;
        for (const u of reversePreview.updates) {
            formContext.setFieldValue(u.fieldId, u.value);
        }
        setGeocodeMessage({
            kind: 'info',
            text: t('admin-entities.fields.coordinates.geocodingReverseFilled', {
                address: reversePreview.displayName
            })
        });
        setReversePreview(null);
    }, [reversePreview, formContext, t]);

    const dismissReversePreview = React.useCallback(() => {
        setReversePreview(null);
    }, []);

    // SSR guard — Leaflet touches `window` during map init. Wait for client
    // mount before rendering the MapContainer; the lat/long inputs above can
    // render during SSR without issue.
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <>
            <FieldWrapper
                fieldId={fieldId}
                label={config.label}
                required={required}
                description={config.description}
                hasError={hasError}
                errorMessage={errorMessage}
                mode="edit"
                className={className}
            >
                <div
                    className={cn(
                        'overflow-hidden rounded-md border bg-background',
                        hasError && 'border-destructive',
                        disabled && 'opacity-60'
                    )}
                >
                    {/* Privacy notice — hosts often hesitate to mark the exact spot,
                    fearing the address will be visible on the public site.
                    Spell out that web only renders an approximate area so the
                    operator feels safe entering the precise point. Skipped in
                    view mode (no point reassuring the reader). */}
                    {!disabled && (
                        <div className="flex items-start gap-2 border-b bg-primary/5 px-3 py-2 text-xs">
                            <InfoIcon
                                className="mt-0.5 h-4 w-4 flex-none text-primary"
                                aria-hidden="true"
                            />
                            <p className="text-foreground leading-relaxed">
                                {t('admin-entities.fields.coordinates.privacyNotice')}
                            </p>
                        </div>
                    )}

                    {/* Inline lat/long inputs — always editable as a manual fallback */}
                    <div className="grid grid-cols-1 gap-2 border-b bg-muted/30 p-2 sm:grid-cols-2">
                        <div>
                            <Label
                                htmlFor={latId}
                                className="text-[10px] text-muted-foreground uppercase tracking-wide"
                            >
                                {t('admin-entities.fields.coordinates.latLabel')}
                            </Label>
                            <Input
                                id={latId}
                                value={value?.lat ?? ''}
                                onChange={(e) => handleLatChange(e.target.value)}
                                onBlur={onBlur}
                                onFocus={onFocus}
                                placeholder="-32.482500"
                                inputMode="decimal"
                                disabled={disabled}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div>
                            <Label
                                htmlFor={lngId}
                                className="text-[10px] text-muted-foreground uppercase tracking-wide"
                            >
                                {t('admin-entities.fields.coordinates.lngLabel')}
                            </Label>
                            <Input
                                id={lngId}
                                value={value?.long ?? ''}
                                onChange={(e) => handleLngChange(e.target.value)}
                                onBlur={onBlur}
                                onFocus={onFocus}
                                placeholder="-58.237200"
                                inputMode="decimal"
                                disabled={disabled}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>

                    {/* Leaflet map — lazy-loaded after client mount */}
                    <div className="relative h-72 w-full bg-muted sm:h-80">
                        {isMounted ? (
                            <React.Suspense
                                fallback={
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                                        {t('admin-entities.fields.coordinates.mapLoading')}
                                    </div>
                                }
                            >
                                <LazyCoordinatesMapView
                                    lat={latNum}
                                    lng={lngNum}
                                    fallbackCenter={fallbackCenter}
                                    zoomFilled={zoomFilled}
                                    zoomEmpty={zoomEmpty}
                                    tileUrl={tileUrl}
                                    tileAttribution={tileAttribution}
                                    emptyHint={t('admin-entities.fields.coordinates.emptyHint')}
                                    activationHint={t(
                                        'admin-entities.fields.coordinates.activationHint'
                                    )}
                                    disabled={disabled}
                                    onMove={handleMapMove}
                                />
                            </React.Suspense>
                        ) : (
                            <div
                                aria-hidden="true"
                                className="flex h-full w-full items-center justify-center text-muted-foreground text-xs"
                            >
                                {t('admin-entities.fields.coordinates.mapLoading')}
                            </div>
                        )}
                    </div>

                    {/* Footer actions */}
                    {!disabled && (hasValidValue || hasAddressWiring) && (
                        <div className="space-y-1.5 border-t bg-muted/30 px-2 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {hasAddressWiring && (
                                        <button
                                            type="button"
                                            onClick={runForwardGeocode}
                                            disabled={!geocodeReady || geocoding !== null}
                                            title={geocodeTooltip || undefined}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                                                'border border-input bg-background text-foreground',
                                                'hover:bg-accent hover:text-accent-foreground',
                                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                'disabled:cursor-not-allowed disabled:opacity-50'
                                            )}
                                        >
                                            {geocoding === 'forward' ? (
                                                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <SearchIcon className="h-3.5 w-3.5" />
                                            )}
                                            {t(
                                                'admin-entities.fields.coordinates.geocodingForwardLabel'
                                            )}
                                        </button>
                                    )}
                                    {hasAddressWiring && (
                                        <button
                                            type="button"
                                            onClick={runReverseGeocode}
                                            disabled={!hasValidValue || geocoding !== null}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                                                'border border-input bg-background text-foreground',
                                                'hover:bg-accent hover:text-accent-foreground',
                                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                'disabled:cursor-not-allowed disabled:opacity-50'
                                            )}
                                        >
                                            {geocoding === 'reverse' ? (
                                                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <DownloadIcon className="h-3.5 w-3.5" />
                                            )}
                                            {t(
                                                'admin-entities.fields.coordinates.geocodingReverseLabel'
                                            )}
                                        </button>
                                    )}
                                </div>

                                {hasValidValue && (
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className={cn(
                                            'rounded-md px-2 py-1 text-muted-foreground text-xs',
                                            'hover:bg-accent hover:text-accent-foreground',
                                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                        )}
                                    >
                                        {t('admin-entities.fields.coordinates.clearLabel')}
                                    </button>
                                )}
                            </div>

                            {geocodeMessage && (
                                <p
                                    role={geocodeMessage.kind === 'error' ? 'alert' : 'status'}
                                    className={cn(
                                        'text-xs',
                                        geocodeMessage.kind === 'error'
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                    )}
                                >
                                    {geocodeMessage.text}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </FieldWrapper>

            {/* Reverse-geocode confirmation dialog. Opens when `reversePreview`
            is set; closing it via cancel or backdrop dismisses without writing
            anything. The Confirm action only renders when there are actual
            updates to apply (so the "no changes" case is informational). */}
            <AlertDialog
                open={!!reversePreview}
                onOpenChange={(open) => {
                    if (!open) dismissReversePreview();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-entities.fields.coordinates.reverseDialogTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-entities.fields.coordinates.reverseDialogIntro', {
                                address: reversePreview?.displayName ?? ''
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {reversePreview && reversePreview.updates.length > 0 ? (
                        <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                            <p className="font-medium">
                                {t('admin-entities.fields.coordinates.reverseDialogChangesHeading')}
                            </p>
                            <ul className="space-y-0.5">
                                {reversePreview.updates.map((u) => (
                                    <li
                                        key={u.fieldId}
                                        className="text-foreground"
                                    >
                                        <span className="text-muted-foreground">
                                            {t(
                                                `admin-entities.fields.coordinates.reverseDialog${u.labelKey.charAt(0).toUpperCase()}${u.labelKey.slice(1)}` as never
                                            )}
                                            :
                                        </span>{' '}
                                        {u.value === '' ? (
                                            <em className="text-muted-foreground">
                                                {t(
                                                    'admin-entities.fields.coordinates.reverseDialogEmptyValue'
                                                )}
                                            </em>
                                        ) : (
                                            u.value
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-entities.fields.coordinates.reverseDialogNoChanges')}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={dismissReversePreview}>
                            {t('admin-entities.fields.coordinates.reverseDialogCancel')}
                        </AlertDialogCancel>
                        {reversePreview && reversePreview.updates.length > 0 && (
                            <AlertDialogAction onClick={applyReverseUpdates}>
                                {t('admin-entities.fields.coordinates.reverseDialogConfirm')}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

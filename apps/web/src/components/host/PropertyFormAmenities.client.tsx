/**
 * @file PropertyFormAmenities.client.tsx
 * @description Section 4 — Amenities multi-select for the property form.
 * Fetches the public amenities list from `GET /api/v1/public/amenities`,
 * renders a chip grid, and reports selected IDs via `onChange`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import styles from './PropertyForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal amenity shape returned by the public endpoint. */
interface AmenityItem {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly icon?: string;
}

/** Wrapped API list response (service-core envelope). */
interface AmenityListResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<AmenityItem>;
}

/** Props for the amenities section. */
export type PropertyFormAmenitiesProps = {
    /** Currently selected amenity IDs (controlled). */
    readonly selectedIds: ReadonlyArray<string>;
    /** Called when the user toggles an amenity chip. */
    readonly onChange: (ids: ReadonlyArray<string>) => void;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) for fetch calls. */
    readonly apiUrl: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Amenity multi-select chip grid.
 *
 * Fetches `/api/v1/public/amenities` once on mount. Renders each amenity as
 * a toggleable chip. Selected IDs are stored in the parent form via `onChange`.
 *
 * Shows a loading message while fetching and an empty-state message if the
 * API returns no results.
 *
 * @example
 * ```tsx
 * <PropertyFormAmenities
 *   selectedIds={form.values.amenityIds ?? []}
 *   onChange={(ids) => form.setValue('amenityIds', ids)}
 *   locale={locale}
 *   apiUrl={PUBLIC_API_URL}
 * />
 * ```
 */
export function PropertyFormAmenities({
    selectedIds,
    onChange,
    locale,
    apiUrl
}: PropertyFormAmenitiesProps) {
    const { t } = createTranslations(locale);

    const [amenities, setAmenities] = useState<ReadonlyArray<AmenityItem>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Fetch amenity catalog once on mount.
    useEffect(() => {
        const base = apiUrl.replace(/\/$/, '');
        let cancelled = false;

        async function fetchAmenities(): Promise<void> {
            setIsLoading(true);
            setFetchError(null);
            try {
                const response = await fetch(`${base}/api/v1/public/amenities?pageSize=100`, {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const body = (await response.json()) as AmenityListResponse;
                if (!cancelled) {
                    setAmenities(body.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setFetchError(
                        err instanceof Error ? err.message : 'Error al cargar comodidades'
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void fetchAmenities();

        return () => {
            cancelled = true;
        };
    }, [apiUrl]);

    /** Toggle a single amenity in/out of the selected set. */
    function handleToggle(id: string): void {
        const current = new Set(selectedIds);
        if (current.has(id)) {
            current.delete(id);
        } else {
            current.add(id);
        }
        onChange(Array.from(current));
    }

    if (isLoading) {
        return (
            <p
                className={styles.amenitiesLoadingText}
                aria-live="polite"
                aria-busy="true"
            >
                {t('host.form.sections.amenities.loading', 'Cargando comodidades...')}
            </p>
        );
    }

    if (fetchError) {
        return (
            <p
                className={styles.amenitiesEmpty}
                role="alert"
            >
                {fetchError}
            </p>
        );
    }

    if (amenities.length === 0) {
        return (
            <p className={styles.amenitiesEmpty}>
                {t('host.form.sections.amenities.empty', 'No hay comodidades disponibles')}
            </p>
        );
    }

    return (
        <fieldset className={styles.amenitiesGrid}>
            <legend className={styles.srOnly}>
                {t('host.form.sections.amenities.title', 'Comodidades')}
            </legend>
            {amenities.map((amenity) => {
                const isSelected = selectedIds.includes(amenity.id);
                return (
                    <button
                        key={amenity.id}
                        type="button"
                        className={`${styles.amenityChip} ${isSelected ? styles.amenityChipSelected : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => handleToggle(amenity.id)}
                    >
                        {amenity.icon && <span aria-hidden="true">{amenity.icon}</span>}
                        {amenity.name}
                    </button>
                );
            })}
        </fieldset>
    );
}

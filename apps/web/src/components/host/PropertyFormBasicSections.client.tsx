/**
 * @file PropertyFormBasicSections.client.tsx
 * @description Section renderers 1-3 (datos básicos, ubicación, capacidad)
 * for the PropertyForm wizard.
 *
 * Extracted from PropertyFormSections.client.tsx to stay under 500 lines.
 * Sections 4-8 live in PropertyFormSections.client.tsx.
 *
 * Location note: `location.city` is written to form state but is not part of
 * BaseLocationSchema (only FullLocationSchema). For MVP it may be silently
 * dropped by the API. Documented in T-010 report.
 */

import { AccommodationTypeEnum } from '@repo/schemas';
import styles from './PropertyForm.module.css';
import type { SectionContentProps } from './PropertyFormSections.client';

// ---------------------------------------------------------------------------
// Section 1 — Datos básicos
// ---------------------------------------------------------------------------

/**
 * Section 1 renderer — basic listing information.
 * Fields: name (required), summary (required), description (optional), type (required).
 */
export function Section1BasicData({
    form,
    onFieldChange,
    onBlur,
    getError,
    t
}: SectionContentProps) {
    const nameError = getError('name');
    const summaryError = getError('summary');
    const descriptionError = getError('description');
    const typeError = getError('type');

    return (
        <div className={styles.fieldGroup}>
            {/* Name */}
            <div className={styles.field}>
                <label
                    className={`${styles.label} ${styles.labelRequired}`}
                    htmlFor="field-name"
                >
                    {t('host.form.sections.datos-basicos.fields.name', 'Nombre de la propiedad')}
                </label>
                <input
                    id="field-name"
                    type="text"
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={(form.values.name as string | undefined) ?? ''}
                    placeholder={t(
                        'host.form.sections.datos-basicos.fields.namePlaceholder',
                        'Ej: Casa del Río'
                    )}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    onBlur={onBlur}
                    aria-required="true"
                    aria-describedby={nameError ? 'error-name' : undefined}
                    autoComplete="off"
                />
                {nameError && (
                    <p
                        id="error-name"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {nameError}
                    </p>
                )}
            </div>

            {/* Summary */}
            <div className={styles.field}>
                <label
                    className={`${styles.label} ${styles.labelRequired}`}
                    htmlFor="field-summary"
                >
                    {t(
                        'host.form.sections.datos-basicos.fields.shortDescription',
                        'Descripción corta'
                    )}
                </label>
                <input
                    id="field-summary"
                    type="text"
                    className={`${styles.input} ${summaryError ? styles.inputError : ''}`}
                    value={(form.values.summary as string | undefined) ?? ''}
                    placeholder={t(
                        'host.form.sections.datos-basicos.fields.shortDescriptionPlaceholder',
                        'Una línea que resuma tu propiedad'
                    )}
                    onChange={(e) => onFieldChange('summary', e.target.value)}
                    onBlur={onBlur}
                    aria-required="true"
                    aria-describedby={summaryError ? 'error-summary' : undefined}
                />
                {summaryError && (
                    <p
                        id="error-summary"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {summaryError}
                    </p>
                )}
            </div>

            {/* Description */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="field-description"
                >
                    {t(
                        'host.form.sections.datos-basicos.fields.longDescription',
                        'Descripción completa'
                    )}
                </label>
                <textarea
                    id="field-description"
                    className={`${styles.textarea} ${descriptionError ? styles.inputError : ''}`}
                    value={(form.values.description as string | undefined) ?? ''}
                    placeholder={t(
                        'host.form.sections.datos-basicos.fields.longDescriptionPlaceholder',
                        'Detallá lo que hace única tu propiedad'
                    )}
                    onChange={(e) => onFieldChange('description', e.target.value)}
                    onBlur={onBlur}
                    aria-describedby={descriptionError ? 'error-description' : undefined}
                    rows={4}
                />
                {descriptionError && (
                    <p
                        id="error-description"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {descriptionError}
                    </p>
                )}
            </div>

            {/* Type */}
            <div className={styles.field}>
                <label
                    className={`${styles.label} ${styles.labelRequired}`}
                    htmlFor="field-type"
                >
                    {t('host.form.sections.datos-basicos.fields.type', 'Tipo de propiedad')}
                </label>
                <select
                    id="field-type"
                    className={`${styles.select} ${typeError ? styles.inputError : ''}`}
                    value={(form.values.type as string | undefined) ?? ''}
                    onChange={(e) => onFieldChange('type', e.target.value)}
                    onBlur={onBlur}
                    aria-required="true"
                    aria-describedby={typeError ? 'error-type' : undefined}
                >
                    <option value="">
                        {t(
                            'host.form.sections.datos-basicos.fields.typePlaceholder',
                            'Seleccioná un tipo'
                        )}
                    </option>
                    {Object.values(AccommodationTypeEnum).map((typeValue) => (
                        <option
                            key={typeValue}
                            value={typeValue}
                        >
                            {typeValue}
                        </option>
                    ))}
                </select>
                {typeError && (
                    <p
                        id="error-type"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {typeError}
                    </p>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Section 2 — Ubicación
// ---------------------------------------------------------------------------

/**
 * Section 2 renderer — location fields.
 * Fields: country (required), state, city (may be silently dropped by API),
 * zipCode, lat/long coordinates. Leaflet not installed — plain text inputs only.
 */
export function Section2Location({ form, onFieldChange, onBlur, t }: SectionContentProps) {
    type LocationValues = {
        country?: string;
        state?: string;
        city?: string;
        zipCode?: string;
        coordinates?: { lat?: string; long?: string };
    };
    const location = (form.values.location ?? {}) as LocationValues;
    const coords = location.coordinates ?? {};

    function setLocation(field: string, value: unknown): void {
        onFieldChange(`location.${field}`, value);
    }

    function setCoord(field: 'lat' | 'long', value: string): void {
        onFieldChange(`location.coordinates.${field}`, value);
    }

    return (
        <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-country"
                    >
                        {t('host.form.sections.ubicacion.fields.country', 'País')}
                    </label>
                    <input
                        id="field-country"
                        type="text"
                        className={styles.input}
                        value={location.country ?? ''}
                        onChange={(e) => setLocation('country', e.target.value)}
                        onBlur={onBlur}
                        aria-required="true"
                    />
                </div>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="field-state"
                    >
                        {t('host.form.sections.ubicacion.fields.state', 'Provincia')}
                    </label>
                    <input
                        id="field-state"
                        type="text"
                        className={styles.input}
                        value={location.state ?? ''}
                        onChange={(e) => setLocation('state', e.target.value)}
                        onBlur={onBlur}
                    />
                </div>
            </div>

            <div className={styles.fieldRow}>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="field-city"
                    >
                        {t('host.form.sections.ubicacion.fields.city', 'Ciudad')}
                    </label>
                    <input
                        id="field-city"
                        type="text"
                        className={styles.input}
                        value={(location as { city?: string }).city ?? ''}
                        onChange={(e) => setLocation('city', e.target.value)}
                        onBlur={onBlur}
                    />
                </div>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="field-postalCode"
                    >
                        {t('host.form.sections.ubicacion.fields.postalCode', 'Código postal')}
                    </label>
                    <input
                        id="field-postalCode"
                        type="text"
                        className={styles.input}
                        value={location.zipCode ?? ''}
                        onChange={(e) => setLocation('zipCode', e.target.value)}
                        onBlur={onBlur}
                    />
                </div>
            </div>

            <div className={styles.fieldRow}>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="field-lat"
                    >
                        {t('host.form.sections.ubicacion.fields.latitude', 'Latitud')}
                    </label>
                    <input
                        id="field-lat"
                        type="text"
                        inputMode="decimal"
                        className={styles.input}
                        value={coords.lat ?? ''}
                        placeholder="Ej: -32.4825"
                        onChange={(e) => setCoord('lat', e.target.value)}
                        onBlur={onBlur}
                    />
                </div>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="field-long"
                    >
                        {t('host.form.sections.ubicacion.fields.longitude', 'Longitud')}
                    </label>
                    <input
                        id="field-long"
                        type="text"
                        inputMode="decimal"
                        className={styles.input}
                        value={coords.long ?? ''}
                        placeholder="Ej: -58.2336"
                        onChange={(e) => setCoord('long', e.target.value)}
                        onBlur={onBlur}
                    />
                </div>
            </div>

            {/* Map placeholder — Leaflet not installed */}
            <p className={styles.mapPlaceholder}>
                Mapa disponible próximamente. Ingresá lat/lng manualmente.
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Section 3 — Capacidad
// ---------------------------------------------------------------------------

/**
 * Section 3 renderer — capacity fields.
 * Required: capacity (guests), bedrooms, bathrooms. Optional: beds.
 */
export function Section3Capacity({
    form,
    onFieldChange,
    onBlur,
    getError,
    t
}: SectionContentProps) {
    type ExtraInfo = { capacity?: number; bedrooms?: number; beds?: number; bathrooms?: number };
    const extraInfo = (form.values.extraInfo ?? {}) as ExtraInfo;

    function setExtra(field: string, value: number | ''): void {
        onFieldChange(`extraInfo.${field}`, value === '' ? undefined : value);
    }

    const capacityError = getError('extraInfo.capacity');
    const bedroomsError = getError('extraInfo.bedrooms');
    const bathroomsError = getError('extraInfo.bathrooms');

    return (
        <div className={styles.fieldGroup}>
            <div className={styles.fieldRowThree}>
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-capacity"
                    >
                        {t('host.form.sections.capacidad.fields.maxGuests', 'Huéspedes máximos')}
                    </label>
                    <input
                        id="field-capacity"
                        type="number"
                        min={1}
                        className={`${styles.numberInput} ${capacityError ? styles.inputError : ''}`}
                        value={extraInfo.capacity ?? ''}
                        onChange={(e) =>
                            setExtra(
                                'capacity',
                                e.target.value === '' ? '' : Number(e.target.value)
                            )
                        }
                        onBlur={onBlur}
                        aria-required="true"
                        aria-describedby={capacityError ? 'error-capacity' : undefined}
                    />
                    {capacityError && (
                        <p
                            id="error-capacity"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {capacityError}
                        </p>
                    )}
                </div>
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-bedrooms"
                    >
                        {t('host.form.sections.capacidad.fields.bedrooms', 'Habitaciones')}
                    </label>
                    <input
                        id="field-bedrooms"
                        type="number"
                        min={0}
                        className={`${styles.numberInput} ${bedroomsError ? styles.inputError : ''}`}
                        value={extraInfo.bedrooms ?? ''}
                        onChange={(e) =>
                            setExtra(
                                'bedrooms',
                                e.target.value === '' ? '' : Number(e.target.value)
                            )
                        }
                        onBlur={onBlur}
                        aria-required="true"
                        aria-describedby={bedroomsError ? 'error-bedrooms' : undefined}
                    />
                    {bedroomsError && (
                        <p
                            id="error-bedrooms"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {bedroomsError}
                        </p>
                    )}
                </div>
                <div className={styles.field}>
                    <label
                        className={`${styles.label} ${styles.labelRequired}`}
                        htmlFor="field-bathrooms"
                    >
                        {t('host.form.sections.capacidad.fields.bathrooms', 'Baños')}
                    </label>
                    <input
                        id="field-bathrooms"
                        type="number"
                        min={0}
                        className={`${styles.numberInput} ${bathroomsError ? styles.inputError : ''}`}
                        value={extraInfo.bathrooms ?? ''}
                        onChange={(e) =>
                            setExtra(
                                'bathrooms',
                                e.target.value === '' ? '' : Number(e.target.value)
                            )
                        }
                        onBlur={onBlur}
                        aria-required="true"
                        aria-describedby={bathroomsError ? 'error-bathrooms' : undefined}
                    />
                    {bathroomsError && (
                        <p
                            id="error-bathrooms"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {bathroomsError}
                        </p>
                    )}
                </div>
            </div>

            {/* Beds (optional) */}
            <div
                className={styles.field}
                style={{ maxWidth: '180px' }}
            >
                <label
                    className={styles.label}
                    htmlFor="field-beds"
                >
                    {t('host.form.sections.capacidad.fields.beds', 'Camas')}
                </label>
                <input
                    id="field-beds"
                    type="number"
                    min={0}
                    className={styles.numberInput}
                    value={extraInfo.beds ?? ''}
                    onChange={(e) =>
                        setExtra('beds', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    onBlur={onBlur}
                />
            </div>
        </div>
    );
}

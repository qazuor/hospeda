/**
 * @file PropertyForm.client.tsx
 * @description React island for the 8-section host property creation / edit form.
 * Composes usePropertyForm + useAutosave. All 8 sections are fully implemented.
 *
 * Leaflet is NOT available in this project — location section uses plain
 * lat/lng text inputs with a note (see "Leaflet availability" in T-009 report).
 *
 * Amenities are fetched from GET /api/v1/public/amenities and stored locally
 * as `selectedAmenityIds` (separate from AccommodationCreateInput because
 * the base schema has no amenityIds field — amenities are a join-table relation).
 * On publish, `amenityIds` is included in the PATCH payload. If the API does
 * not handle this field it is silently dropped. Documented in T-010 report.
 *
 * File split to stay under 500 lines:
 *   - PropertyFormSection.client.tsx      — collapsible section wrapper
 *   - PropertyFormAmenities.client.tsx    — section 4 amenities chip grid
 *   - PropertyFormPhotos.client.tsx       — section 5 image uploader
 *   - PropertyFormPrice.client.tsx        — section 6 price fields
 *   - PropertyFormContact.client.tsx      — section 7 contact fields
 *   - PropertyFormPublish.client.tsx      — section 8 publish / draft actions
 *   - PropertyFormSections.client.tsx     — section renderers 1-8 + dispatcher
 *   - PropertyForm.client.tsx             — this file: shell, state, hooks
 */

import { useAutosave } from '@/hooks/useAutosave';
import { PROPERTY_FORM_SECTIONS, usePropertyForm } from '@/hooks/usePropertyForm';
import type { AccommodationFormData } from '@/hooks/usePropertyForm';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useState } from 'react';
import styles from './PropertyForm.module.css';
import { PropertyFormSection } from './PropertyFormSection.client';
import { SectionContent } from './PropertyFormSections.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the PropertyForm island. */
export type PropertyFormProps = {
    /**
     * Draft accommodation ID to resume. When provided, the draft-resume
     * banner is shown and the form is pre-filled with `initialData`.
     */
    readonly existingDraftId?: string;
    /**
     * Pre-fills the form when resuming a draft or editing an existing listing.
     */
    readonly initialData?: Partial<AccommodationFormData>;
    /**
     * When provided, the form is in edit mode (PATCH instead of POST on first
     * save). All saves use PATCH against this ID.
     */
    readonly accommodationId?: string;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /**
     * API base URL (PUBLIC_API_URL from env).
     * Passed to useAutosave and to section sub-components.
     */
    readonly apiUrl: string;
};

// ---------------------------------------------------------------------------
// Section title map (static — not from i18n to keep render simple)
// ---------------------------------------------------------------------------

const SECTION_TITLES: Record<string, string> = {
    'datos-basicos': 'Datos básicos',
    ubicacion: 'Ubicación',
    capacidad: 'Capacidad',
    amenities: 'Comodidades',
    fotos: 'Fotos',
    precio: 'Precio',
    contacto: 'Contacto',
    publicar: 'Publicar'
};

// ---------------------------------------------------------------------------
// AutosaveStatusBar helper
// ---------------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Renders the autosave status bar. */
function AutosaveStatusBar({
    status,
    lastSavedAt,
    t
}: {
    readonly status: SaveStatus;
    readonly lastSavedAt: Date | null;
    readonly t: (key: string, fallback?: string) => string;
}) {
    const labelMap: Record<SaveStatus, string> = {
        idle: '',
        saving: t('host.form.status.saving', 'Guardando...'),
        saved: lastSavedAt
            ? `${t('host.form.status.saved', 'Guardado')} ${lastSavedAt.toLocaleTimeString()}`
            : t('host.form.status.saved', 'Guardado'),
        error: t('host.form.status.error', 'Error al guardar')
    };

    const label = labelMap[status];
    if (!label) return null;

    return (
        <output
            className={styles.statusBar}
            data-status={status}
            aria-live="polite"
        >
            {status === 'saving' ? (
                <span
                    className={styles.statusSpinner}
                    aria-hidden="true"
                />
            ) : (
                <span
                    className={styles.statusDot}
                    aria-hidden="true"
                />
            )}
            {label}
        </output>
    );
}

// ---------------------------------------------------------------------------
// DraftBanner helper
// ---------------------------------------------------------------------------

/** Renders the draft-resume prompt banner. */
function DraftBanner({
    onResume,
    onStartNew,
    t
}: {
    readonly onResume: () => void;
    readonly onStartNew: () => void;
    readonly t: (key: string, fallback?: string) => string;
}) {
    return (
        <section
            className={styles.draftBanner}
            aria-label="Borrador pendiente"
        >
            <div className={styles.draftBannerText}>
                <p className={styles.draftBannerTitle}>
                    {t('host.form.draftPrompt.title', 'Tenés un borrador sin publicar')}
                </p>
                <p className={styles.draftBannerBody}>
                    {t('host.form.draftPrompt.body', '¿Querés continuar donde lo dejaste?')}
                </p>
            </div>
            <div className={styles.draftBannerActions}>
                <button
                    type="button"
                    className={`${styles.draftBannerBtn} ${styles.draftBannerBtnPrimary}`}
                    onClick={onResume}
                >
                    {t('host.form.draftPrompt.resume', 'Continuar borrador')}
                </button>
                <button
                    type="button"
                    className={`${styles.draftBannerBtn} ${styles.draftBannerBtnSecondary}`}
                    onClick={onStartNew}
                >
                    {t('host.form.draftPrompt.startNew', 'Empezar de cero')}
                </button>
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// PropertyForm
// ---------------------------------------------------------------------------

/**
 * PropertyForm — 8-section host property wizard.
 *
 * Composes `usePropertyForm` for form state and `useAutosave` for debounced
 * persistence. On publish: PATCHes accommodation to `lifecycleState: ACTIVE`
 * and redirects to `/alojamientos/{slug}` on success.
 *
 * @example
 * ```tsx
 * <PropertyForm
 *   locale="es"
 *   apiUrl={PUBLIC_API_URL}
 *   existingDraftId={draftId}
 *   initialData={draftData}
 * />
 * ```
 */
export function PropertyForm({
    existingDraftId,
    initialData,
    accommodationId: externalAccommodationId,
    locale,
    apiUrl
}: PropertyFormProps) {
    const { t } = createTranslations(locale);

    // ── Draft banner state ────────────────────────────────────────────────
    const [showDraftBanner, setShowDraftBanner] = useState(existingDraftId !== undefined);
    const [draftDismissed, setDraftDismissed] = useState(false);

    // ── Resolved accommodation ID (updated after first autosave POST) ─────
    const [resolvedAccommodationId, setResolvedAccommodationId] = useState<string | undefined>(
        externalAccommodationId
    );

    // ── Amenity IDs (outside AccommodationCreateInput — join-table relation) ─
    const [selectedAmenityIds, setSelectedAmenityIds] = useState<ReadonlyArray<string>>([]);

    // ── Publish error state ───────────────────────────────────────────────
    const [publishError, setPublishError] = useState<string | null>(null);

    // ── Form hook ─────────────────────────────────────────────────────────
    const { form, completedSections, isFormComplete, missingRequiredFields, handlePublish } =
        usePropertyForm({
            initialData: draftDismissed ? {} : initialData,
            onPublish: useCallback(
                async (data) => {
                    setPublishError(null);
                    const id = resolvedAccommodationId;
                    if (!id) {
                        setPublishError(
                            t(
                                'host.form.errors.saveDraftFirst',
                                'Guardá el borrador primero antes de publicar.'
                            )
                        );
                        return;
                    }

                    // Payload includes lifecycleState ACTIVE and amenityIds.
                    // amenityIds is a join-table relation not in AccommodationCreateInput.
                    // Included so the API can process it if it accepts extra fields.
                    const payload = {
                        ...data,
                        lifecycleState: 'ACTIVE' as const,
                        amenityIds: selectedAmenityIds
                    };

                    const url = `${apiUrl.replace(/\/$/, '')}/api/v1/protected/accommodations/${id}`;

                    const response = await fetch(url, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        let msg = t(
                            'host.form.errors.publishFailed',
                            'No se pudo publicar la propiedad. Intentá de nuevo.'
                        );
                        try {
                            const errBody = (await response.json()) as {
                                error?: { message?: string };
                            };
                            if (errBody.error?.message) {
                                msg = errBody.error.message;
                            }
                        } catch {
                            // ignore JSON parse errors
                        }
                        setPublishError(msg);
                        return;
                    }

                    const body = (await response.json()) as { data?: { slug?: string } };
                    const slug = body.data?.slug;

                    // Redirect on success — no toast system available yet (TODO: add @repo/notifications).
                    if (slug) {
                        window.location.href = `/alojamientos/${slug}`;
                    } else {
                        window.location.href = '/mi-cuenta/propiedades';
                    }
                },
                [resolvedAccommodationId, selectedAmenityIds, apiUrl, t]
            )
        });

    // ── Autosave hook ─────────────────────────────────────────────────────
    const { saveStatus, lastSavedAt, triggerSave } = useAutosave({
        formData: form.values,
        accommodationId: resolvedAccommodationId,
        onSaveSuccess: useCallback(({ id }: { id: string }) => {
            setResolvedAccommodationId(id);
        }, []),
        onSaveError: useCallback((_err: Error) => {
            // Error surfaced via saveStatus
        }, [])
    });

    // ── Draft banner handlers ─────────────────────────────────────────────
    function handleResumeDraft(): void {
        setShowDraftBanner(false);
    }

    function handleStartNew(): void {
        setDraftDismissed(true);
        setShowDraftBanner(false);
        form.reset({});
    }

    // ── Field helpers ─────────────────────────────────────────────────────
    function handleFieldChange(field: string, value: unknown): void {
        form.setValue(field, value);
    }

    function handleBlur(): void {
        triggerSave();
    }

    function getError(field: string): string | undefined {
        return form.errors[field];
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <form
            className={styles.form}
            aria-label={t('host.form.sections.datos-basicos.title', 'Nueva propiedad')}
            onSubmit={(e) => {
                e.preventDefault();
                void handlePublish();
            }}
            noValidate
        >
            {/* Autosave status */}
            <AutosaveStatusBar
                status={saveStatus}
                lastSavedAt={lastSavedAt}
                t={t}
            />

            {/* Draft resume banner */}
            {showDraftBanner && (
                <DraftBanner
                    onResume={handleResumeDraft}
                    onStartNew={handleStartNew}
                    t={t}
                />
            )}

            {/* Sections */}
            <div className={styles.sections}>
                {PROPERTY_FORM_SECTIONS.map((sectionKey, _index) => (
                    <PropertyFormSection
                        key={sectionKey}
                        sectionKey={sectionKey}
                        title={t(
                            `host.form.sections.${sectionKey}.title`,
                            SECTION_TITLES[sectionKey] ?? sectionKey
                        )}
                        isComplete={completedSections.has(sectionKey)}
                        defaultOpen={true}
                    >
                        <SectionContent
                            sectionKey={sectionKey}
                            form={form}
                            selectedAmenityIds={selectedAmenityIds}
                            setSelectedAmenityIds={setSelectedAmenityIds}
                            locale={locale}
                            apiUrl={apiUrl}
                            resolvedAccommodationId={resolvedAccommodationId}
                            onFieldChange={handleFieldChange}
                            onBlur={handleBlur}
                            getError={getError}
                            t={t}
                            missingRequiredFields={missingRequiredFields}
                            isFormComplete={isFormComplete}
                            publishError={publishError}
                            onSaveDraft={triggerSave}
                            onPublish={handlePublish}
                        />
                    </PropertyFormSection>
                ))}
            </div>
        </form>
    );
}

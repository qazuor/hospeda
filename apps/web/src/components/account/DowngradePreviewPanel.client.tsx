/**
 * @file DowngradePreviewPanel.client.tsx
 * @description Step 2 of the plan-change flow (SPEC-203 T-007).
 *
 * Renders the downgrade preview (accommodation/promotion excess, photo overflow,
 * grandfather flags) and a "choose what to keep" selector that builds the
 * `KeepSelections` object. Only shown when `preview.hasExcess === true`.
 *
 * Defaults each item to its `keepByDefault` flag value. The host can override
 * individual choices. On confirm, emits the resolved `KeepSelections` to the
 * parent flow.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { DowngradePreview, KeepSelections } from '@repo/schemas';
import { useState } from 'react';
import styles from './DowngradePreviewPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the DowngradePreviewPanel component. */
export interface DowngradePreviewPanelProps {
    /** The downgrade preview data from the API. */
    readonly preview: DowngradePreview;
    /** Name of the target plan (used in copy). */
    readonly targetPlanName: string;
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Called with the resolved keep-selections when the host confirms. */
    readonly onConfirm: (keepSelections: KeepSelections) => void;
    /** Called when the host goes back to the plan picker. */
    readonly onBack: () => void;
    /** Whether a submission is in progress (disables buttons). */
    readonly isPending: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DowngradePreviewPanel — step 2 of the host plan-change flow.
 *
 * Shows excess dimensions (accommodations, promotions, photos) and lets the
 * host pick which items to keep active. When no excess exists (`hasExcess`
 * false), this step is skipped by the parent flow entirely.
 *
 * @param props - {@link DowngradePreviewPanelProps}
 */
export function DowngradePreviewPanel({
    preview,
    targetPlanName,
    locale,
    onConfirm,
    onBack,
    isPending
}: DowngradePreviewPanelProps) {
    const { t } = createTranslations(locale);

    // ── Local selection state ───────────────────────────────────────────────

    const [selectedAccommodationIds, setSelectedAccommodationIds] = useState<Set<string>>(
        () =>
            new Set(
                preview.accommodations.items
                    .filter((item) => item.keepByDefault)
                    .map((item) => item.id)
            )
    );

    const [selectedPromotionIds, setSelectedPromotionIds] = useState<Set<string>>(
        () =>
            new Set(
                preview.promotions.items.filter((item) => item.keepByDefault).map((item) => item.id)
            )
    );

    // Photo selections: per accommodation, default-keep the non-overflow photos
    // (overflow = last N urls in overflowPhotoUrls, so keep = all gallery minus overflow).
    // We represent kept photos as a Set of URLs to exclude from being moved to archive.
    const [photoKeepMap, setPhotoKeepMap] = useState<Record<string, Set<string>>>(() => {
        const initial: Record<string, Set<string>> = {};
        for (const photoExcess of preview.photos) {
            // By default keep all non-overflow photos (keep map starts as empty = keep default)
            initial[photoExcess.accommodationId] = new Set<string>();
            // We track URLs the user explicitly marks to ARCHIVE (remove from keep)
            // Starting empty = "use system defaults"
        }
        return initial;
    });

    // ── Handlers ───────────────────────────────────────────────────────────

    function toggleAccommodation(id: string) {
        setSelectedAccommodationIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function togglePromotion(id: string) {
        setSelectedPromotionIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function togglePhotoKeep({
        accommodationId,
        photoUrl
    }: {
        readonly accommodationId: string;
        readonly photoUrl: string;
    }) {
        setPhotoKeepMap((prev) => {
            const current = new Set(prev[accommodationId] ?? []);
            if (current.has(photoUrl)) {
                current.delete(photoUrl);
            } else {
                current.add(photoUrl);
            }
            return { ...prev, [accommodationId]: current };
        });
    }

    function handleConfirm() {
        const keepSelections: KeepSelections = {};

        if (preview.accommodations.excessCount > 0) {
            keepSelections.accommodationIds = [...selectedAccommodationIds];
        }

        if (preview.promotions.excessCount > 0) {
            keepSelections.promotionIds = [...selectedPromotionIds];
        }

        if (preview.photos.length > 0) {
            const photoMap: Record<string, string[]> = {};
            for (const photoExcess of preview.photos) {
                const keepSet = photoKeepMap[photoExcess.accommodationId];
                if (keepSet && keepSet.size > 0) {
                    photoMap[photoExcess.accommodationId] = [...keepSet];
                }
            }
            if (Object.keys(photoMap).length > 0) {
                keepSelections.photoKeepMap = photoMap;
            }
        }

        onConfirm(keepSelections);
    }

    // ── Accommodation capacity warning ──────────────────────────────────────

    const accCap = preview.accommodations.cap;
    const accSelected = selectedAccommodationIds.size;
    const accOverCap = accSelected > accCap;

    const promoCap = preview.promotions.cap;
    const promoSelected = selectedPromotionIds.size;
    const promoOverCap = promoSelected > promoCap;

    return (
        <dialog
            className={styles.root}
            open
            aria-modal="true"
            aria-labelledby="downgrade-preview-title"
        >
            <div className={styles.header}>
                <h2
                    id="downgrade-preview-title"
                    className={styles.title}
                >
                    {t(
                        'account.pages.subscription.downgradePreview.title',
                        'Revisá los cambios antes de continuar'
                    )}
                </h2>
            </div>

            <p className={styles.intro}>
                {t(
                    'account.pages.subscription.downgradePreview.intro',
                    'Al cambiar al plan {plan} se aplicarán restricciones a tu cuenta. Elegí qué querés conservar.'
                ).replace('{plan}', targetPlanName)}
            </p>

            {/* ── Accommodation excess ── */}
            {preview.accommodations.excessCount > 0 && (
                <section
                    className={styles.section}
                    aria-labelledby="acc-excess-heading"
                >
                    <h3
                        id="acc-excess-heading"
                        className={styles.sectionTitle}
                    >
                        {t(
                            'account.pages.subscription.downgradePreview.accommodationsTitle',
                            'Alojamientos ({active} activos, máx. {cap})'
                        )
                            .replace('{active}', String(preview.accommodations.activeCount))
                            .replace('{cap}', String(accCap))}
                    </h3>
                    <p className={styles.sectionHint}>
                        {t(
                            'account.pages.subscription.downgradePreview.accommodationsHint',
                            'Seleccioná hasta {cap} alojamientos para mantener activos. El resto quedará inactivo.'
                        ).replace('{cap}', String(accCap))}
                    </p>

                    {accOverCap && (
                        <p
                            className={styles.overCapWarning}
                            role="alert"
                        >
                            {t(
                                'account.pages.subscription.downgradePreview.overCapWarning',
                                'Tenés {selected} seleccionados pero el plan permite {cap}. Deseleccioná {extra}.'
                            )
                                .replace('{selected}', String(accSelected))
                                .replace('{cap}', String(accCap))
                                .replace('{extra}', String(accSelected - accCap))}
                        </p>
                    )}

                    <ul
                        className={styles.itemList}
                        aria-label={t(
                            'account.pages.subscription.downgradePreview.accommodationsListLabel',
                            'Lista de alojamientos'
                        )}
                    >
                        {preview.accommodations.items.map((item) => (
                            <li
                                key={item.id}
                                className={styles.itemRow}
                            >
                                <label className={styles.itemLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.itemCheckbox}
                                        checked={selectedAccommodationIds.has(item.id)}
                                        onChange={() => toggleAccommodation(item.id)}
                                        disabled={isPending}
                                        aria-label={item.name}
                                    />
                                    <span className={styles.itemName}>{item.name}</span>
                                    {item.keepByDefault && (
                                        <span className={styles.itemDefaultBadge}>
                                            {t(
                                                'account.pages.subscription.downgradePreview.defaultKeep',
                                                'Sugerido'
                                            )}
                                        </span>
                                    )}
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Promotion excess ── */}
            {preview.promotions.excessCount > 0 && (
                <section
                    className={styles.section}
                    aria-labelledby="promo-excess-heading"
                >
                    <h3
                        id="promo-excess-heading"
                        className={styles.sectionTitle}
                    >
                        {t(
                            'account.pages.subscription.downgradePreview.promotionsTitle',
                            'Promociones ({active} activas, máx. {cap})'
                        )
                            .replace('{active}', String(preview.promotions.activeCount))
                            .replace('{cap}', String(promoCap))}
                    </h3>
                    <p className={styles.sectionHint}>
                        {t(
                            'account.pages.subscription.downgradePreview.promotionsHint',
                            'Seleccioná hasta {cap} promociones para mantener activas.'
                        ).replace('{cap}', String(promoCap))}
                    </p>

                    {promoOverCap && (
                        <p
                            className={styles.overCapWarning}
                            role="alert"
                        >
                            {t(
                                'account.pages.subscription.downgradePreview.overCapWarning',
                                'Tenés {selected} seleccionados pero el plan permite {cap}. Deseleccioná {extra}.'
                            )
                                .replace('{selected}', String(promoSelected))
                                .replace('{cap}', String(promoCap))
                                .replace('{extra}', String(promoSelected - promoCap))}
                        </p>
                    )}

                    <ul
                        className={styles.itemList}
                        aria-label={t(
                            'account.pages.subscription.downgradePreview.promotionsListLabel',
                            'Lista de promociones'
                        )}
                    >
                        {preview.promotions.items.map((item) => (
                            <li
                                key={item.id}
                                className={styles.itemRow}
                            >
                                <label className={styles.itemLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.itemCheckbox}
                                        checked={selectedPromotionIds.has(item.id)}
                                        onChange={() => togglePromotion(item.id)}
                                        disabled={isPending}
                                        aria-label={item.name}
                                    />
                                    <span className={styles.itemName}>{item.name}</span>
                                    {item.keepByDefault && (
                                        <span className={styles.itemDefaultBadge}>
                                            {t(
                                                'account.pages.subscription.downgradePreview.defaultKeep',
                                                'Sugerido'
                                            )}
                                        </span>
                                    )}
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Photo overflow (informational + keep selector) ── */}
            {preview.photos.length > 0 && (
                <section
                    className={styles.section}
                    aria-labelledby="photos-excess-heading"
                >
                    <h3
                        id="photos-excess-heading"
                        className={styles.sectionTitle}
                    >
                        {t(
                            'account.pages.subscription.downgradePreview.photosTitle',
                            'Fotos excedidas'
                        )}
                    </h3>
                    <p className={styles.sectionHint}>
                        {t(
                            'account.pages.subscription.downgradePreview.photosHint',
                            'Algunos alojamientos tienen más fotos de las permitidas. Las excedidas se moverán al archivo.'
                        )}
                    </p>

                    {preview.photos.map((photoExcess) => (
                        <div
                            key={photoExcess.accommodationId}
                            className={styles.photoAccommodation}
                        >
                            <p className={styles.photoAccName}>
                                {photoExcess.accommodationName}
                                <span className={styles.photoCountLabel}>
                                    {' '}
                                    ({photoExcess.totalCount}{' '}
                                    {t(
                                        'account.pages.subscription.downgradePreview.photosOf',
                                        'fotos, máx.'
                                    )}{' '}
                                    {photoExcess.cap})
                                </span>
                            </p>
                            {photoExcess.overflowPhotoUrls.length > 0 && (
                                <ul
                                    className={styles.photoList}
                                    aria-label={t(
                                        'account.pages.subscription.downgradePreview.photoOverflowLabel',
                                        'Fotos que se archivarán'
                                    )}
                                >
                                    {photoExcess.overflowPhotoUrls.map((url) => {
                                        const keepSet = photoKeepMap[photoExcess.accommodationId];
                                        const isKept = keepSet?.has(url) ?? false;
                                        return (
                                            <li
                                                key={url}
                                                className={styles.photoRow}
                                            >
                                                <label className={styles.itemLabel}>
                                                    <input
                                                        type="checkbox"
                                                        className={styles.itemCheckbox}
                                                        checked={isKept}
                                                        onChange={() =>
                                                            togglePhotoKeep({
                                                                accommodationId:
                                                                    photoExcess.accommodationId,
                                                                photoUrl: url
                                                            })
                                                        }
                                                        disabled={isPending}
                                                        aria-label={t(
                                                            'account.pages.subscription.downgradePreview.keepPhotoLabel',
                                                            'Conservar foto {url}'
                                                        ).replace('{url}', url)}
                                                    />
                                                    <span
                                                        className={styles.photoUrl}
                                                        title={url}
                                                    >
                                                        {url.split('/').pop() ?? url}
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* ── Grandfather flags (informational only) ── */}
            {preview.grandfatherFlags.length > 0 && (
                <section
                    className={styles.section}
                    aria-labelledby="grandfather-heading"
                >
                    <h3
                        id="grandfather-heading"
                        className={styles.sectionTitle}
                    >
                        {t(
                            'account.pages.subscription.downgradePreview.grandfatherTitle',
                            'Contenido que quedará en modo lectura'
                        )}
                    </h3>
                    <p className={styles.sectionHint}>
                        {t(
                            'account.pages.subscription.downgradePreview.grandfatherHint',
                            'Estos alojamientos tienen contenido que no podrás editar con el nuevo plan, pero NO se eliminará.'
                        )}
                    </p>
                    <ul className={styles.itemList}>
                        {preview.grandfatherFlags.map((flag) => (
                            <li
                                key={flag.accommodationId}
                                className={styles.grandfatherRow}
                            >
                                <span className={styles.itemName}>{flag.accommodationName}</span>
                                <span className={styles.grandfatherFlags}>
                                    {flag.hasRichDescription && (
                                        <span className={styles.grandfatherFlag}>
                                            {t(
                                                'account.pages.subscription.downgradePreview.richDescription',
                                                'Descripción enriquecida'
                                            )}
                                        </span>
                                    )}
                                    {flag.hasVideoEmbed && (
                                        <span className={styles.grandfatherFlag}>
                                            {t(
                                                'account.pages.subscription.downgradePreview.videoEmbed',
                                                'Video embebido'
                                            )}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Actions ── */}
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.btnBack}
                    onClick={onBack}
                    disabled={isPending}
                >
                    {t('common.back', 'Volver')}
                </button>
                <button
                    type="button"
                    className={styles.btnConfirm}
                    onClick={handleConfirm}
                    disabled={isPending || accOverCap || promoOverCap}
                    aria-busy={isPending}
                >
                    {isPending
                        ? t('common.loading', 'Cargando...')
                        : t(
                              'account.pages.subscription.downgradePreview.confirmButton',
                              'Continuar con el cambio'
                          )}
                </button>
            </div>
        </dialog>
    );
}

/**
 * @file PhotoSectionDescription.client.tsx
 * @description The photo section's intro line: the plan-derived gallery cap, the
 * loading window, or (HOS-2442) the no-plan state.
 */

import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './PhotoSection.module.css';

/** Props for {@link PhotoSectionDescription}. */
export interface PhotoSectionDescriptionProps {
    readonly locale: SupportedLocale;
    /** Whether the entitlements read is still in flight. */
    readonly isLoading: boolean;
    /** Whether the entitlements read failed (the plan is then unknown, not absent). */
    readonly readFailed: boolean;
    /** Whether a positive gallery cap was resolved. */
    readonly isResolved: boolean;
    /** The resolved gallery cap; meaningful only when `isResolved`. */
    readonly cap: number;
}

/**
 * Renders the cap, the loading copy, or the no-plan explanation with a link to the
 * plans. A failed read shows a neutral error instead. "No plan" is the state where entitlements answered but grant no photo cap;
 * showing "loading" there would never end.
 */
export function PhotoSectionDescription({
    locale,
    isLoading,
    isResolved,
    readFailed,
    cap
}: PhotoSectionDescriptionProps) {
    const { t, tPlural } = createTranslations(locale);
    return (
        <p
            className={styles.sectionDescription}
            aria-busy={isLoading}
        >
            {isResolved ? (
                tPlural('host.properties.editor.section.photosDescription', cap, { cap })
            ) : isLoading ? (
                t(
                    'host.properties.editor.section.photosDescriptionLoading',
                    'Cargando tu límite de fotos…'
                )
            ) : readFailed ? (
                // A failed read says nothing about the plan: never claim the host has none.
                t(
                    'host.properties.editor.section.photosDescriptionError',
                    'No pudimos cargar tu límite de fotos. Probá recargar la página.'
                )
            ) : (
                <>
                    {t(
                        'host.properties.editor.section.photosDescriptionNoPlan',
                        'Tu plan actual no incluye subir fotos. Elegí un plan para agregarlas.'
                    )}{' '}
                    <a
                        className={styles.plansLink}
                        href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner })}
                    >
                        {t('host.properties.editor.section.photosPlansCta', 'Ver planes')}
                    </a>
                </>
            )}
        </p>
    );
}

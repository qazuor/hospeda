/**
 * @file FeaturedToggleSection.client.tsx
 * @description Owner self-service featured toggle section (SPEC-309 T-020, G-6).
 *
 * Self-contained, like `ExternalReputationSection.client.tsx`: fetches its own
 * entitlement status on mount via `GET .../featured-toggle` (T-020) and calls
 * `PATCH .../featured-toggle` (T-019) on change. Renders nothing while loading
 * or on error, and nothing at all when the owner lacks an active
 * FEATURED_LISTING entitlement (plan or addon) for this accommodation — fail
 * closed, since most owners will not have it. A plain on/off switch, no
 * rotation/queue UI (SPEC-309 OQ-4).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useState } from 'react';
import styles from './FeaturedToggleSection.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for FeaturedToggleSection. */
export interface FeaturedToggleSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Owner-facing featured toggle section.
 *
 * Renders only when the owner currently holds an active FEATURED_LISTING
 * entitlement (plan or addon) for this specific accommodation.
 */
export function FeaturedToggleSection({ locale, accommodationId }: FeaturedToggleSectionProps) {
    const { t } = createTranslations(locale);

    const [isLoading, setIsLoading] = useState(true);
    const [hasEntitlement, setHasEntitlement] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [toggleError, setToggleError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
                const result = await accommodationEditApi.getFeaturedEntitlement({
                    id: accommodationId
                });
                if (cancelled) return;

                if (result.ok) {
                    setHasEntitlement(result.data.hasEntitlement);
                    setIsFeatured(result.data.isFeatured);
                } else {
                    setHasEntitlement(false);
                }
            } catch {
                if (!cancelled) setHasEntitlement(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [accommodationId]);

    const handleToggle = useCallback(async () => {
        const nextValue = !isFeatured;
        setIsToggling(true);
        setToggleError(null);
        try {
            const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
            const result = await accommodationEditApi.setFeaturedToggle({
                id: accommodationId,
                isFeatured: nextValue
            });

            if (result.ok) {
                setIsFeatured(result.data.isFeatured);
            } else {
                setToggleError(
                    result.error.message ||
                        t(
                            'host.properties.editor.featuredToggle.toggleError',
                            'No se pudo actualizar el destacado. Intentá de nuevo.'
                        )
                );
            }
        } catch {
            setToggleError(
                t(
                    'host.properties.editor.featuredToggle.toggleError',
                    'No se pudo actualizar el destacado. Intentá de nuevo.'
                )
            );
        } finally {
            setIsToggling(false);
        }
    }, [accommodationId, isFeatured, t]);

    if (isLoading || !hasEntitlement) {
        return null;
    }

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.featuredToggle', 'Destacado')}
            </legend>

            <div className={styles.toggleRow}>
                <label
                    htmlFor="featured-toggle"
                    className={styles.toggleLabel}
                >
                    {t('host.properties.editor.featuredToggle.label', 'Destacar mi alojamiento')}
                </label>
                <input
                    id="featured-toggle"
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={isFeatured}
                    onChange={() => void handleToggle()}
                    disabled={isToggling}
                />
            </div>

            <p className={styles.hint}>
                {t(
                    'host.properties.editor.featuredToggle.hint',
                    'Cuando está activo, tu alojamiento aparece con prioridad en los listados y búsquedas.'
                )}
            </p>

            {toggleError && (
                <div
                    className={styles.errorBanner}
                    role="alert"
                >
                    {toggleError}
                </div>
            )}
        </fieldset>
    );
}

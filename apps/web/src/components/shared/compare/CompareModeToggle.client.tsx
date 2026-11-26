import { ColumnIcon } from '@repo/icons';
import { type FC, useEffect, useRef, useState } from 'react';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import {
    loadCompareModeFromStorage,
    toggleCompareMode,
    useCompareMode
} from '@/store/compare-store';
import styles from './CompareModeToggle.module.css';
import { CompareUpsellPopover } from './CompareUpsellPopover.client';

/** Props for the compare-mode toggle island. Catalog metadata is public. */
export interface CompareModeToggleProps {
    readonly locale?: SupportedLocale;
    readonly className?: string;
    readonly planName?: string | null;
    readonly planCapacity?: number;
}

/** Toggle compare mode for entitled visitors, or explain the benefit before any selection. */
export const CompareModeToggle: FC<CompareModeToggleProps> = ({
    locale = 'es',
    className,
    planName = null,
    planCapacity
}) => {
    const t = createT(locale);
    const mode = useCompareMode();
    const { canCompare, isLoading } = useCompareGuard();
    const [isUpsellPopoverOpen, setIsUpsellPopoverOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        loadCompareModeFromStorage();
    }, []);

    const active = mode && canCompare;
    const toggleLabel = t('accommodations.comparison.mode.toggleLabel', 'Comparar alojamientos');
    const activeLabel = t('accommodations.comparison.mode.activeLabel', 'Salir de comparar');
    const activeHint = t(
        'accommodations.comparison.mode.bannerHint',
        'Elegí los alojamientos que querés comparar'
    );
    const benefit =
        planName && planCapacity && Number.isSafeInteger(planCapacity) && planCapacity > 0
            ? t('accommodations.comparison.gate.benefit', undefined, {
                  count: planCapacity,
                  plan: planName
              })
            : t('accommodations.comparison.gate.upsellMessage');

    const handleClick = (): void => {
        if (isLoading) return;
        if (canCompare) {
            toggleCompareMode();
            return;
        }
        setIsUpsellPopoverOpen((open) => !open);
    };

    return (
        <div className={styles.wrapper}>
            <button
                ref={buttonRef}
                type="button"
                aria-pressed={active}
                aria-busy={isLoading}
                aria-haspopup={canCompare ? undefined : 'dialog'}
                aria-expanded={canCompare ? undefined : isUpsellPopoverOpen}
                data-active={active ? 'true' : undefined}
                className={cn(styles.toggle, className)}
                onClick={handleClick}
            >
                <ColumnIcon
                    size={20}
                    weight={active ? 'fill' : 'regular'}
                    aria-hidden="true"
                />
                <span className={styles.label}>{active ? activeLabel : toggleLabel}</span>
                <PlanBadge name={planName} />
            </button>
            {active && <span className={styles.hint}>{activeHint}</span>}

            {isUpsellPopoverOpen && !canCompare && (
                <CompareUpsellPopover
                    anchorRef={buttonRef}
                    message={benefit}
                    ctaLabel={t('accommodations.comparison.gate.upsellCta', 'Ver planes')}
                    ctaHref={`/${locale}/${PRICING_PAGE_PATH_BY_AUDIENCE.tourist}/`}
                    onClose={() => setIsUpsellPopoverOpen(false)}
                    dialogLabel={t(
                        'accommodations.comparison.upsell.title',
                        'Comparación de alojamientos'
                    )}
                    closeLabel={t('common.auth.close', 'Cerrar')}
                    dismissLabel={t('common.vipGate.notNow', 'Ahora no')}
                />
            )}
        </div>
    );
};

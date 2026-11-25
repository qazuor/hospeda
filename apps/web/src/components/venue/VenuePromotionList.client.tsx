/**
 * @file VenuePromotionList.client.tsx
 * @description Venue promotions use the same kit card and adaptive grid as
 * accommodation promotions. Edit, pause/reactivate and delete share one footer.
 */

import { Button } from '@/components/account/ui/Button';
import { StatusPill } from '@/components/account/ui/StatusPill';
import { toneFor } from '@/components/account/ui/status-tone';
import { PromotionCard } from '@/components/host/PromotionCard';
import styles from '@/components/host/PromotionCard.module.css';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { formatPromotionBenefit } from '@/lib/promotions/format-benefit';
import {
    PROMOTION_STATUS_BY_STATE,
    type PromotionRow,
    resolvePromotionLifecycleState
} from './promotion-lifecycle';

/** Spanish fallbacks of the lifecycle labels. */
const STATE_FALLBACK = {
    active: 'Activa',
    draft: 'Borrador',
    paused: 'Pausada',
    expired: 'Vencida'
} as const;

/** Props for {@link VenuePromotionList}. */
export interface VenuePromotionListProps {
    readonly locale: SupportedLocale;
    readonly items: readonly PromotionRow[];
    /** Client clock; `null` until the first client render. */
    readonly now: number | null;
    readonly sectionState: 'locked' | 'available';
    readonly onEdit: (item: PromotionRow) => void;
    readonly onActivate: (item: PromotionRow) => void;
    readonly onPause: (item: PromotionRow) => void;
    readonly onDelete: (item: PromotionRow) => void;
}

/**
 * Renders the owner's promotions as shared kit cards.
 *
 * @param props - See {@link VenuePromotionListProps}.
 * @returns The promotion grid.
 */
export function VenuePromotionList({
    locale,
    items,
    now,
    sectionState,
    onEdit,
    onActivate,
    onPause,
    onDelete
}: VenuePromotionListProps) {
    const { t } = createTranslations(locale);
    const actionLabel = (key: 'edit' | 'pause' | 'activate' | 'delete') =>
        t(`venue.owner.editor.promotionsManager.actions.${key}`);

    return (
        <ul
            className={styles.grid}
            aria-label={t('venue.owner.editor.promotionsManager.title')}
        >
            {items.map((item) => {
                const state = resolvePromotionLifecycleState(item, now);
                const stateLabel =
                    state === null
                        ? null
                        : t(
                              `venue.owner.editor.promotionsManager.states.${state}`,
                              STATE_FALLBACK[state]
                          );
                return (
                    <PromotionCard
                        key={item.id}
                        locale={locale}
                        title={item.title}
                        benefit={formatPromotionBenefit({
                            discountType: item.discountType,
                            discountValue: item.discountValue,
                            locale,
                            specialOfferText: item.description
                        })}
                        status={
                            state !== null && stateLabel ? (
                                <StatusPill
                                    tone={toneFor({
                                        domain: 'promotion',
                                        status: PROMOTION_STATUS_BY_STATE[state]
                                    })}
                                >
                                    {stateLabel}
                                </StatusPill>
                            ) : null
                        }
                        validFrom={item.validFrom}
                        validUntil={item.validUntil}
                        actions={
                            <>
                                {/* Owner decision 18: shown, but disabled, without the plan key. */}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={sectionState !== 'available'}
                                    onClick={() => onEdit(item)}
                                >
                                    {actionLabel('edit')}
                                </Button>
                                {item.lifecycleState === 'ACTIVE' ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onPause(item)}
                                    >
                                        {actionLabel('pause')}
                                    </Button>
                                ) : sectionState === 'available' ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onActivate(item)}
                                    >
                                        {actionLabel('activate')}
                                    </Button>
                                ) : null}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onDelete(item)}
                                >
                                    {actionLabel('delete')}
                                </Button>
                            </>
                        }
                    />
                );
            })}
        </ul>
    );
}

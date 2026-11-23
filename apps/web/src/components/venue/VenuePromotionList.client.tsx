/**
 * @file VenuePromotionList.client.tsx
 * @description The rows of the venue promotions manager on the kit
 * `DataList` / `ListRow` (HOS-2504).
 *
 * A row carries up to three actions (edit, pause or reactivate, delete). The
 * kit row has two action slots, so edit and pause share the first slot as one
 * group and delete takes the second.
 */

import { formatCalendarDate } from '@repo/utils';
import { Button } from '@/components/account/ui/Button';
import { DataList } from '@/components/account/ui/DataList';
import { ListRow } from '@/components/account/ui/ListRow';
import { StatusPill } from '@/components/account/ui/StatusPill';
import { toneFor } from '@/components/account/ui/status-tone';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { formatPromotionBenefit } from '@/lib/promotions/format-benefit';
import {
    PROMOTION_STATUS_BY_STATE,
    type PromotionRow,
    resolvePromotionLifecycleState
} from './promotion-lifecycle';
import styles from './VenuePromotionList.module.css';

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
 * Renders the owner's promotions as kit rows.
 *
 * @param props - See {@link VenuePromotionListProps}.
 * @returns The data list.
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
        <DataList label={t('venue.owner.editor.promotionsManager.title', 'Promociones')}>
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
                    <ListRow
                        key={item.id}
                        rowId={item.id}
                        title={item.title}
                        meta={
                            <span className={styles.meta}>
                                <span>
                                    {formatPromotionBenefit({
                                        discountType: item.discountType,
                                        discountValue: item.discountValue,
                                        locale,
                                        specialOfferText: item.description
                                    })}
                                </span>
                                {state !== null && stateLabel ? (
                                    <StatusPill
                                        tone={toneFor({
                                            domain: 'promotion',
                                            status: PROMOTION_STATUS_BY_STATE[state]
                                        })}
                                    >
                                        {stateLabel}
                                    </StatusPill>
                                ) : null}
                            </span>
                        }
                        description={
                            <>
                                {formatCalendarDate({
                                    value: item.validFrom,
                                    locale,
                                    options: { dateStyle: 'long' }
                                })}{' '}
                                –{' '}
                                {item.validUntil
                                    ? formatCalendarDate({
                                          value: item.validUntil,
                                          locale,
                                          options: { dateStyle: 'long' }
                                      })
                                    : t('venue.detail.promotions.noEndDate', 'Sin fecha de fin')}
                            </>
                        }
                        actions={[
                            <span
                                key="primary"
                                className={styles.actionGroup}
                            >
                                {sectionState === 'available' ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                    >
                                        {actionLabel('edit')}
                                    </Button>
                                ) : null}
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
                            </span>,
                            <Button
                                key="delete"
                                variant="danger-ghost"
                                size="sm"
                                onClick={() => onDelete(item)}
                            >
                                {actionLabel('delete')}
                            </Button>
                        ]}
                    />
                );
            })}
        </DataList>
    );
}

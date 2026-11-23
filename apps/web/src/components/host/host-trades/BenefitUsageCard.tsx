/**
 * @file BenefitUsageCard.tsx
 * @description One benefit-usage row, in the inbox or in the history (HOS-376 T-046),
 * as a kit `ListRow` inside the panel's `DataList` (HOS-2502).
 *
 * Presentational: every decision it renders is taken by the caller or by the
 * pure helpers in `@/lib/host/benefit-usage-view`. It holds no state and issues
 * no requests, so the panel above it owns the whole transition flow.
 */

import { Button, ListRow, StatusPill } from '@/components/account/ui';
import type { BenefitUsage } from '@/lib/api/endpoints-protected';
import { formatDate } from '@/lib/format-utils';
import { canUndoRejection, parseCalendarDate } from '@/lib/host/benefit-usage-view';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { TRADE_CARD_MAX_BADGES } from '@/lib/trade-category-labels';
import { TradeCategoryBadges } from './TradeCategoryBadges';

interface BenefitUsageCardProps {
    readonly locale: SupportedLocale;
    readonly usage: BenefitUsage;
    /** Renders the Confirm / Reject pair. Only true for the inbox. */
    readonly answerable?: boolean;
    /** True while a request for THIS row is in flight. */
    readonly busy?: boolean;
    readonly onConfirm?: (usage: BenefitUsage) => void;
    readonly onReject?: (usage: BenefitUsage) => void;
    readonly onUndoRejection?: (usage: BenefitUsage) => void;
    /** Opens the review dialog. Absent in the inbox, where nothing is confirmed yet. */
    readonly onReview?: (usage: BenefitUsage) => void;
}

/**
 * Renders one usage: who the provider is, when the service happened, what state
 * the record is in, and whichever actions the row actually admits (at most two,
 * the `ListRow` limit: Confirm and Reject, or one of undo / review).
 *
 * @param props - The row, the locale, and the callbacks for its actions.
 * @returns The row element (`<li>`).
 */
export function BenefitUsageCard({
    locale,
    usage,
    answerable = false,
    busy = false,
    onConfirm,
    onReject,
    onUndoRejection,
    onReview
}: BenefitUsageCardProps) {
    const { t } = createTranslations(locale);

    // The provider should always resolve — the FK cascades — so this fallback is
    // a label, not a feature: one unresolved name must not leave a row with a
    // blank heading the host cannot make sense of.
    const providerName =
        usage.hostTrade?.name ??
        t('host-trades.usages.card.unknownProvider', 'Proveedor del directorio');

    const servicedOn = parseCalendarDate(usage.servicedAt);
    const servicedLabel = servicedOn ? formatDate({ date: servicedOn, locale }) : usage.servicedAt;

    const showUndo = canUndoRejection(usage);

    // Reviewing needs a CONFIRMED usage — the spec's hardest precondition — and
    // a provider the dialog can address. Offering it otherwise would walk the
    // host into a dialog whose only possible answer is 403 NO_CONFIRMED_USAGE.
    const showReview =
        usage.status === 'CONFIRMED' && usage.hostTrade !== null && onReview !== undefined;

    const noteLines = [
        usage.note ? `“${usage.note}”` : null,
        usage.status === 'REJECTED' && usage.rejectionNote
            ? t('host-trades.usages.card.rejectionNote', 'Motivo del rechazo: {{note}}', {
                  note: usage.rejectionNote
              })
            : null
    ].filter((line): line is string => line !== null);

    const actions = answerable
        ? ([
              <Button
                  key="confirm"
                  size="sm"
                  disabled={busy}
                  onClick={() => onConfirm?.(usage)}
              >
                  {t('host-trades.usages.actions.confirm', 'Confirmar')}
              </Button>,
              <Button
                  key="reject"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onReject?.(usage)}
              >
                  {t('host-trades.usages.actions.reject', 'Rechazar')}
              </Button>
          ] as const)
        : showUndo
          ? ([
                <Button
                    key="undo"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onUndoRejection?.(usage)}
                >
                    {t('host-trades.usages.actions.undoRejection', 'Deshacer el rechazo')}
                </Button>
            ] as const)
          : showReview
            ? ([
                  <Button
                      key="review"
                      size="sm"
                      disabled={busy}
                      onClick={() => onReview?.(usage)}
                  >
                      {/* The dialog opens in edit mode when a review already
                          exists, so a fixed "Valorar" label would announce the
                          wrong action. `hasReview` comes on the row for exactly this. */}
                      {usage.hasReview
                          ? t('host-trades.review.ctaEdit', 'Editar tu valoración de {{name}}', {
                                name: providerName
                            })
                          : t('host-trades.review.cta', 'Valorar a {{name}}', {
                                name: providerName
                            })}
                  </Button>
              ] as const)
            : ([] as const);

    return (
        <ListRow
            rowId={usage.id}
            title={providerName}
            meta={
                <>
                    <span>
                        {t('host-trades.usages.card.servicedOn', 'Servicio del {{date}}', {
                            date: servicedLabel
                        })}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>
                        {usage.declaredBy === 'HOST'
                            ? t('host-trades.usages.card.declaredByYou', 'Lo registraste vos')
                            : t(
                                  'host-trades.usages.card.declaredByProvider',
                                  'Lo registró el proveedor'
                              )}
                    </span>
                </>
            }
            description={
                noteLines.length > 0
                    ? noteLines.map((line) => <span key={line}>{line} </span>)
                    : undefined
            }
            wrapDescription
            extra={
                usage.hostTrade ? (
                    <TradeCategoryBadges
                        categories={usage.hostTrade.categories}
                        locale={locale}
                        max={TRADE_CARD_MAX_BADGES}
                    />
                ) : undefined
            }
            trailing={
                <StatusPill
                    domain="benefitUsage"
                    status={usage.status}
                    locale={locale}
                />
            }
            actions={actions}
        />
    );
}

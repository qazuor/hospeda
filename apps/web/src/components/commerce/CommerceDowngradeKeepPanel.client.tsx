/**
 * @file CommerceDowngradeKeepPanel.client.tsx
 * @description "Elegí cuáles conservar" — step 2 of the commerce tier-change
 * flow when the chosen tier is CHEAPER (HOS-1122).
 *
 * The commerce sibling of `account/DowngradePreviewPanel.client.tsx`, and
 * deliberately the same shape: a checkbox per item, the system's suggestion
 * pre-ticked, a live over-cap warning, and Confirm disabled while the
 * selection does not fit. Commerce has ONE dimension instead of four — its
 * vertical's listing cap — so this is that panel with three sections removed,
 * not a different idea.
 *
 * ## Why it has to exist at all
 *
 * Without it nobody fills `keepSelections`, and the apply-time default decides
 * which of the owner's restaurants goes dark: most-recently-updated wins. That
 * is a reasonable default and a terrible surprise — the listing an owner edited
 * last is not the listing they care most about.
 *
 * ## The checkbox is labelled by `aria-label`, not by adjacent text
 *
 * Same as the accommodation panel. A visible `<span>` beside the input would
 * make the accessible name whatever `textContent` the label ends up holding —
 * badge text included — so a "Sugerido" chip would silently become part of
 * every suggested listing's name.
 */

import type { CommerceDowngradePreview, CommerceKeepSelections } from '@repo/schemas';
import type { JSX } from 'react';
import { useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceDowngradeKeepPanel.module.css';

/** Props for {@link CommerceDowngradeKeepPanel}. */
export interface CommerceDowngradeKeepPanelProps {
    /** The read-only preview from `fetchCommerceDowngradePreview`. */
    readonly preview: CommerceDowngradePreview;
    /** Display name of the tier being moved to (rendered in the copy). */
    readonly targetPlanName: string;
    /**
     * When the downgrade takes effect, already formatted for the locale, or
     * `null` when the period end is unknown. Never a guess: the copy switches
     * to a date-less phrasing rather than inventing one.
     */
    readonly effectiveDateLabel: string | null;
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Called with the chosen listing ids when the owner confirms. */
    readonly onConfirm: (keepSelections: CommerceKeepSelections) => void;
    /** Called when the owner goes back to the tier picker. */
    readonly onBack: () => void;
    /** Disables interaction while the change-plan request is in flight. */
    readonly isPending: boolean;
}

/**
 * CommerceDowngradeKeepPanel — lets the owner choose which listings survive a
 * commerce downgrade.
 *
 * @param props - {@link CommerceDowngradeKeepPanelProps}.
 */
export function CommerceDowngradeKeepPanel({
    preview,
    targetPlanName,
    effectiveDateLabel,
    locale,
    onConfirm,
    onBack,
    isPending
}: CommerceDowngradeKeepPanelProps): JSX.Element {
    const { t } = createTranslations(locale);

    // Pre-ticked with the system's own suggestion, so an owner who agrees can
    // confirm without reading every row — and one who does not can see exactly
    // what they are overriding.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set(preview.items.filter((item) => item.keepByDefault).map((item) => item.id))
    );

    function toggle(id: string): void {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    const selectedCount = selectedIds.size;
    const overCap = selectedCount > preview.cap;

    function handleConfirm(): void {
        if (overCap || isPending) {
            return;
        }
        onConfirm({ listingIds: [...selectedIds] });
    }

    return (
        <div className={styles.root}>
            <h2 className={styles.title}>
                {t(
                    'commerce.owner.planChange.keepPanel.title',
                    'Elegí qué fichas seguís mostrando'
                )}
            </h2>

            <p className={styles.intro}>
                {t(
                    'commerce.owner.planChange.keepPanel.intro',
                    'El plan {plan} incluye {cap} de tus {active} fichas. Las que no elijas van a dejar de verse.'
                )
                    .replace('{plan}', targetPlanName)
                    .replace('{cap}', String(preview.cap))
                    .replace('{active}', String(preview.activeCount))}
            </p>

            <p className={styles.when}>
                {effectiveDateLabel === null
                    ? t(
                          'commerce.owner.planChange.keepPanel.whenNoDate',
                          'El cambio se aplica al final del período que ya pagaste. Hasta entonces no cambia nada.'
                      )
                    : t(
                          'commerce.owner.planChange.keepPanel.when',
                          'El cambio se aplica el {date}. Hasta entonces seguís con tu plan actual y todas tus fichas visibles.'
                      ).replace('{date}', effectiveDateLabel)}
            </p>

            {/* The one thing an owner cannot undo from this screen, said plainly. */}
            <p className={styles.quotaNote}>
                {t(
                    'commerce.owner.planChange.keepPanel.quotaNote',
                    'Una ficha oculta sigue ocupando lugar en tu cupo: no vas a poder crear otra en su lugar. Vuelve a verse si subís de plan.'
                )}
            </p>

            {overCap && (
                <p
                    className={styles.overCap}
                    role="alert"
                >
                    {t(
                        'commerce.owner.planChange.keepPanel.overCap',
                        'Elegiste {selected} y el plan permite {cap}. Desmarcá {extra}.'
                    )
                        .replace('{selected}', String(selectedCount))
                        .replace('{cap}', String(preview.cap))
                        .replace('{extra}', String(selectedCount - preview.cap))}
                </p>
            )}

            <ul
                className={styles.list}
                aria-label={t(
                    'commerce.owner.planChange.keepPanel.listLabel',
                    'Tus fichas de este rubro'
                )}
            >
                {preview.items.map((item) => (
                    <li
                        key={item.id}
                        className={styles.row}
                    >
                        <label className={styles.rowLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggle(item.id)}
                                disabled={isPending}
                                aria-label={item.name}
                            />
                            <span className={styles.rowName}>{item.name}</span>
                            {item.keepByDefault && (
                                <span className={styles.badge}>
                                    {t('commerce.owner.planChange.keepPanel.suggested', 'Sugerida')}
                                </span>
                            )}
                        </label>
                    </li>
                ))}
            </ul>

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
                    disabled={isPending || overCap}
                    aria-busy={isPending}
                >
                    {isPending
                        ? t('common.loading', 'Cargando...')
                        : t('commerce.owner.planChange.keepPanel.confirm', 'Programar el cambio')}
                </button>
            </div>
        </div>
    );
}

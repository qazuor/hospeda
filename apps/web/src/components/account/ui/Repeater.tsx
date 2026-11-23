/**
 * Repeater — a list of editable rows with add, remove and reorder
 * (HOS-2490, spec HOS-2415 §6.5).
 *
 * One component for every repeatable list of the editors: the FAQ (both
 * editors), the carta's courses and dishes, the menú del día and the agenda.
 * It owns the CHROME only: the row frame, its visible label, the move and
 * remove buttons, the confirmation before removing, the add button and the
 * empty state. The fields of each row, and what a change means (a local draft
 * saved by the bar, or a direct save), stay with the caller.
 *
 * ```tsx
 * <Repeater
 *     locale={locale}
 *     label="Platos"
 *     items={dishes}
 *     getKey={(_dish, index) => `dish-${index}`}
 *     getItemLabel={(dish, index) => dish.name || `Plato ${index + 1}`}
 *     renderItem={(dish, index) => <DishFields dish={dish} index={index} />}
 *     onMove={moveDish}
 *     onRemove={removeDish}
 *     onAdd={addDish}
 *     addLabel="Agregar plato"
 * />
 * ```
 *
 * - **Remove asks first** (HOS-2429): `onRemove` runs only after the kit
 *   `ConfirmDialog` is confirmed. Cancel leaves the list untouched.
 * - **Move** is two labelled buttons per row (keyboard and screen-reader
 *   operable); the first row cannot go up and the last cannot go down.
 * - **Layout** follows the container (`@container`), never the viewport: the
 *   actions wrap under the label in a narrow column.
 *
 * @module components/account/ui/Repeater
 */

import { AddIcon, ChevronDownIcon, ChevronUpIcon } from '@repo/icons';
import { type ReactNode, useId } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { EmptyState } from './EmptyState';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Repeater.module.css';
import { type ConfirmRequest, useConfirm } from './use-confirm';

/** The confirmation copy for removing one row. */
export type RepeaterRemoveConfirm = Pick<ConfirmRequest, 'title' | 'description' | 'confirmLabel'>;

/** Which moves a row allows. */
export interface RepeaterMoves {
    readonly up: boolean;
    readonly down: boolean;
}

/** Props of {@link Repeater}. */
export interface RepeaterProps<T> {
    /** The rows, in display order. */
    readonly items: readonly T[];
    /** Locale for the built-in copy. */
    readonly locale: SupportedLocale;
    /** Accessible name of the list. */
    readonly label: string;
    /** Stable React key of a row. */
    readonly getKey: (item: T, index: number) => string;
    /** Visible label of a row; also names its buttons («Quitar Entradas»). */
    readonly getItemLabel: (item: T, index: number) => string;
    /** The row's fields. */
    readonly renderItem: (item: T, index: number) => ReactNode;
    /** Extra actions shown before «Quitar» (for example a per-row save). */
    readonly renderItemActions?: (item: T, index: number) => ReactNode;
    /** Moves a row by one position; absent hides the move buttons. */
    readonly onMove?: (index: number, delta: -1 | 1) => void;
    /** Which moves a row allows; defaults to «not past either end». */
    readonly getMoves?: (item: T, index: number) => RepeaterMoves;
    /** Removes a row, AFTER the confirmation; absent hides «Quitar». */
    readonly onRemove?: (index: number) => void | Promise<void>;
    /** Confirmation copy for a row; defaults to the generic kit copy. */
    readonly getRemoveConfirm?: (item: T, index: number) => RepeaterRemoveConfirm;
    /** Adds a row; absent hides the add button. */
    readonly onAdd?: () => void;
    /** Label of the add button (verb + object). */
    readonly addLabel?: string;
    /** Whether a row can be added right now. @default true */
    readonly canAdd?: boolean;
    /** Empty state shown instead of the list when there are no rows. */
    readonly empty?: { readonly title: ReactNode; readonly description?: ReactNode };
    /** Disables every built-in action (while saving, for example). */
    readonly disabled?: boolean;
    /** Help anchor (`data-help`). */
    readonly helpId?: HelpAnchor;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/**
 * A repeatable list of rows.
 *
 * @param props - See {@link RepeaterProps}.
 * @returns The list, its add button and the remove confirmation.
 */
export function Repeater<T>({
    items,
    locale,
    label,
    getKey,
    getItemLabel,
    renderItem,
    renderItemActions,
    onMove,
    getMoves,
    onRemove,
    getRemoveConfirm,
    onAdd,
    addLabel,
    canAdd = true,
    empty,
    disabled = false,
    helpId,
    className
}: RepeaterProps<T>) {
    const t = createT(locale);
    const baseId = useId();
    const { confirm, confirmDialog } = useConfirm({ locale });

    const askAndRemove = async (item: T, index: number): Promise<void> => {
        if (!onRemove) return;
        const itemLabel = getItemLabel(item, index);
        const copy = getRemoveConfirm?.(item, index) ?? {
            title: t('account.ui.repeater.confirmTitle', undefined, { item: itemLabel }),
            description: t('account.ui.repeater.confirmDescription'),
            confirmLabel: t('account.ui.repeater.confirmLabel')
        };
        if (await confirm(copy)) {
            await onRemove(index);
        }
    };

    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
        >
            {items.length === 0 && empty ? (
                <EmptyState
                    variant="compact"
                    title={empty.title}
                    description={empty.description}
                />
            ) : (
                <ol
                    className={styles.list}
                    aria-label={label}
                >
                    {items.map((item, index) => {
                        const itemLabel = getItemLabel(item, index);
                        const labelId = `${baseId}-row-${index}`;
                        const moves = getMoves?.(item, index) ?? {
                            up: index > 0,
                            down: index < items.length - 1
                        };
                        return (
                            <li
                                key={getKey(item, index)}
                                className={styles.row}
                                aria-labelledby={labelId}
                            >
                                <div className={styles.head}>
                                    <p
                                        id={labelId}
                                        className={styles.rowLabel}
                                    >
                                        {itemLabel}
                                    </p>
                                    <div className={styles.actions}>
                                        {onMove ? (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="lg"
                                                    iconOnly
                                                    aria-label={t(
                                                        'account.ui.repeater.moveUp',
                                                        undefined,
                                                        {
                                                            item: itemLabel
                                                        }
                                                    )}
                                                    disabled={disabled || !moves.up}
                                                    onClick={() => onMove(index, -1)}
                                                >
                                                    <ChevronUpIcon
                                                        size="sm"
                                                        aria-hidden="true"
                                                    />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="lg"
                                                    iconOnly
                                                    aria-label={t(
                                                        'account.ui.repeater.moveDown',
                                                        undefined,
                                                        {
                                                            item: itemLabel
                                                        }
                                                    )}
                                                    disabled={disabled || !moves.down}
                                                    onClick={() => onMove(index, 1)}
                                                >
                                                    <ChevronDownIcon
                                                        size="sm"
                                                        aria-hidden="true"
                                                    />
                                                </Button>
                                            </>
                                        ) : null}
                                        {renderItemActions?.(item, index)}
                                        {onRemove ? (
                                            <Button
                                                variant="danger-ghost"
                                                size="lg"
                                                aria-label={t(
                                                    'account.ui.repeater.remove',
                                                    undefined,
                                                    {
                                                        item: itemLabel
                                                    }
                                                )}
                                                disabled={disabled}
                                                onClick={() => {
                                                    void askAndRemove(item, index);
                                                }}
                                            >
                                                {t('account.ui.repeater.removeShort')}
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                                <div className={styles.body}>{renderItem(item, index)}</div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {onAdd ? (
                <div className={styles.footer}>
                    <Button
                        variant="secondary"
                        size="lg"
                        disabled={disabled || !canAdd}
                        onClick={onAdd}
                    >
                        <AddIcon
                            size="sm"
                            aria-hidden="true"
                        />
                        {addLabel ?? t('account.ui.repeater.add')}
                    </Button>
                </div>
            ) : null}

            {confirmDialog}
        </div>
    );
}

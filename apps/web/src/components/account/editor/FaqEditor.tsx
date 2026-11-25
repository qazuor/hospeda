/** Shared FAQ presentation. Each consumer retains its own state and endpoints. */
import { ChevronDownIcon, ChevronUpIcon, FaqsIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { Button, Disclosure, Repeater, Section, StatusPill } from '@/components/account/ui';
import { useConfirm } from '@/components/account/ui/use-confirm';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createT, type SupportedLocale, type TranslationFn } from '@/lib/i18n';
import styles from './FaqEditor.module.css';
import type { FaqValues } from './FaqEditorFields';

/** Minimum FAQ row contract shared by the three verticals. */
export interface FaqItem extends FaqValues {
    readonly id: string;
}

/** Presentation inputs. Forms are slots so state never crosses verticals. */
export interface FaqEditorProps<T extends FaqItem> {
    readonly locale: SupportedLocale;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    readonly namespace: string;
    readonly t: TranslationFn;
    readonly items: readonly T[];
    readonly disabled: boolean;
    readonly isAdding: boolean;
    readonly editingId: string | null;
    readonly error: string | null;
    readonly summary?: string;
    readonly rowLabel: (item: T, index: number) => string;
    readonly onAdd: () => void;
    readonly onEdit: (item: T) => void;
    readonly onMove: (index: number, delta: -1 | 1) => void;
    readonly onRemove: (index: number) => void | Promise<void>;
    readonly renderEdit: (item: T) => ReactNode;
    readonly addForm: ReactNode;
}

/** Kit surface, collapsed help and one consistent action group AFTER each answer. */
export function FaqEditor<T extends FaqItem>(props: FaqEditorProps<T>) {
    const {
        locale,
        vertical,
        namespace,
        t,
        items,
        disabled,
        isAdding,
        editingId,
        error,
        summary,
        rowLabel,
        onAdd,
        onEdit,
        onMove,
        onRemove,
        renderEdit,
        addForm
    } = props;
    const kitT = createT(locale);
    const { confirm: askToConfirm, confirmDialog } = useConfirm({ locale });
    const label = (key: string, fallback?: string) => t(`${namespace}.${key}`, fallback);
    const remove = async (item: T, index: number) => {
        if (
            await askToConfirm({
                title: label('deleteDialogTitle', 'Eliminar pregunta'),
                description: (
                    <>
                        {label('deleteConfirm', '¿Eliminás esta pregunta?')}{' '}
                        <strong>{item.question}</strong>
                    </>
                ),
                confirmLabel: label('deleteConfirmButton', 'Eliminar pregunta')
            })
        )
            await onRemove(index);
    };
    return (
        <Section
            title={kitT('account.editorPresentation.faqTitle')}
            helpId={sectionHelpId({ vertical, slug: 'preguntas' })}
        >
            <div className={styles.stack}>
                {summary && <p>{summary}</p>}
                <Disclosure
                    summary={label(
                        'channelIntro.title',
                        '¿Por qué ocultar o restringir una pregunta?'
                    )}
                >
                    {['body1', 'body2', 'body3', 'body4'].map((key) => (
                        <p key={key}>{label(`channelIntro.${key}`)}</p>
                    ))}
                </Disclosure>
                {error && <p role="alert">{error}</p>}
                <Repeater
                    locale={locale}
                    label={kitT('account.editorPresentation.faqTitle')}
                    items={items}
                    getKey={(item) => item.id}
                    getItemLabel={rowLabel}
                    disabled={disabled}
                    canAdd={!isAdding}
                    onAdd={onAdd}
                    addLabel={label('addButton', 'Agregar pregunta')}
                    empty={
                        isAdding
                            ? undefined
                            : {
                                  icon: (
                                      <FaqsIcon
                                          size={28}
                                          aria-hidden="true"
                                      />
                                  ),
                                  title: label(
                                      'emptyState',
                                      'Todavía no hay preguntas. Agregá la primera.'
                                  ),
                                  description: label('emptyDescription')
                              }
                    }
                    renderItem={(item, index) =>
                        editingId === item.id ? (
                            renderEdit(item)
                        ) : (
                            <div>
                                {rowLabel(item, index) !== item.question && <p>{item.question}</p>}
                                <div className={styles.actions}>
                                    {!item.isVisibleOnListing && (
                                        <StatusPill tone="neutral">
                                            {label('notVisibleBadge', 'No visible en la ficha')}
                                        </StatusPill>
                                    )}
                                    {!item.isUsableByAi && (
                                        <StatusPill tone="neutral">
                                            {label('notAiUsableBadge', 'No usable por IA')}
                                        </StatusPill>
                                    )}
                                </div>
                                <p className={styles.answer}>{item.answer}</p>
                                <div className={styles.actions}>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        iconOnly
                                        disabled={disabled || index === 0}
                                        aria-label={kitT('account.ui.repeater.moveUp', undefined, {
                                            item: rowLabel(item, index)
                                        })}
                                        onClick={() => onMove(index, -1)}
                                    >
                                        <ChevronUpIcon
                                            size="sm"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        iconOnly
                                        disabled={disabled || index === items.length - 1}
                                        aria-label={kitT(
                                            'account.ui.repeater.moveDown',
                                            undefined,
                                            {
                                                item: rowLabel(item, index)
                                            }
                                        )}
                                        onClick={() => onMove(index, 1)}
                                    >
                                        <ChevronDownIcon
                                            size="sm"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        disabled={disabled}
                                        aria-label={t(
                                            `${namespace}.editAria`,
                                            'Editar "{{question}}"',
                                            {
                                                question: rowLabel(item, index)
                                            }
                                        )}
                                        onClick={() => onEdit(item)}
                                    >
                                        {label('editButton', 'Editar')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        disabled={disabled}
                                        aria-label={kitT('account.ui.repeater.remove', undefined, {
                                            item: rowLabel(item, index)
                                        })}
                                        onClick={() => void remove(item, index)}
                                    >
                                        {kitT('account.ui.repeater.removeShort')}
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                />
                {isAdding && addForm}
                {confirmDialog}
            </div>
        </Section>
    );
}

/**
 * @file ListingFaqManager.client.tsx
 * @description Owner FAQ manager island for a listing (SPEC-253 T-024).
 *
 * Provides a full FAQ CRUD UI wired to the protected FAQ endpoints:
 *   POST   /{vertical}/{id}/faqs           — add
 *   PUT    /{vertical}/{id}/faqs/{faqId}   — update
 *   DELETE /{vertical}/{id}/faqs/{faqId}   — remove
 *   PUT    /{vertical}/{id}/faqs/reorder   — reorder
 *
 * Design:
 * - The list chrome is the kit `Repeater` (HOS-2490, spec HOS-2415 §6.5): the
 *   per-row label (the question), move up / down, «Quitar» with its built-in
 *   confirmation (HOS-2429), the add button and the empty state. Cancel on the
 *   confirmation leaves the row untouched.
 * - Per-row extras go in the row: «Editar» (edit toggle) and, in the body, the
 *   channel-visibility markers (HOS-400) and the answer.
 * - Save model is `auto`: each action persists immediately. This island does
 *   NOT participate in the parent editor's dirty / PATCH payload and has no
 *   save bar or leave guard — FAQs have their own endpoints. That is what the
 *   editor's "No hay cambios para guardar" means when a FAQ is on screen: the
 *   general save button never carried FAQs and never will.
 * - State and requests live in `use-listing-faq-manager.ts`; the form fields
 *   in `ListingFaqEditorFields.client.tsx`.
 *
 * HOS-811 — a blank field is an ERROR, never a silent `return`: refusing to
 * submit an empty FAQ is correct, refusing SILENTLY leaves the owner with no
 * next move ("se aprieta Guardar, y no pasa nada").
 *
 * HOS-400 — the two channel-visibility checkboxes (`isVisibleOnListing` /
 * `isUsableByAi`), adopting the pattern HOS-393 shipped for the accommodation
 * editor (`FaqSection.client.tsx`). Both default to checked.
 */

import { EyeOffIcon, SparkleIcon } from '@repo/icons';
import type { JSX } from 'react';
import { Button } from '@/components/account/ui/Button';
import { Repeater } from '@/components/account/ui/Repeater';
import type { SupportedLocale } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { ListingFaqAiDraft } from './ListingFaqAiDraft.client';
import { ListingFaqEditorFields } from './ListingFaqEditorFields.client';
import styles from './ListingFaqManager.module.css';
import { hasNonDefaultChannelState, type ListingFaq } from './listing-faq-helpers';
import { useListingFaqManager } from './use-listing-faq-manager';

export type { ListingFaq } from './listing-faq-helpers';

/** Props for ListingFaqManager. */
export interface ListingFaqManagerProps {
    /** Which vertical this listing belongs to (drives the endpoint path). */
    readonly vertical: VenueOrExperience;
    /** UUID of the listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Pre-fetched FAQs from the SSR listing detail (may be empty). */
    readonly initialFaqs: readonly ListingFaq[];
}

/**
 * ListingFaqManager
 *
 * Owner FAQ management UI — list, add, edit, reorder and delete FAQs for a
 * listing. Each action calls the appropriate protected FAQ endpoint directly
 * (not via the parent editor's PATCH path).
 *
 * @param props - See {@link ListingFaqManagerProps}.
 * @returns The FAQ manager section.
 */
export function ListingFaqManager({
    vertical,
    listingId,
    locale,
    initialFaqs
}: ListingFaqManagerProps): JSX.Element {
    const manager = useListingFaqManager({ vertical, listingId, locale, initialFaqs });
    const { t, faqs, busyId, isAdding } = manager;

    return (
        <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
                {t('listing.owner.editor.faqManager.sectionTitle', 'Preguntas frecuentes')}
            </h3>

            <div className={styles.channelIntro}>
                <p className={styles.channelIntroBody}>
                    {t(
                        'listing.owner.editor.faqManager.channelIntro.summary',
                        'Elegí si cada pregunta se ve en la ficha y si el asistente de chat puede usarla.'
                    )}
                </p>
                <details className={styles.channelIntroDetails}>
                    <summary className={styles.channelIntroTitle}>
                        {t(
                            'listing.owner.editor.faqManager.channelIntro.title',
                            '¿Por qué ocultar o restringir una pregunta?'
                        )}
                    </summary>
                    <p className={styles.channelIntroBody}>
                        {t(
                            'listing.owner.editor.faqManager.channelIntro.body1',
                            '"Visible en la ficha pública" muestra la pregunta en la página del local y en los resultados de los buscadores. "Usable por la IA" permite que el asistente de chat use esta pregunta para responder consultas.'
                        )}
                    </p>
                    <p className={styles.channelIntroBody}>
                        {t(
                            'listing.owner.editor.faqManager.channelIntro.body2',
                            'Destildá "Visible en la ficha pública" para información útil pero que no querés publicar: algo temporal, un margen que preferís no prometer por escrito, o una recomendación que suena mejor en una conversación que en la vidriera.'
                        )}
                    </p>
                    <p className={styles.channelIntroBody}>
                        {t(
                            'listing.owner.editor.faqManager.channelIntro.body3',
                            'Destildá "Usable por la IA" para contenido que preferís que se muestre tal cual, sin que el asistente lo parafrasee.'
                        )}
                    </p>
                    <p className={styles.channelIntroNote}>
                        {t(
                            'listing.owner.editor.faqManager.channelIntro.body4',
                            'Importante: una pregunta no visible en la ficha pero usable por la IA no es privada. El asistente se la puede decir a cualquiera que pregunte por chat; solo no aparece publicada en la página.'
                        )}
                    </p>
                </details>
            </div>

            {manager.actionError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {manager.actionError}
                </p>
            )}

            <Repeater
                locale={locale}
                label={t('listing.owner.editor.faqManager.sectionTitle', 'Preguntas frecuentes')}
                items={faqs}
                getKey={(faq) => faq.id}
                getItemLabel={(faq) => faq.question}
                disabled={busyId !== null}
                getMoves={(faq, index) => ({
                    up: index > 0 && busyId !== faq.id,
                    down: index < faqs.length - 1 && busyId !== faq.id
                })}
                onMove={(index, delta) => void manager.moveAt(index, delta)}
                onRemove={manager.removeAt}
                getRemoveConfirm={(faq) => ({
                    title: t(
                        'listing.owner.editor.faqManager.deleteDialogTitle',
                        'Eliminar pregunta'
                    ),
                    description: (
                        <>
                            <span>
                                {t(
                                    'listing.owner.editor.faqManager.deleteConfirm',
                                    '¿Eliminás esta pregunta?'
                                )}
                            </span>{' '}
                            <strong>{faq.question}</strong>
                        </>
                    ),
                    confirmLabel: t(
                        'listing.owner.editor.faqManager.deleteConfirmButton',
                        'Eliminar pregunta'
                    )
                })}
                onAdd={isAdding ? undefined : manager.startAdd}
                addLabel={t('listing.owner.editor.faqManager.addButton', 'Agregar pregunta')}
                empty={
                    isAdding
                        ? undefined
                        : {
                              title: t(
                                  'listing.owner.editor.faqManager.emptyState',
                                  'Todavía no hay preguntas. Agregá la primera.'
                              )
                          }
                }
                renderItemActions={(faq) =>
                    manager.editingId === faq.id ? null : (
                        <Button
                            variant="secondary"
                            size="lg"
                            disabled={busyId === faq.id}
                            onClick={() => manager.startEdit(faq)}
                        >
                            {t('listing.owner.editor.faqManager.editButton', 'Editar')}
                        </Button>
                    )
                }
                renderItem={(faq) =>
                    manager.editingId === faq.id ? (
                        <ListingFaqEditorFields
                            questionId={`faq-q-${faq.id}`}
                            answerId={`faq-a-${faq.id}`}
                            values={manager.editValues}
                            errors={manager.editErrors}
                            onChange={(patch) => manager.setEditValues((v) => ({ ...v, ...patch }))}
                            isBusy={busyId === faq.id}
                            onSave={() => void manager.submitEdit(faq.id)}
                            onCancel={manager.cancelEdit}
                            t={t}
                        />
                    ) : (
                        <>
                            {hasNonDefaultChannelState(faq) && (
                                <div className={styles.badgeRow}>
                                    {!faq.isVisibleOnListing && (
                                        <span className={styles.badge}>
                                            <EyeOffIcon
                                                size="xs"
                                                weight="regular"
                                                aria-hidden="true"
                                            />
                                            {t(
                                                'listing.owner.editor.faqManager.notVisibleBadge',
                                                'No visible en la ficha'
                                            )}
                                        </span>
                                    )}
                                    {!faq.isUsableByAi && (
                                        <span className={styles.badge}>
                                            <SparkleIcon
                                                size="xs"
                                                weight="regular"
                                                aria-hidden="true"
                                            />
                                            {t(
                                                'listing.owner.editor.faqManager.notAiUsableBadge',
                                                'No usable por IA'
                                            )}
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className={styles.answer}>{faq.answer}</p>
                        </>
                    )
                }
            />

            {isAdding && (
                <ListingFaqEditorFields
                    questionId="faq-new-q"
                    answerId="faq-new-a"
                    values={manager.addValues}
                    errors={manager.addErrors}
                    onChange={(patch) => manager.setAddValues((v) => ({ ...v, ...patch }))}
                    isBusy={busyId === 'add'}
                    onSave={() => void manager.submitAdd()}
                    onCancel={manager.cancelAdd}
                    t={t}
                    answerExtra={
                        manager.prefillMessageId ? (
                            <>
                                <ListingFaqAiDraft
                                    locale={locale}
                                    vertical={vertical}
                                    messageId={manager.prefillMessageId}
                                    faqAiDraft={manager.faqAiDraft}
                                    isAiDraftContent={manager.isAiDraftContent}
                                    onDraft={manager.applyAiDraft}
                                    t={t}
                                />
                                {(manager.addValues.answer === '' ||
                                    manager.faqAiDraft.feedback === 'noData') && (
                                    <p>
                                        {t(
                                            'host.properties.editor.aiQuestions.faqAnswerHelp',
                                            'There is no confirmed answer. Fill it in using information from your listing.'
                                        )}
                                    </p>
                                )}
                            </>
                        ) : null
                    }
                />
            )}
        </section>
    );
}

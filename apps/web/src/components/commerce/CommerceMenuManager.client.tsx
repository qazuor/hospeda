/**
 * @file CommerceMenuManager.client.tsx
 * @description The owner's carta editor for a gastronomy listing (HOS-895).
 *
 * ## Three ways to show a menu, side by side
 *
 * A small restaurant rarely has a published menu page, and before HOS-895 a
 * link to one was the only thing this product could store. This panel offers
 * the two others next to it:
 *
 *  - the **structured carta** — courses and dishes, typed;
 *  - an **uploaded photo or PDF** of the printed menu.
 *
 * The external link stays where it already was, in `PriceSection`. Nothing here
 * is mandatory and nothing here excludes anything else: an owner may publish
 * with a photo alone, and is never made to type forty dishes.
 *
 * ## Why this manager persists on its own, like `CommerceFaqManager`
 *
 * The parent editor's PATCH body is a diff of `CommerceEditData`, and a carta is
 * a nested document with its own endpoints. It is mounted inside the form for
 * layout, exactly as the FAQ manager is, but nothing here reaches the parent's
 * dirty tracking (HOS-811).
 *
 * The two halves persist DIFFERENTLY, and deliberately:
 *
 *  - the carta is saved by an explicit button, in one `PUT` of the whole
 *    document — a course renamed, a dish moved and two deleted is one thought
 *    and one transaction;
 *  - the file is persisted by the upload request ITSELF, with no Save, because
 *    it is a real Cloudinary asset. HOS-372 measured what deferring that costs:
 *    an owner who uploads and walks away leaves the asset billing with nothing
 *    pointing at it.
 *
 * ## The 403 is a real state, not an error
 *
 * The structured carta is a `gastronomy-pro` capability, and the page this
 * mounts on carries no entitlement information — the same situation
 * `BrochureDownloadButton` is in. So the fields render for every owner and the
 * API decides; a refusal is shown as the upsell sentence it is, never as
 * "something went wrong". The uploaded file and the link are NOT gated and stay
 * usable on every tier.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/commerce/price-units';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceMenuManager.module.css';

/** What the API returns for the uploaded photo/PDF. */
interface MenuFile {
    readonly url: string;
    readonly kind: 'image' | 'pdf';
}

/** One dish, as held in form state. Ids are not carried — see the payload schema. */
interface MenuItemDraft {
    name: string;
    description: string;
    /** Price in CENTAVOS, or `null` for "a consultar". */
    priceCents: number | null;
    isAvailable: boolean;
}

/** One course, as held in form state. */
interface MenuSectionDraft {
    name: string;
    description: string;
    items: MenuItemDraft[];
}

/** Shape of `GET /{id}/menu`. */
interface MenuEnvelope {
    readonly sections: ReadonlyArray<{
        readonly name: string;
        readonly description: string | null;
        readonly items: ReadonlyArray<{
            readonly name: string;
            readonly description: string | null;
            readonly priceCents: number | null;
            readonly isAvailable: boolean;
        }>;
    }>;
    readonly file: MenuFile | null;
}

export interface CommerceMenuManagerProps {
    /** UUID of the gastronomy listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

const EMPTY_ITEM: MenuItemDraft = {
    name: '',
    description: '',
    priceCents: null,
    isAvailable: true
};

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving' | 'uploading';

/** MIME types the upload input and the API both accept. */
const ACCEPTED_MENU_FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

/** Moves one entry of an array, returning a new array. Out-of-range is a no-op. */
function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
        return [...list];
    }
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) {
        next.splice(target, 0, moved);
    }
    return next;
}

export function CommerceMenuManager({ listingId, locale }: CommerceMenuManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [sections, setSections] = useState<MenuSectionDraft[]>([]);
    const [file, setFile] = useState<MenuFile | null>(null);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    const basePath = `/api/v1/protected/gastronomies/${listingId}/menu`;

    // ── Load ────────────────────────────────────────────────────────────────
    // The panel reads its own state rather than receiving it from the SSR page:
    // the carta is not part of the listing payload the editor is built from, and
    // adding it there would make every editor load pay for a nested document
    // most owners will not open.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.get<MenuEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                setSections(
                    result.data.sections.map((section) => ({
                        name: section.name,
                        description: section.description ?? '',
                        items: section.items.map((item) => ({
                            name: item.name,
                            description: item.description ?? '',
                            priceCents: item.priceCents,
                            isAvailable: item.isAvailable
                        }))
                    }))
                );
                setFile(result.data.file);
            }
            setState('idle');
        })();

        return () => {
            cancelled = true;
        };
    }, [basePath]);

    // ── Structured carta ────────────────────────────────────────────────────

    const addSection = useCallback(() => {
        setSections((prev) => [...prev, { name: '', description: '', items: [] }]);
    }, []);

    const removeSection = useCallback((index: number) => {
        setSections((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveSection = useCallback((index: number, delta: number) => {
        setSections((prev) => movedBy(prev, index, delta));
    }, []);

    const patchSection = useCallback((index: number, patch: Partial<MenuSectionDraft>) => {
        setSections((prev) =>
            prev.map((section, i) => (i === index ? { ...section, ...patch } : section))
        );
    }, []);

    const addItem = useCallback((sectionIndex: number) => {
        setSections((prev) =>
            prev.map((section, i) =>
                i === sectionIndex
                    ? { ...section, items: [...section.items, { ...EMPTY_ITEM }] }
                    : section
            )
        );
    }, []);

    const removeItem = useCallback((sectionIndex: number, itemIndex: number) => {
        setSections((prev) =>
            prev.map((section, i) =>
                i === sectionIndex
                    ? { ...section, items: section.items.filter((_, j) => j !== itemIndex) }
                    : section
            )
        );
    }, []);

    const patchItem = useCallback(
        (sectionIndex: number, itemIndex: number, patch: Partial<MenuItemDraft>) => {
            setSections((prev) =>
                prev.map((section, i) =>
                    i === sectionIndex
                        ? {
                              ...section,
                              items: section.items.map((item, j) =>
                                  j === itemIndex ? { ...item, ...patch } : item
                              )
                          }
                        : section
                )
            );
        },
        []
    );

    const saveMenu = useCallback(async () => {
        setState('saving');
        setMessage(null);

        // Sections without a heading are DROPPED rather than rejected: an empty
        // row is what an owner leaves behind after clicking "add course" and
        // changing their mind, and failing the whole save over it would lose the
        // forty dishes they did type. Same for a nameless dish.
        const payload = {
            sections: sections
                .filter((section) => section.name.trim().length > 0)
                .map((section) => ({
                    name: section.name.trim(),
                    description: section.description.trim() || null,
                    items: section.items
                        .filter((item) => item.name.trim().length > 0)
                        .map((item) => ({
                            name: item.name.trim(),
                            description: item.description.trim() || null,
                            priceCents: item.priceCents,
                            isAvailable: item.isAvailable
                        }))
                }))
        };

        const result = await apiClient.put<MenuEnvelope>({ path: basePath, body: payload });
        setState('idle');

        if (result.ok) {
            setMessage(t('commerce.owner.editor.menuManager.saved', 'Carta guardada.'));
            return;
        }

        // A refusal here is the plan speaking, not a failure. `status` is the
        // only thing that separates "your plan does not include this" from a
        // genuine error, and showing the second for the first is how an upsell
        // turns into a bug report.
        if (result.error.status === 403) {
            setIsLocked(true);
            setMessage(
                t(
                    'commerce.owner.editor.menuManager.locked',
                    'Cargar la carta plato por plato está disponible desde el plan Profesional. Mientras tanto podés subir una foto o un PDF del menú, o dejar el enlace.'
                )
            );
            return;
        }

        setMessage(
            t('commerce.owner.editor.menuManager.saveError', 'No se pudo guardar la carta.')
        );
    }, [basePath, sections, t]);

    // ── The uploaded photo / PDF ────────────────────────────────────────────

    const uploadFile = useCallback(
        async (selected: File) => {
            setState('uploading');
            setMessage(null);

            // A raw `fetch` rather than `apiClient`: this is multipart, and the
            // API is a different origin, so the call needs `credentials:
            // 'include'` to travel with the session cookie — the same shape
            // `MediaSection` and `BrochureDownloadButton` use.
            const body = new FormData();
            body.append('file', selected);

            let response: Response | undefined;
            try {
                response = await fetch(`${getApiUrl()}${basePath}-file`, {
                    method: 'POST',
                    credentials: 'include',
                    body
                });
            } catch {
                response = undefined;
            }

            setState('idle');

            if (!response?.ok) {
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.uploadError',
                        'No se pudo subir el archivo del menú.'
                    )
                );
                return;
            }

            const payload = (await response.json()) as { data?: { file?: MenuFile } };
            if (payload.data?.file) {
                setFile(payload.data.file);
                setMessage(
                    t('commerce.owner.editor.menuManager.uploaded', 'Archivo del menú subido.')
                );
            }
        },
        [basePath, t]
    );

    const deleteFile = useCallback(async () => {
        setState('saving');
        setMessage(null);

        const result = await apiClient.delete<{ success: boolean }>({ path: `${basePath}-file` });
        setState('idle');

        if (result.ok) {
            setFile(null);
            setMessage(
                t('commerce.owner.editor.menuManager.fileRemoved', 'Archivo del menú eliminado.')
            );
            return;
        }

        setMessage(
            t(
                'commerce.owner.editor.menuManager.deleteError',
                'No se pudo eliminar el archivo del menú.'
            )
        );
    }, [basePath, t]);

    const busy = state !== 'idle';

    return (
        <section
            className={styles.panel}
            id="editor-menu"
        >
            <h2 className={styles.heading}>
                {t('commerce.owner.editor.menuManager.title', 'Carta')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'commerce.owner.editor.menuManager.intro',
                    'Cargá tu carta plato por plato, o subí una foto o un PDF del menú. Podés usar las dos formas, y ninguna es obligatoria.'
                )}
            </p>

            {/* ── The uploaded photo / PDF ──────────────────────────────── */}
            <div className={styles.fileBlock}>
                <h3 className={styles.subheading}>
                    {t('commerce.owner.editor.menuManager.fileTitle', 'Foto o PDF del menú')}
                </h3>

                {file ? (
                    <div className={styles.fileRow}>
                        <a
                            className={styles.fileLink}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {file.kind === 'pdf'
                                ? t('commerce.owner.editor.menuManager.filePdf', 'Ver el PDF')
                                : t('commerce.owner.editor.menuManager.fileImage', 'Ver la foto')}
                        </a>
                        <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={busy}
                            onClick={() => {
                                void deleteFile();
                            }}
                        >
                            {t('commerce.owner.editor.menuManager.removeFile', 'Eliminar')}
                        </button>
                    </div>
                ) : null}

                <label className={styles.uploadLabel}>
                    <span>
                        {file
                            ? t(
                                  'commerce.owner.editor.menuManager.replaceFile',
                                  'Reemplazar el archivo'
                              )
                            : t('commerce.owner.editor.menuManager.addFile', 'Subir foto o PDF')}
                    </span>
                    <input
                        type="file"
                        accept={ACCEPTED_MENU_FILE_TYPES}
                        disabled={busy}
                        onChange={(event) => {
                            const selected = event.target.files?.[0];
                            // The input is cleared so choosing the SAME file
                            // again still fires `change`; without it a failed
                            // upload could not be retried.
                            event.target.value = '';
                            if (selected) {
                                void uploadFile(selected);
                            }
                        }}
                    />
                </label>
            </div>

            {/* ── The structured carta ──────────────────────────────────── */}
            <div className={styles.sectionsBlock}>
                <h3 className={styles.subheading}>
                    {t('commerce.owner.editor.menuManager.sectionsTitle', 'Platos por sección')}
                </h3>

                {sections.map((section, sectionIndex) => (
                    <fieldset
                        // Index-keyed on purpose: a draft row has no id, and the
                        // whole list is re-submitted as a document.
                        // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                        key={`section-${sectionIndex}`}
                        className={styles.sectionCard}
                    >
                        <legend className={styles.srOnly}>
                            {section.name ||
                                t('commerce.owner.editor.menuManager.newSection', 'Nueva sección')}
                        </legend>

                        <div className={styles.sectionHead}>
                            <input
                                className={styles.input}
                                type="text"
                                value={section.name}
                                placeholder={t(
                                    'commerce.owner.editor.menuManager.sectionNamePlaceholder',
                                    'Entradas, Principales, Postres…'
                                )}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.sectionName',
                                    'Nombre de la sección'
                                )}
                                onChange={(event) => {
                                    patchSection(sectionIndex, { name: event.target.value });
                                }}
                            />
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.moveSectionUp',
                                    'Subir la sección'
                                )}
                                onClick={() => {
                                    moveSection(sectionIndex, -1);
                                }}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.moveSectionDown',
                                    'Bajar la sección'
                                )}
                                onClick={() => {
                                    moveSection(sectionIndex, 1);
                                }}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={() => {
                                    removeSection(sectionIndex);
                                }}
                            >
                                {t('commerce.owner.editor.menuManager.removeSection', 'Quitar')}
                            </button>
                        </div>

                        {section.items.map((item, itemIndex) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                                key={`item-${sectionIndex}-${itemIndex}`}
                                className={styles.itemRow}
                            >
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={item.name}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemNamePlaceholder',
                                        'Nombre del plato'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemName',
                                        'Nombre del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            name: event.target.value
                                        });
                                    }}
                                />
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={item.description}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemDescriptionPlaceholder',
                                        'Ingredientes, porción…'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemDescription',
                                        'Descripción del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            description: event.target.value
                                        });
                                    }}
                                />
                                {/*
                                 * The owner types PESOS; the state is CENTAVOS,
                                 * because that is what the column stores. Both
                                 * directions come from `@/lib/commerce/price-units`
                                 * — a display that divides without an input that
                                 * multiplies would multiply the price by 100 on
                                 * every save (HOS-809).
                                 */}
                                <input
                                    className={styles.priceInput}
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={centsToPesosInputValue({ cents: item.priceCents })}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemPricePlaceholder',
                                        'A consultar'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemPrice',
                                        'Precio del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            priceCents: parsePesosInputToCents({
                                                raw: event.target.value
                                            })
                                        });
                                    }}
                                />
                                <label className={styles.availableLabel}>
                                    <input
                                        type="checkbox"
                                        checked={item.isAvailable}
                                        onChange={(event) => {
                                            patchItem(sectionIndex, itemIndex, {
                                                isAvailable: event.target.checked
                                            });
                                        }}
                                    />
                                    {t(
                                        'commerce.owner.editor.menuManager.itemAvailable',
                                        'Disponible'
                                    )}
                                </label>
                                <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => {
                                        removeItem(sectionIndex, itemIndex);
                                    }}
                                >
                                    {t('commerce.owner.editor.menuManager.removeItem', 'Quitar')}
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                addItem(sectionIndex);
                            }}
                        >
                            {t('commerce.owner.editor.menuManager.addItem', 'Agregar plato')}
                        </button>
                    </fieldset>
                ))}

                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={addSection}
                >
                    {t('commerce.owner.editor.menuManager.addSection', 'Agregar sección')}
                </button>

                {/*
                 * `type="button"`, like every control here: this panel lives
                 * INSIDE the editor's <form>, and a submit button would save the
                 * listing instead of the carta.
                 */}
                <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={busy || isLocked}
                    onClick={() => {
                        void saveMenu();
                    }}
                >
                    {state === 'saving'
                        ? t('commerce.owner.editor.menuManager.saving', 'Guardando…')
                        : t('commerce.owner.editor.menuManager.save', 'Guardar carta')}
                </button>
            </div>

            {message ? (
                <p
                    className={styles.message}
                    role="status"
                >
                    {message}
                </p>
            ) : null}
        </section>
    );
}

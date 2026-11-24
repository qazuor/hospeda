/**
 * @file VenueMenuDishFields.client.tsx
 * @description The fields of one dish of the carta (HOS-895): name,
 * description, translations (HOS-1043), price, availability and the photo
 * (HOS-1045). One row of the dishes `Repeater` (HOS-2490); the row chrome
 * (label, move, remove) belongs to the Repeater.
 */

import type { JSX } from 'react';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import styles from './VenueMenuManager.module.css';
import { VenueMenuTranslationFields } from './VenueMenuTranslationFields.client';
import { ACCEPTED_ITEM_PHOTO_TYPES, type MenuItemDraft } from './venue-menu-draft';

/** Props of {@link VenueMenuDishFields}. */
export interface VenueMenuDishFieldsProps {
    readonly t: TranslationFn;
    readonly locale: SupportedLocale;
    readonly item: MenuItemDraft;
    /** The carta cannot be edited (gate or refused save). */
    readonly readOnly: boolean;
    /** A request is in flight. */
    readonly busy: boolean;
    readonly isPhotoLocked: boolean;
    readonly isTranslationLocked: boolean;
    readonly translationPlanName?: string | null;
    readonly onPatch: (patch: Partial<MenuItemDraft>) => void;
    readonly onUploadPhoto: (file: File) => void;
    readonly onRemovePhoto: () => void;
}

/**
 * One dish's fields.
 *
 * @param props - See {@link VenueMenuDishFieldsProps}.
 * @returns The fields.
 */
export function VenueMenuDishFields({
    t,
    locale,
    item,
    readOnly,
    busy,
    isPhotoLocked,
    isTranslationLocked,
    translationPlanName,
    onPatch,
    onUploadPhoto,
    onRemovePhoto
}: VenueMenuDishFieldsProps): JSX.Element {
    return (
        <div className={styles.itemFields}>
            <Field
                locale={locale}
                label={t('venue.owner.editor.menuManager.itemName', 'Nombre del plato')}
            >
                <TextInput
                    value={item.name}
                    disabled={readOnly}
                    onChange={(event) => onPatch({ name: event.target.value })}
                />
            </Field>
            <Field
                locale={locale}
                label={t('venue.owner.editor.menuManager.itemDescription', 'Descripción del plato')}
                optional
            >
                <TextInput
                    value={item.description}
                    disabled={readOnly}
                    placeholder={t(
                        'venue.owner.editor.menuManager.itemDescriptionPlaceholder',
                        'Ingredientes, porción…'
                    )}
                    onChange={(event) => onPatch({ description: event.target.value })}
                />
            </Field>
            <VenueMenuTranslationFields
                nameEn={item.nameEn}
                namePt={item.namePt}
                descriptionEn={item.descriptionEn}
                descriptionPt={item.descriptionPt}
                hasDescription={true}
                locked={isTranslationLocked}
                locale={locale}
                planName={translationPlanName}
                onChange={onPatch}
            />
            {/*
             * The owner types PESOS; the state is CENTAVOS, because that is what
             * the column stores. Both directions come from `price-units` — a
             * display that divides without an input that multiplies would
             * multiply the price by 100 on every save (HOS-809).
             */}
            <div className={styles.itemInline}>
                <Field
                    locale={locale}
                    label={t('venue.owner.editor.menuManager.itemPrice', 'Precio del plato')}
                    hint={t(
                        'venue.owner.editor.menuManager.itemPriceHint',
                        'En pesos. Vacío es «a consultar».'
                    )}
                >
                    <TextInput
                        type="number"
                        min={0}
                        step={1}
                        inputMode="decimal"
                        disabled={readOnly}
                        value={centsToPesosInputValue({ cents: item.priceCents })}
                        placeholder={t(
                            'venue.owner.editor.menuManager.itemPricePlaceholder',
                            'A consultar'
                        )}
                        onChange={(event) =>
                            onPatch({
                                priceCents: parsePesosInputToCents({ raw: event.target.value })
                            })
                        }
                    />
                </Field>
                <Checkbox
                    label={t('venue.owner.editor.menuManager.itemAvailable', 'Disponible')}
                    checked={item.isAvailable}
                    disabled={readOnly}
                    onChange={(event) => onPatch({ isAvailable: event.target.checked })}
                />
            </div>

            {/*
             * The photo (HOS-1045), on the dish's OWN row — that placement is the
             * issue, not a detail. The preview needs no scheme gate: the value
             * came from our own upload route in this session, and the PUBLIC page
             * sanitises it anyway.
             */}
            <div className={styles.itemPhotoRow}>
                {item.photoUrl ? (
                    <img
                        className={styles.itemPhotoThumb}
                        src={item.photoUrl}
                        alt={
                            item.photoAlt ||
                            item.name ||
                            t('venue.owner.editor.menuManager.photoPreview', 'Foto del plato')
                        }
                    />
                ) : null}

                <label className={styles.itemPhotoLabel}>
                    <span>
                        {item.photoUrl
                            ? t('venue.owner.editor.menuManager.replacePhoto', 'Cambiar la foto')
                            : t('venue.owner.editor.menuManager.addPhoto', 'Agregar foto')}
                    </span>
                    <input
                        type="file"
                        accept={ACCEPTED_ITEM_PHOTO_TYPES}
                        disabled={readOnly || busy || isPhotoLocked}
                        onChange={(event) => {
                            const selected = event.target.files?.[0];
                            // Cleared so choosing the SAME file again still fires `change`.
                            event.target.value = '';
                            if (selected) {
                                onUploadPhoto(selected);
                            }
                        }}
                    />
                </label>

                {item.photoUrl ? (
                    <>
                        <Field
                            locale={locale}
                            label={t(
                                'venue.owner.editor.menuManager.photoAlt',
                                'Texto alternativo de la foto'
                            )}
                            optional
                        >
                            <TextInput
                                value={item.photoAlt ?? ''}
                                disabled={readOnly}
                                placeholder={t(
                                    'venue.owner.editor.menuManager.photoAltPlaceholder',
                                    'Describí la foto (opcional)'
                                )}
                                onChange={(event) =>
                                    onPatch({ photoAlt: event.target.value || null })
                                }
                            />
                        </Field>
                        {/*
                         * Stays enabled while `isPhotoLocked`: removing the photo is
                         * the way OUT of that state, so it is the one control the
                         * lock must not take away.
                         */}
                        <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={readOnly}
                            onClick={onRemovePhoto}
                        >
                            {t('venue.owner.editor.menuManager.removePhoto', 'Quitar la foto')}
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}

/**
 * @file VenueMenuCourses.client.tsx
 * @description The structured carta (HOS-895): a `Repeater` of courses, each
 * with its translations and a nested `Repeater` of dishes (HOS-2490). Every
 * edit lands in the local draft; the editor save bar commits it (HOS-2487).
 */

import type { JSX } from 'react';
import { Field } from '@/components/account/ui/Field';
import { Repeater } from '@/components/account/ui/Repeater';
import { TextInput } from '@/components/account/ui/TextInput';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import type { VenueMenuState } from './use-venue-menu';
import { VenueMenuDishFields } from './VenueMenuDishFields.client';
import styles from './VenueMenuManager.module.css';
import { VenueMenuTranslationFields } from './VenueMenuTranslationFields.client';

/** Props of {@link VenueMenuCourses}. */
export interface VenueMenuCoursesProps {
    readonly t: TranslationFn;
    readonly locale: SupportedLocale;
    readonly menu: VenueMenuState;
    /** The carta cannot be edited (gate or refused save). */
    readonly readOnly: boolean;
    readonly translationPlanName?: string | null;
}

/**
 * The courses and their dishes.
 *
 * @param props - See {@link VenueMenuCoursesProps}.
 * @returns The two-level repeater.
 */
export function VenueMenuCourses({
    t,
    locale,
    menu,
    readOnly,
    translationPlanName
}: VenueMenuCoursesProps): JSX.Element {
    const busy = menu.state !== 'idle';
    const newSection = t('venue.owner.editor.menuManager.newSection', 'Nueva sección');
    const newDish = t('venue.owner.editor.menuManager.newItem', 'Nuevo plato');

    return (
        <div className={styles.sectionsBlock}>
            <h3 className={styles.subheading}>
                {t('venue.owner.editor.menuManager.sectionsTitle', 'Platos por sección')}
            </h3>

            <Repeater
                locale={locale}
                label={t('venue.owner.editor.menuManager.sectionsTitle', 'Platos por sección')}
                items={menu.sections}
                // Index-keyed on purpose: a draft row has no id, and the whole list
                // is re-submitted as a document.
                getKey={(_section, index) => `section-${index}`}
                getItemLabel={(section) => section.name || newSection}
                disabled={readOnly}
                onMove={menu.moveSection}
                onRemove={menu.removeSection}
                // HOS-2429: removing a course drops all its dishes at once.
                getRemoveConfirm={() => ({
                    title: t(
                        'venue.owner.editor.menuManager.removeSectionConfirm.title',
                        'Quitar sección'
                    ),
                    description: t(
                        'venue.owner.editor.menuManager.removeSectionConfirm.message',
                        '¿Quitar esta sección y todos sus platos de la carta?'
                    ),
                    confirmLabel: t(
                        'venue.owner.editor.menuManager.removeSectionConfirm.confirm',
                        'Quitar sección'
                    )
                })}
                onAdd={menu.addSection}
                addLabel={t('venue.owner.editor.menuManager.addSection', 'Agregar sección')}
                renderItem={(section, sectionIndex) => (
                    <>
                        <Field
                            locale={locale}
                            label={t(
                                'venue.owner.editor.menuManager.sectionName',
                                'Nombre de la sección'
                            )}
                        >
                            <TextInput
                                value={section.name}
                                disabled={readOnly}
                                placeholder={t(
                                    'venue.owner.editor.menuManager.sectionNamePlaceholder',
                                    'Entradas, Principales, Postres…'
                                )}
                                onChange={(event) =>
                                    menu.patchSection(sectionIndex, { name: event.target.value })
                                }
                            />
                        </Field>

                        {/*
                         * HOS-1043. Name-only: this editor has no field for a
                         * section's `description`, so there is nothing for
                         * `hasDescription` to translate here.
                         */}
                        <VenueMenuTranslationFields
                            nameEn={section.nameEn}
                            namePt={section.namePt}
                            descriptionEn={section.descriptionEn}
                            descriptionPt={section.descriptionPt}
                            hasDescription={false}
                            locked={menu.isTranslationLocked}
                            locale={locale}
                            planName={translationPlanName}
                            onChange={(patch) => menu.patchSection(sectionIndex, patch)}
                        />

                        <Repeater
                            locale={locale}
                            label={t(
                                'venue.owner.editor.menuManager.itemsOf',
                                'Platos de {{section}}',
                                { section: section.name || newSection }
                            )}
                            items={section.items}
                            getKey={(_item, itemIndex) => `item-${sectionIndex}-${itemIndex}`}
                            getItemLabel={(item) => item.name || newDish}
                            disabled={readOnly}
                            onMove={(itemIndex, delta) =>
                                menu.moveItem(sectionIndex, itemIndex, delta)
                            }
                            onRemove={(itemIndex) => menu.removeItem(sectionIndex, itemIndex)}
                            // HOS-2429: same confirmation for a single dish.
                            getRemoveConfirm={() => ({
                                title: t(
                                    'venue.owner.editor.menuManager.removeItemConfirm.title',
                                    'Quitar plato'
                                ),
                                description: t(
                                    'venue.owner.editor.menuManager.removeItemConfirm.message',
                                    '¿Quitar este plato de la carta?'
                                ),
                                confirmLabel: t(
                                    'venue.owner.editor.menuManager.removeItemConfirm.confirm',
                                    'Quitar plato'
                                )
                            })}
                            onAdd={() => menu.addItem(sectionIndex)}
                            addLabel={t('venue.owner.editor.menuManager.addItem', 'Agregar plato')}
                            renderItem={(item, itemIndex) => (
                                <VenueMenuDishFields
                                    t={t}
                                    locale={locale}
                                    item={item}
                                    readOnly={readOnly}
                                    busy={busy}
                                    isPhotoLocked={menu.isPhotoLocked}
                                    isTranslationLocked={menu.isTranslationLocked}
                                    translationPlanName={translationPlanName}
                                    onPatch={(patch) =>
                                        menu.patchItem(sectionIndex, itemIndex, patch)
                                    }
                                    onUploadPhoto={(file) => {
                                        void menu.uploadItemPhoto(sectionIndex, itemIndex, file);
                                    }}
                                    onRemovePhoto={() =>
                                        menu.removeItemPhoto(sectionIndex, itemIndex)
                                    }
                                />
                            )}
                        />
                    </>
                )}
            />
        </div>
    );
}

/**
 * @file SeoSection.client.tsx
 * @description Form section for the accommodation's search-result override
 * (G7 smoke, H-121). Kit `Section` + `Field` controls since HOS-2503; the
 * field ids, counters and default previews are unchanged.
 *
 * IMPORTANT scope caveat, carried in the copy on purpose: the public detail
 * page only reads `seo.title`/`seo.description` as an override on the `es`
 * locale (`pickLocalizedSeo` in `apps/web/src/lib/seo.ts`) — `/en/` and `/pt/`
 * never consult it and fall back to the localized accommodation name. The
 * hint below says so explicitly rather than letting the host believe this
 * reaches all three locales.
 *
 * ## Showing the default instead of describing it (HOS-792)
 *
 * Both fields are optional, and the public page computes a fallback when they
 * are empty — the accommodation's name for the title, its summary for the
 * description. The real value is rendered: as the field's `placeholder` while
 * it is empty, plus a line naming it outright.
 *
 * Those values arrive as `seoTitleDefault` / `seoDescriptionDefault` and this
 * section must not recompute them from `data.name` / `data.summary`: the
 * public page resolves `nameI18n ?? name` and cross-falls `es → en → pt`, so
 * the raw columns can name a value the page will not publish.
 *
 * The placeholder makes the default distinguishable from authored text with no
 * state of its own: it cannot be submitted by accident, and clearing the field
 * brings it straight back. Pre-filling `value` instead would open the form
 * invalid (a name is routinely shorter than the title's 30-character minimum)
 * and send the default on the next save as if the host had typed it.
 */

import type { JSX } from 'react';
import { EditorSection } from '@/components/account/editor-shell/EditorSection';
import { Field } from '@/components/account/ui/Field';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { CharacterCounter } from '@/components/ui/CharacterCounter';
import type { AccommodationEditData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';
import styles from './SeoSection.module.css';

/**
 * Ids of the "this is what gets published" preview lines. They join the
 * control's `aria-describedby` so the sentence reaches a screen-reader user
 * too: the placeholder's announcement is inconsistent across assistive tech.
 */
const SEO_TITLE_PREVIEW_ID = `${ACCOMMODATION_FIELD_PREFIX}-seoTitle-default-preview`;
const SEO_DESCRIPTION_PREVIEW_ID = `${ACCOMMODATION_FIELD_PREFIX}-seoDescription-default-preview`;

const SEO_TITLE_ID = buildFieldId({ prefix: ACCOMMODATION_FIELD_PREFIX, name: 'seoTitle' });
const SEO_DESCRIPTION_ID = buildFieldId({
    prefix: ACCOMMODATION_FIELD_PREFIX,
    name: 'seoDescription'
});
const SEO_TITLE_COUNTER_ID = `${SEO_TITLE_ID}-counter`;
const SEO_DESCRIPTION_COUNTER_ID = `${SEO_DESCRIPTION_ID}-counter`;

/**
 * Both SEO fields are `union([literal(''), string().min(N).max(M)])` in
 * `AccommodationUpdateHttpSchema`: empty is a valid "no override", but once
 * typed they must clear the floor. The counters carry `optional` for that.
 */
const SEO_TITLE_MIN = 30;
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MIN = 70;
const SEO_DESCRIPTION_MAX = 160;

/**
 * Caps a value at the field's maximum, as a native `maxLength` would: the kit
 * `Textarea` takes no `maxLength` unless it draws its own counter, and this
 * section keeps the `CharacterCounter` that shows the minimum.
 */
function capLength(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
}

/** Joins describedby ids, skipping empty ones. */
function joinIds(...ids: readonly (string | false)[]): string {
    return ids.filter(Boolean).join(' ');
}

/** Props for SeoSection. */
export interface SeoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{ seoTitle?: string; seoDescription?: string }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * SEO override form section: the title/description that replace the
 * accommodation name in Google search results.
 *
 * @param props - See {@link SeoSectionProps}.
 * @returns One kit Section.
 */
export function SeoSection({ locale, data, errors, onFieldChange }: SeoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    // Already resolved by the transform with the public page's own rule. A
    // draft can have neither yet, so each is only shown once it exists.
    const titleDefault = data.seoTitleDefault;
    const descriptionDefault = data.seoDescriptionDefault;

    // One flag per preview, because the same condition gates the id handed to
    // `aria-describedby`: duplicating it would risk a dangling reference.
    const showTitlePreview = data.seoTitle === '' && titleDefault !== '';
    const showDescriptionPreview = data.seoDescription === '' && descriptionDefault !== '';

    return (
        <EditorSection
            locale={locale}
            id="editor-seo"
            title={t('host.properties.editor.section.seo', 'Buscadores (Google)')}
            description={t(
                'host.properties.editor.section.seoDescription',
                'Elegí cómo se muestra tu alojamiento cuando alguien lo encuentra en Google. Los dos campos son opcionales: si los dejás vacíos, publicamos el nombre y el resumen de tu propiedad.'
            )}
            helpId={sectionHelpId({ vertical: 'accommodation', slug: 'seo' })}
        >
            <div className={styles.stack}>
                <Field
                    locale={locale}
                    id={SEO_TITLE_ID}
                    label={t('host.properties.editor.field.seoTitle', 'Título para Google')}
                    hint={t(
                        'host.properties.editor.field.seoTitleHint',
                        'El título en negrita que se ve en el resultado de búsqueda. Por ahora solo se aplica en español — en inglés y portugués se sigue mostrando el nombre de tu propiedad.'
                    )}
                    error={errors.seoTitle}
                >
                    <TextInput
                        type="text"
                        value={data.seoTitle}
                        placeholder={titleDefault || undefined}
                        className={styles.defaultControl}
                        maxLength={SEO_TITLE_MAX}
                        aria-describedby={joinIds(
                            showTitlePreview && SEO_TITLE_PREVIEW_ID,
                            SEO_TITLE_COUNTER_ID
                        )}
                        onChange={(e) => onFieldChange('seoTitle', e.target.value)}
                    />
                    <CharacterCounter
                        id={SEO_TITLE_COUNTER_ID}
                        locale={locale}
                        current={data.seoTitle.length}
                        min={SEO_TITLE_MIN}
                        max={SEO_TITLE_MAX}
                        optional
                        testId="seo-title-char-counter"
                    />
                    {showTitlePreview ? (
                        <p
                            id={SEO_TITLE_PREVIEW_ID}
                            className={styles.defaultPreview}
                        >
                            {t(
                                'host.properties.editor.field.seoDefaultPreview',
                                'Si lo dejás vacío, se publica: «{{value}}»',
                                { value: titleDefault }
                            )}
                        </p>
                    ) : null}
                </Field>

                <Field
                    locale={locale}
                    id={SEO_DESCRIPTION_ID}
                    label={t(
                        'host.properties.editor.field.seoDescription',
                        'Descripción para Google'
                    )}
                    hint={t(
                        'host.properties.editor.field.seoDescriptionHint',
                        'El texto que se ve debajo del título en el resultado de búsqueda. Como el título, por ahora solo se aplica en español.'
                    )}
                    error={errors.seoDescription}
                >
                    <Textarea
                        value={data.seoDescription}
                        placeholder={descriptionDefault || undefined}
                        className={styles.defaultControl}
                        rows={3}
                        aria-describedby={joinIds(
                            showDescriptionPreview && SEO_DESCRIPTION_PREVIEW_ID,
                            SEO_DESCRIPTION_COUNTER_ID
                        )}
                        onChange={(e) =>
                            onFieldChange(
                                'seoDescription',
                                capLength(e.target.value, SEO_DESCRIPTION_MAX)
                            )
                        }
                    />
                    <CharacterCounter
                        id={SEO_DESCRIPTION_COUNTER_ID}
                        locale={locale}
                        current={data.seoDescription.length}
                        min={SEO_DESCRIPTION_MIN}
                        max={SEO_DESCRIPTION_MAX}
                        optional
                        testId="seo-description-char-counter"
                    />
                    {showDescriptionPreview ? (
                        <p
                            id={SEO_DESCRIPTION_PREVIEW_ID}
                            className={styles.defaultPreview}
                        >
                            {t(
                                'host.properties.editor.field.seoDefaultPreview',
                                'Si lo dejás vacío, se publica: «{{value}}»',
                                { value: descriptionDefault }
                            )}
                        </p>
                    ) : null}
                </Field>
            </div>
        </EditorSection>
    );
}

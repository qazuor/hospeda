/**
 * @file SeoSection.client.tsx
 * @description Form section for the accommodation's search-result override
 * (G7 smoke, H-121). Uses native HTML form elements.
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
 * description. They used to be described in prose ("se usa el nombre de tu
 * propiedad", for BOTH fields — which was only ever true of the title) and
 * never shown. Now the real value is rendered: as the field's `placeholder`
 * while it is empty, plus a line naming it outright.
 *
 * Those values arrive as `seoTitleDefault` / `seoDescriptionDefault` and this
 * section must not recompute them from `data.name` / `data.summary`. Those two
 * are the raw columns the host edits; the public page resolves
 * `nameI18n ?? name` for the `es` locale, and `resolveI18nText` cross-falls
 * `es → en → pt` — so an accommodation whose `nameI18n` holds only English
 * publishes an English title while `data.name` still reads in Spanish. Naming a
 * value the page will not publish is the exact defect this section was opened
 * to fix, one layer down.
 *
 * The placeholder is what makes the default distinguishable from authored text
 * without any state of its own: it is the browser's own "this is not your value"
 * rendering, it cannot be submitted by accident, and clearing the field brings
 * it straight back with no intermediate state to get wrong. Pre-filling the
 * control's `value` instead would have done the opposite — `name` is routinely
 * shorter than the title's 30-character minimum, so the form would open already
 * invalid, and the default would travel on the next save as if the host had
 * typed it.
 */

import { TextField } from '@/components/ui/TextField';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';
import styles from './SeoSection.module.css';

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

/** Props for SeoSection. */
export interface SeoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{ seoTitle?: string; seoDescription?: string }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * SEO override form section.
 * Renders the title/description that replace the accommodation name in
 * Google search results, plus a plain-language explanation of what they do.
 */
export function SeoSection({ locale, data, errors, onFieldChange }: SeoSectionProps) {
    const { t } = createTranslations(locale);

    // The values the public page falls back to, field by field, already
    // resolved by the transform with the page's own rule — NOT `data.name` /
    // `data.summary`, which are the raw columns and can differ (see
    // `AccommodationEditData.seoTitleDefault`). A draft can legitimately have
    // neither yet, so each is only shown once it exists: announcing an empty
    // default would be worse than announcing none.
    const titleDefault = data.seoTitleDefault;
    const descriptionDefault = data.seoDescriptionDefault;

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.seo', 'Buscadores (Google)')}
            </legend>
            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.section.seoDescription',
                    'Elegí cómo se muestra tu alojamiento cuando alguien lo encuentra en Google. Los dos campos son opcionales: si los dejás vacíos, publicamos el nombre y el resumen de tu propiedad.'
                )}
            </p>

            <div className={styles.field}>
                <TextField
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="seoTitle"
                    label={t('host.properties.editor.field.seoTitle', 'Título para Google')}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.seoTitle}
                    type="text"
                    value={data.seoTitle}
                    placeholder={titleDefault || undefined}
                    maxLength={SEO_TITLE_MAX}
                    counter={{ locale }}
                    onChange={(e) => onFieldChange('seoTitle', e.target.value)}
                />
                {data.seoTitle === '' && titleDefault !== '' && (
                    <p className={styles.defaultPreview}>
                        {t(
                            'host.properties.editor.field.seoDefaultPreview',
                            'Si lo dejás vacío, se publica: «{{value}}»',
                            { value: titleDefault }
                        )}
                    </p>
                )}
                <p className={styles.fieldHint}>
                    {t(
                        'host.properties.editor.field.seoTitleHint',
                        'El título en negrita que se ve en el resultado de búsqueda. Por ahora solo se aplica en español — en inglés y portugués se sigue mostrando el nombre de tu propiedad.'
                    )}
                </p>
            </div>

            <div className={styles.field}>
                <TextField
                    as="textarea"
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="seoDescription"
                    label={t(
                        'host.properties.editor.field.seoDescription',
                        'Descripción para Google'
                    )}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.seoDescription}
                    value={data.seoDescription}
                    placeholder={descriptionDefault || undefined}
                    maxLength={SEO_DESCRIPTION_MAX}
                    rows={3}
                    counter={{ locale }}
                    onChange={(e) => onFieldChange('seoDescription', e.target.value)}
                />
                {data.seoDescription === '' && descriptionDefault !== '' && (
                    <p className={styles.defaultPreview}>
                        {t(
                            'host.properties.editor.field.seoDefaultPreview',
                            'Si lo dejás vacío, se publica: «{{value}}»',
                            { value: descriptionDefault }
                        )}
                    </p>
                )}
                <p className={styles.fieldHint}>
                    {t(
                        'host.properties.editor.field.seoDescriptionHint',
                        'El texto que se ve debajo del título en el resultado de búsqueda. Como el título, por ahora solo se aplica en español.'
                    )}
                </p>
            </div>
        </fieldset>
    );
}

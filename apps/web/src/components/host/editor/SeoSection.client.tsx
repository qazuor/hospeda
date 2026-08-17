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

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.seo', 'Buscadores (Google)')}
            </legend>
            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.section.seoDescription',
                    'Elegí cómo se muestra tu alojamiento cuando alguien lo encuentra en Google. Si dejás estos campos vacíos, se usa el nombre de tu propiedad.'
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
                    maxLength={SEO_TITLE_MAX}
                    onChange={(e) => onFieldChange('seoTitle', e.target.value)}
                />
                <p className={styles.fieldHint}>
                    {t(
                        'host.properties.editor.field.seoTitleHint',
                        'El título en negrita que se ve en el resultado de búsqueda. Por ahora solo se aplica en español — en inglés y portugués se sigue mostrando el nombre de tu propiedad.'
                    )}
                </p>
                <p className={styles.charCount}>
                    {data.seoTitle.length}/{SEO_TITLE_MAX}
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
                    maxLength={SEO_DESCRIPTION_MAX}
                    rows={3}
                    onChange={(e) => onFieldChange('seoDescription', e.target.value)}
                />
                <p className={styles.fieldHint}>
                    {t(
                        'host.properties.editor.field.seoDescriptionHint',
                        'El texto que se ve debajo del título en el resultado de búsqueda. Como el título, por ahora solo se aplica en español.'
                    )}
                </p>
                <p className={styles.charCount}>
                    {data.seoDescription.length}/{SEO_DESCRIPTION_MAX}
                </p>
            </div>
        </fieldset>
    );
}

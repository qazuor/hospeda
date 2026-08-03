/**
 * @file BasicInfoSection.client.tsx
 * @description Identity + descriptive fields of the commerce owner editor
 * (HOS-258): name, destination, type, summary, description, rich description.
 *
 * Mirrors `host/editor/BasicInfoSection.client.tsx`: receives the whole
 * `data` object, a typed slice of `errors`, and the shared `onFieldChange`.
 * Renders a Fragment of sibling `<section>` elements rather than wrapping them
 * in a container — `.editor` is a flex column whose gap applies to its direct
 * children, so an extra wrapper would change the rendered spacing.
 */

import { ExperienceTypeEnum, GastronomyTypeEnum } from '@repo/schemas';
import type { JSX } from 'react';
import type { DestinationOption } from '@/components/gastronomy/CommerceLead.client';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';

/** Gastronomy type options in display order. */
const GASTRONOMY_TYPE_OPTIONS = Object.values(GastronomyTypeEnum);

/** Experience type options in display order. */
const EXPERIENCE_TYPE_OPTIONS = Object.values(ExperienceTypeEnum);

export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: CommerceVertical;
    readonly data: CommerceEditData;
    readonly destinations: readonly DestinationOption[];
    readonly destinationsLoadFailed: boolean;
    readonly errors: Readonly<{
        name?: string;
        destinationId?: string;
        summary?: string;
        description?: string;
    }>;
    readonly onFieldChange: CommerceFieldChange;
}

export function BasicInfoSection({
    locale,
    vertical,
    data,
    destinations,
    destinationsLoadFailed,
    errors,
    onFieldChange
}: BasicInfoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const typeOptions =
        vertical === 'gastronomy' ? GASTRONOMY_TYPE_OPTIONS : EXPERIENCE_TYPE_OPTIONS;

    return (
        <>
            {/* HOS-166 D-1: name — identity field, now owner-editable */}
            <section
                className={styles.section}
                id="editor-basicInfo"
            >
                <label
                    className={styles.label}
                    htmlFor="ce-name"
                >
                    {t('commerce.owner.editor.sections.name', 'Nombre del comercio')}
                </label>
                <input
                    id="ce-name"
                    className={styles.input}
                    type="text"
                    value={data.name}
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? fieldErrorId('name') : undefined}
                    onChange={(event) => {
                        onFieldChange('name', event.target.value);
                    }}
                />
                <FieldError
                    id={fieldErrorId('name')}
                    message={errors.name}
                />
            </section>

            {/* HOS-166 D-1: destinationId — identity field, now owner-editable.
                `destinationsLoadFailed` (judgment-day fix) surfaces a failed SSR
                catalog fetch explicitly instead of silently omitting a REQUIRED
                field (completeness needs `destinationId`) — see the prop's doc. */}
            {destinationsLoadFailed ? (
                <section className={styles.section}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.editor.sections.destinationLoadError',
                            'No pudimos cargar el listado de ciudades / destinos. Recargá la página para reintentar.'
                        )}
                    </p>
                </section>
            ) : destinations.length > 0 ? (
                <section className={styles.section}>
                    <label
                        className={styles.label}
                        htmlFor="ce-destinationId"
                    >
                        {t('commerce.owner.editor.sections.destination', 'Ciudad / Destino')}
                    </label>
                    <select
                        id="ce-destinationId"
                        className={styles.input}
                        value={data.destinationId}
                        aria-invalid={errors.destinationId ? 'true' : 'false'}
                        aria-describedby={
                            errors.destinationId ? fieldErrorId('destinationId') : undefined
                        }
                        onChange={(event) => {
                            onFieldChange('destinationId', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {destinations.map((d) => (
                            <option
                                key={d.id}
                                value={d.id}
                            >
                                {d.name}
                            </option>
                        ))}
                    </select>
                    <FieldError
                        id={fieldErrorId('destinationId')}
                        message={errors.destinationId}
                    />
                </section>
            ) : (
                // HOS-260: catalog fetch SUCCEEDED but returned zero rows. The old
                // `destinations.length > 0` gate silently omitted the field here
                // too, leaving `destinationId` (required for completeness)
                // unfillable with no indication why. Distinct from the
                // `destinationsLoadFailed` branch above (fetch failure).
                <section className={styles.section}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.editor.sections.destinationEmpty',
                            'Todavía no hay ciudades / destinos cargados. Contactanos para poder completar este campo.'
                        )}
                    </p>
                </section>
            )}

            {/* T-020: type select */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-type"
                >
                    {t('commerce.owner.editor.sections.type', 'Categoría')}
                </label>
                <select
                    id="ce-type"
                    className={styles.input}
                    value={data.listingType}
                    onChange={(event) => {
                        onFieldChange('listingType', event.target.value);
                    }}
                >
                    <option value="">—</option>
                    {typeOptions.map((opt) => (
                        <option
                            key={opt}
                            value={opt}
                        >
                            {t(`commerce.owner.editor.typeOption.${opt}`, opt)}
                        </option>
                    ))}
                </select>
            </section>

            {/* T-020: summary textarea (min 10 / max 300) */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-summary"
                >
                    {t('commerce.owner.editor.sections.summary', 'Resumen')}
                </label>
                <textarea
                    id="ce-summary"
                    className={styles.textarea}
                    value={data.summary}
                    rows={3}
                    minLength={10}
                    maxLength={300}
                    aria-invalid={errors.summary ? 'true' : 'false'}
                    aria-describedby={errors.summary ? fieldErrorId('summary') : 'ce-summary-hint'}
                    onChange={(event) => {
                        onFieldChange('summary', event.target.value);
                    }}
                />
                <span
                    id="ce-summary-hint"
                    className={styles.hint}
                    aria-live="polite"
                >
                    {t('commerce.owner.editor.validation.summaryHint', '{{count}}/300', {
                        count: data.summary.length
                    })}
                </span>
                <FieldError
                    id={fieldErrorId('summary')}
                    message={errors.summary}
                />
            </section>

            {/* HOS-166 judgment-day W2: description — identity field, already
                owner-editable server-side (D-1) but never exposed here. */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-description"
                >
                    {t('commerce.owner.editor.sections.description', 'Descripción')}
                </label>
                <textarea
                    id="ce-description"
                    className={styles.textarea}
                    value={data.description}
                    rows={5}
                    aria-invalid={errors.description ? 'true' : 'false'}
                    aria-describedby={errors.description ? fieldErrorId('description') : undefined}
                    onChange={(event) => {
                        onFieldChange('description', event.target.value);
                    }}
                />
                <FieldError
                    id={fieldErrorId('description')}
                    message={errors.description}
                />
            </section>

            {/* HOS-371: TipTap instead of the bare textarea this field used to
                be. `richDescription` is already rendered as Markdown on the
                public pages (`GastronomyDescription.astro` / `ExperienceInfo.astro`
                both run it through `renderContent`), and RichTextEditor persists
                Markdown — so the stored shape is unchanged, the owner just stops
                having to hand-write it.

                Deliberately NOT behind a `PlanEntitlementGate`: that gate reads
                the ACCOMMODATION entitlement set (`loadEntitlements` filters to
                `product_domain = 'accommodation'`), so gating a commerce field on
                it would deny the field to every commerce owner. Commerce billing
                is a separate domain — see the root CLAUDE.md, SPEC-239.

                The title is a <span>, not a <label htmlFor>: the editing surface
                is a contenteditable `role="textbox"`, which a <label> cannot
                name. The accessible name comes from `ariaLabel` instead. */}
            <section className={styles.section}>
                <span className={styles.label}>
                    {t('commerce.owner.editor.sections.richDescription', 'Descripción ampliada')}
                </span>
                <RichTextEditor
                    value={data.richDescription}
                    ariaLabel={t(
                        'commerce.owner.editor.sections.richDescription',
                        'Descripción ampliada'
                    )}
                    placeholder={t(
                        'commerce.owner.editor.richDescriptionPlaceholder',
                        'Contá la historia de tu comercio con detalle...'
                    )}
                    onChange={(value) => {
                        onFieldChange('richDescription', value);
                    }}
                />
            </section>
        </>
    );
}

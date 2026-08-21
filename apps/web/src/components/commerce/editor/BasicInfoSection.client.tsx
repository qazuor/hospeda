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
import type { DestinationOption } from '@/components/commerce/destination-option';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';

/**
 * Identity of the two fields that keep their own wiring (HOS-385).
 *
 * `summary` points `aria-describedby` at a live character counter when it is
 * VALID and at the error when it is not. `TextField` owns a single-target
 * `aria-describedby` that exists only while there is an error, and renders
 * label/control/error as flat siblings with no slot between control and error —
 * so adopting it would drop the counter from the accessible description.
 *
 * `richDescription` is a contenteditable named by `ariaLabel`, deliberately
 * titled with a `<span>` rather than a `<label>` (a `<label>` cannot name a
 * `role="textbox"`); the wrapper always renders a real `<label htmlFor>`.
 *
 * Both still DERIVE their id, which is the half that was drifting.
 */
const SUMMARY_FIELD = { prefix: COMMERCE_FIELD_PREFIX, name: 'summary' } as const;
const SUMMARY_ID = buildFieldId(SUMMARY_FIELD);
const SUMMARY_HINT_ID = `${SUMMARY_ID}-hint`;

const RICH_DESCRIPTION_ID = buildFieldId({
    prefix: COMMERCE_FIELD_PREFIX,
    name: 'richDescription'
});

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
                <TextField
                    prefix={COMMERCE_FIELD_PREFIX}
                    name="name"
                    label={t('commerce.owner.editor.sections.name', 'Nombre del comercio')}
                    labelClassName={styles.label}
                    className={styles.input}
                    error={errors.name}
                    type="text"
                    value={data.name}
                    onChange={(event) => {
                        onFieldChange('name', event.target.value);
                    }}
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
                    <TextField
                        as="select"
                        prefix={COMMERCE_FIELD_PREFIX}
                        name="destinationId"
                        label={t('commerce.owner.editor.sections.destination', 'Ciudad / Destino')}
                        labelClassName={styles.label}
                        className={styles.input}
                        error={errors.destinationId}
                        value={data.destinationId}
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
                    </TextField>
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
                {/*
                 * `type` is the Zod key; `listingType` is the React state key.
                 * HOS-385 unifies the ID layer, not the state layer — the
                 * wrapper takes the Zod name and the caller still supplies the
                 * state value separately (spec §6.2).
                 */}
                <TextField
                    as="select"
                    prefix={COMMERCE_FIELD_PREFIX}
                    name="type"
                    label={t('commerce.owner.editor.sections.type', 'Categoría')}
                    labelClassName={styles.label}
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
                </TextField>
            </section>

            {/* T-020: summary textarea (min 10 / max 300) */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor={SUMMARY_ID}
                >
                    {t('commerce.owner.editor.sections.summary', 'Resumen')}
                </label>
                <textarea
                    id={SUMMARY_ID}
                    className={styles.textarea}
                    value={data.summary}
                    rows={3}
                    minLength={10}
                    maxLength={300}
                    aria-invalid={errors.summary ? 'true' : 'false'}
                    aria-describedby={
                        errors.summary ? buildFieldErrorId(SUMMARY_FIELD) : SUMMARY_HINT_ID
                    }
                    onChange={(event) => {
                        onFieldChange('summary', event.target.value);
                    }}
                />
                <span
                    id={SUMMARY_HINT_ID}
                    className={styles.hint}
                    aria-live="polite"
                >
                    {t('commerce.owner.editor.validation.summaryHint', '{{count}}/300', {
                        count: data.summary.length
                    })}
                </span>
                <FieldError
                    id={buildFieldErrorId(SUMMARY_FIELD)}
                    message={errors.summary}
                />
            </section>

            {/* HOS-166 judgment-day W2: description — identity field, already
                owner-editable server-side (D-1) but never exposed here. */}
            <section className={styles.section}>
                <TextField
                    as="textarea"
                    prefix={COMMERCE_FIELD_PREFIX}
                    name="description"
                    label={t('commerce.owner.editor.sections.description', 'Descripción')}
                    labelClassName={styles.label}
                    className={styles.textarea}
                    error={errors.description}
                    value={data.description}
                    rows={5}
                    onChange={(event) => {
                        onFieldChange('description', event.target.value);
                    }}
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
                    id={RICH_DESCRIPTION_ID}
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

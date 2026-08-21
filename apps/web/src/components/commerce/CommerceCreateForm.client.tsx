/**
 * @file CommerceCreateForm.client.tsx
 * @description Owner self-service commerce-listing create form island
 * (HOS-166 §7.2, §8 point 2).
 *
 * Collects ONLY the minimum identity fields the create endpoint's schema
 * genuinely requires (`name`, `type`, `summary`, `description`, plus the
 * optional `destinationId`) — everything else (contact, media, opening
 * hours, price, social) is filled in afterward via the existing
 * `CommerceListingEditor` on the listing's editor page, which this form
 * redirects to on success. Experience listings additionally require
 * `priceFrom`/`priceUnit` at create time (the base `ExperienceSchema` has no
 * default for either — see the vertical-specific price section below).
 *
 * Native HTML form + `useZodForm` (no TanStack Form, per web conventions).
 * Field-level validation runs against a `.pick()` SUBSET of the real
 * `GastronomyOwnerCreateInputSchema` / `ExperienceOwnerCreateInputSchema`
 * (imported from `@repo/schemas`, never hand-rolled) — the exact schema the
 * create endpoint itself validates against, so there is only one set of
 * rules, just scoped to the fields this form actually collects.
 *
 * HOS-693 §6.2 removed the HOS-257 `prefill` prop (sourced from the caller's
 * own admin-provisioned commerce lead, which no longer exists — HOS-687
 * grants COMMERCE_OWNER on listing creation instead). The form always starts
 * blank now, which was already its behaviour for the common case
 * (AC-10/AC-11 predate this and still hold).
 *
 * Hydration: caller MUST use `client:load` (the primary interactive surface
 * of the create page).
 */

import type { ExperienceOwnerCreateInput, GastronomyOwnerCreateInput } from '@repo/schemas';
import {
    ExperienceOwnerCreateInputSchema,
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    GastronomyOwnerCreateInputSchema,
    GastronomyTypeEnum,
    requirePriceUnitUnlessOnRequest
} from '@repo/schemas';
import { type FormEvent, type JSX, useState } from 'react';
import type { DestinationOption } from '@/components/commerce/destination-option';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { createOwnerListing } from '@/lib/commerce/owner-listings';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './CommerceCreateForm.module.css';

export interface CommerceCreateFormProps {
    /** Which vertical this create form targets. */
    readonly vertical: CommerceVertical;
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Destination options for the (optional) destination select. */
    readonly destinations: readonly DestinationOption[];
    /**
     * `true` when the SSR destination catalog fetch failed (as opposed to
     * succeeding with a genuinely empty catalog). `destinationId` is REQUIRED
     * for publish-readiness (`resolveListingCompleteness`), so silently
     * hiding the select on a failed fetch (the old `destinations.length > 0`
     * gate) left the owner with no way to ever complete their listing and no
     * indication why the field was missing. Defaults to `false` so existing
     * callers/tests that omit it keep the prior behaviour.
     */
    readonly destinationsLoadFailed?: boolean;
}

const GASTRONOMY_TYPE_OPTIONS = Object.values(GastronomyTypeEnum);
const EXPERIENCE_TYPE_OPTIONS = Object.values(ExperienceTypeEnum);
const PRICE_UNIT_OPTIONS = Object.values(ExperiencePriceUnitEnum);

/** Fields this form collects for gastronomy — a subset of the real create schema. */
const GASTRONOMY_FORM_SCHEMA = GastronomyOwnerCreateInputSchema.pick({
    name: true,
    type: true,
    summary: true,
    description: true,
    destinationId: true
});

/**
 * Fields this form collects for experience — a subset of the real create schema.
 *
 * The pick is taken from the PLAIN create schema and the cross-field pricing
 * rule is re-applied afterwards, deliberately in that order: Zod 4 throws
 * `.pick() cannot be used on object schemas containing refinements`, so picking
 * from `ExperienceOwnerCreateInputCheckedSchema` would crash this module on
 * load. Re-applying the shared predicate keeps the client and the server
 * enforcing the same rule from one definition instead of two (H-156).
 */
const EXPERIENCE_FORM_SCHEMA = ExperienceOwnerCreateInputSchema.pick({
    name: true,
    type: true,
    summary: true,
    description: true,
    destinationId: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true
}).superRefine(requirePriceUnitUnlessOnRequest);

/**
 * CommerceCreateForm — owner self-service listing create island.
 * Submits a DRAFT listing and redirects to its operational editor.
 */
export function CommerceCreateForm({
    vertical,
    locale,
    destinations,
    destinationsLoadFailed = false
}: CommerceCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);

    const schema = vertical === 'gastronomy' ? GASTRONOMY_FORM_SCHEMA : EXPERIENCE_FORM_SCHEMA;
    const { fieldErrors, formError, validate, handleApiError } = useZodForm({ schema, t });

    const [name, setName] = useState('');
    const [listingType, setListingType] = useState('');
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [destinationId, setDestinationId] = useState('');
    const [priceFrom, setPriceFrom] = useState<number | null>(null);
    const [priceUnit, setPriceUnit] = useState('');
    const [isPriceOnRequest, setIsPriceOnRequest] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const typeOptions =
        vertical === 'gastronomy' ? GASTRONOMY_TYPE_OPTIONS : EXPERIENCE_TYPE_OPTIONS;

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const basePayload: Record<string, unknown> = {
            name,
            type: listingType || undefined,
            summary,
            description,
            destinationId: destinationId || undefined
        };

        if (vertical === 'experience') {
            basePayload.priceFrom = isPriceOnRequest ? 0 : (priceFrom ?? undefined);
            // H-156: an experience with no price has no billing unit. Send an
            // explicit null rather than whatever the select happened to hold, so
            // the row does not end up asserting "price on request", "price 0"
            // and "charged per person" all at once.
            basePayload.priceUnit = isPriceOnRequest ? null : priceUnit || undefined;
            basePayload.isPriceOnRequest = isPriceOnRequest;
        }

        const parsed = validate(basePayload);
        if (!parsed.success) {
            return;
        }

        setIsSubmitting(true);

        // `parsed.data` is typed against the narrow `.pick()` subset schema this
        // form validates (only the fields it collects), not the full owner-create
        // input type — every field the subset omits is optional/defaulted
        // server-side (see the module doc), but TS cannot see that equivalence
        // across the two distinct zod object types.
        const created = await createOwnerListing(
            vertical === 'gastronomy'
                ? {
                      vertical: 'gastronomy',
                      // TYPE-WORKAROUND: narrow form-subset → full owner-create input (see above).
                      data: parsed.data as unknown as GastronomyOwnerCreateInput
                  }
                : {
                      vertical: 'experience',
                      // TYPE-WORKAROUND: narrow form-subset → full owner-create input (see above).
                      data: parsed.data as unknown as ExperienceOwnerCreateInput
                  }
        );

        if (created.ok) {
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/comercio/${vertical}/${created.data.id}/editar`
            });
            return;
        }

        handleApiError(
            created.error,
            t('commerce.owner.create.error', 'No pudimos crear el comercio. Probá de nuevo.')
        );
        setIsSubmitting(false);
    }

    return (
        <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
        >
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cc-name"
                >
                    {t('commerce.owner.create.fields.name', 'Nombre del comercio')}
                </label>
                <input
                    id="cc-name"
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={fieldErrors.name ? 'true' : 'false'}
                    aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('name')}
                    message={fieldErrors.name}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cc-type"
                >
                    {t('commerce.owner.create.fields.type', 'Categoría')}
                </label>
                <select
                    id="cc-type"
                    className={styles.input}
                    value={listingType}
                    onChange={(event) => setListingType(event.target.value)}
                    aria-invalid={fieldErrors.type ? 'true' : 'false'}
                    aria-describedby={fieldErrors.type ? fieldErrorId('type') : undefined}
                    required
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
                <FieldError
                    id={fieldErrorId('type')}
                    message={fieldErrors.type}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cc-summary"
                >
                    {t('commerce.owner.create.fields.summary', 'Resumen')}
                </label>
                <textarea
                    id="cc-summary"
                    className={styles.textarea}
                    rows={2}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    aria-invalid={fieldErrors.summary ? 'true' : 'false'}
                    aria-describedby={fieldErrors.summary ? fieldErrorId('summary') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('summary')}
                    message={fieldErrors.summary}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cc-description"
                >
                    {t('commerce.owner.create.fields.description', 'Descripción')}
                </label>
                <textarea
                    id="cc-description"
                    className={styles.textarea}
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    aria-invalid={fieldErrors.description ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors.description ? fieldErrorId('description') : undefined
                    }
                    required
                />
                <FieldError
                    id={fieldErrorId('description')}
                    message={fieldErrors.description}
                />
            </div>

            {/* `destinationsLoadFailed` (judgment-day fix): surfaces a failed SSR
                catalog fetch explicitly instead of silently omitting a REQUIRED
                field (completeness needs `destinationId`) — see the prop's doc. */}
            {destinationsLoadFailed ? (
                <div className={styles.field}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.create.fields.destinationLoadError',
                            'No pudimos cargar el listado de ciudades / destinos. Recargá la página para reintentar.'
                        )}
                    </p>
                </div>
            ) : destinations.length > 0 ? (
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="cc-destinationId"
                    >
                        {t('commerce.owner.create.fields.destination', 'Ciudad / Destino')}
                    </label>
                    <select
                        id="cc-destinationId"
                        className={styles.input}
                        value={destinationId}
                        onChange={(event) => setDestinationId(event.target.value)}
                        aria-invalid={fieldErrors.destinationId ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.destinationId ? fieldErrorId('destinationId') : undefined
                        }
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
                        message={fieldErrors.destinationId}
                    />
                </div>
            ) : (
                // HOS-260: catalog fetch SUCCEEDED but returned zero rows. The old
                // `destinations.length > 0` gate silently omitted the field here
                // too, leaving `destinationId` (required for completeness)
                // unfillable with no indication why. Distinct from the
                // `destinationsLoadFailed` branch above (fetch failure).
                <div className={styles.field}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.create.fields.destinationEmpty',
                            'Todavía no hay ciudades / destinos cargados. Contactanos para poder completar este campo.'
                        )}
                    </p>
                </div>
            )}

            {vertical === 'experience' && (
                <div className={styles.field}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={isPriceOnRequest}
                            onChange={(event) => setIsPriceOnRequest(event.target.checked)}
                        />
                        {t('commerce.owner.editor.sections.isPriceOnRequest', 'Precio a consultar')}
                    </label>

                    <label
                        className={styles.label}
                        htmlFor="cc-priceFrom"
                    >
                        {t('commerce.owner.editor.sections.priceFrom', 'Precio desde (centavos)')}
                    </label>
                    <input
                        id="cc-priceFrom"
                        type="number"
                        min={0}
                        step={1}
                        className={styles.input}
                        disabled={isPriceOnRequest}
                        value={priceFrom ?? ''}
                        onChange={(event) => {
                            const raw = event.target.value;
                            setPriceFrom(raw === '' ? null : Math.floor(Number(raw)));
                        }}
                        aria-invalid={fieldErrors.priceFrom ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.priceFrom ? fieldErrorId('priceFrom') : undefined
                        }
                    />
                    <FieldError
                        id={fieldErrorId('priceFrom')}
                        message={fieldErrors.priceFrom}
                    />

                    <label
                        className={styles.label}
                        htmlFor="cc-priceUnit"
                    >
                        {t('commerce.owner.editor.sections.priceUnit', 'Unidad de precio')}
                    </label>
                    {/*
                     * H-156: disabled while the price is "on request", mirroring
                     * `priceFrom` above. This used to stay enabled BECAUSE
                     * `ExperienceOwnerCreateInputSchema.priceUnit` was required even for a
                     * listing with no price — disabling it would have made the form
                     * unsubmittable. The column is nullable now and the create schema only
                     * demands a unit when there IS a price, so the field can finally follow
                     * the checkbox instead of contradicting it.
                     */}
                    <select
                        id="cc-priceUnit"
                        className={styles.input}
                        value={priceUnit}
                        disabled={isPriceOnRequest}
                        onChange={(event) => setPriceUnit(event.target.value)}
                        aria-invalid={fieldErrors.priceUnit ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.priceUnit ? fieldErrorId('priceUnit') : undefined
                        }
                    >
                        <option value="">—</option>
                        {PRICE_UNIT_OPTIONS.map((unit) => (
                            <option
                                key={unit}
                                value={unit}
                            >
                                {t(`commerce.owner.editor.priceUnitOption.${unit}`, unit)}
                            </option>
                        ))}
                    </select>
                    <FieldError
                        id={fieldErrorId('priceUnit')}
                        message={fieldErrors.priceUnit}
                    />
                </div>
            )}

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                data-testid="commerce-create-submit"
            >
                {isSubmitting
                    ? t('commerce.owner.create.submitting', 'Creando...')
                    : t('commerce.owner.create.submit', 'Crear comercio')}
            </button>
        </form>
    );
}

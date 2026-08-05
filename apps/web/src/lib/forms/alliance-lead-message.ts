/**
 * @file alliance-lead-message.ts
 * @description Pure helpers for the Alliance Lead form (HOS-277 §7.3,
 * HOS-278 §6.4): per-kind specific-field configuration, `message`
 * serialization, typed-field extraction, and front-only validation for the
 * kind-specific fields.
 *
 * `AllianceLeadCreateInputSchema` (the public payload persisted by the
 * backend) carries the generic fields (`kind`, `contactName`, `email`,
 * `phone`, `message`) PLUS six typed `service_provider`-only columns
 * (`businessName`, `category`, `destinationId`, `benefitType`,
 * `benefitValue`, `benefitText` — HOS-278 §6.4), because approving a
 * `service_provider` lead materializes a `host_trades` directory row from
 * them and prose is unusable as data.
 *
 * For the other three kinds (`partner`, `sponsor`, `editor`), kind-specific
 * details collected in the UI are still NOT persisted as separate columns
 * (HOS-277 NG-3) — the form serializes them into the `message` field with
 * human-readable labels before submitting.
 */

import type {
    AllianceLeadCreateInput,
    AllianceLeadKind,
    HostTradeBenefitTypeEnum
} from '@repo/schemas';
import { hostTradeBenefitTypeRequiresValue } from '@repo/schemas';
import type { TranslationFn } from '@/lib/api-errors';

/** A single kind-specific field's UI configuration. */
export interface AllianceLeadSpecificFieldConfig {
    /** Field name — used as both the form-state key and the i18n label key suffix. */
    readonly name: string;
    /**
     * Input type. `'url'` fields additionally get URL-format validation.
     * `'select'` fields render as a native `<select>` (options are resolved
     * by the caller — see `AllianceLead.client.tsx`). `'number'` fields
     * additionally get positive-integer validation.
     */
    readonly type: 'text' | 'url' | 'select' | 'number';
    /**
     * Whether the field is required for this kind. `benefitValue` is
     * declared `false` here even though it IS conditionally required — that
     * rule depends on the sibling `benefitType` value at submit time, which
     * a static per-field flag cannot express (see
     * {@link validateAllianceLeadSpecificFields}).
     */
    readonly required: boolean;
    /**
     * When `true`, this field is a typed payload column (HOS-278 §6.4) and
     * is EXCLUDED from `message` serialization — it is sent as its own
     * top-level key instead (see {@link buildAllianceLeadTypedFields}).
     * Defaults to `false` (serialized into `message`, as before).
     */
    readonly typed?: boolean;
}

/**
 * Kind-specific fields collected by the alliance-lead form, per HOS-277
 * §7.3 and HOS-278 §6.4. Declaration order is also render order and
 * serialization order.
 */
export const ALLIANCE_LEAD_SPECIFIC_FIELDS: Readonly<
    Record<AllianceLeadKind, ReadonlyArray<AllianceLeadSpecificFieldConfig>>
> = {
    partner: [
        { name: 'businessName', type: 'text', required: true },
        { name: 'website', type: 'url', required: false },
        { name: 'partnershipType', type: 'text', required: true }
    ],
    sponsor: [
        { name: 'businessName', type: 'text', required: true },
        { name: 'website', type: 'url', required: false },
        { name: 'sponsorshipInterest', type: 'text', required: true }
    ],
    // HOS-278 §6.4: these six fields materialize a `host_trades` row on
    // approval, so (unlike the other three kinds) they are typed payload
    // columns, not prose serialized into `message`. `website` is the one
    // exception — it stays free text serialized into `message`, same as
    // `partner`/`sponsor`.
    service_provider: [
        { name: 'businessName', type: 'text', required: true, typed: true },
        { name: 'category', type: 'select', required: true, typed: true },
        { name: 'destinationId', type: 'select', required: true, typed: true },
        { name: 'benefitType', type: 'select', required: true, typed: true },
        { name: 'benefitValue', type: 'number', required: false, typed: true },
        { name: 'benefitText', type: 'text', required: false, typed: true },
        { name: 'website', type: 'url', required: false }
    ],
    editor: [
        { name: 'portfolioLinks', type: 'text', required: false },
        { name: 'topics', type: 'text', required: true },
        { name: 'experience', type: 'text', required: false }
    ]
};

/** Flat map of specific-field name -> value, as collected by the form. */
export type AllianceLeadSpecificValues = Record<string, string>;

/**
 * Serializes the kind-specific field values and the applicant's free-text
 * note into the single `message` string the backend persists (HOS-277
 * §7.3). Empty specific fields are skipped; fields marked `typed` (HOS-278
 * §6.4) are skipped unconditionally — they are sent as their own payload
 * key instead (see {@link buildAllianceLeadTypedFields}), and including them
 * here too would duplicate the same answer as both a column and prose. The
 * free-text block is appended last, preceded by a blank line and a
 * `messageIntro` label, only when non-empty.
 *
 * @example
 * ```
 * Nombre del negocio: Acme SA
 * Sitio web: https://acme.com
 * Tipo de alianza: Agencia de turismo
 *
 * Mensaje:
 * <texto libre del usuario>
 * ```
 */
export function serializeAllianceLeadMessage({
    kind,
    specificValues,
    freeText,
    t
}: {
    readonly kind: AllianceLeadKind;
    readonly specificValues: AllianceLeadSpecificValues;
    readonly freeText: string;
    readonly t: TranslationFn;
}): string {
    const fields = ALLIANCE_LEAD_SPECIFIC_FIELDS[kind];

    const lines: string[] = [];
    for (const field of fields) {
        if (field.typed) continue;
        const value = specificValues[field.name]?.trim();
        if (!value) continue;
        const label = t(`alliance-leads.form.fields.${field.name}`, field.name);
        lines.push(`${label}: ${value}`);
    }

    const trimmedFreeText = freeText.trim();
    if (trimmedFreeText) {
        if (lines.length > 0) {
            lines.push('');
        }
        lines.push(t('alliance-leads.form.messageIntro', 'Mensaje:'));
        lines.push(trimmedFreeText);
    }

    return lines.join('\n');
}

/**
 * The typed `service_provider` payload fields (HOS-278 §6.4), extracted from
 * the form's flat specific-values map so they can be spread onto the create
 * payload as their own top-level keys.
 */
export type AllianceLeadTypedFields = Partial<
    Pick<
        AllianceLeadCreateInput,
        | 'businessName'
        | 'category'
        | 'destinationId'
        | 'benefitType'
        | 'benefitValue'
        | 'benefitText'
    >
>;

/**
 * Extracts the `typed` fields (HOS-278 §6.4) from the form's specific-values
 * map, converting `'number'`-typed fields to an actual `number` — a native
 * `<input type="number">` always yields a string, and the backend column is
 * an integer.
 *
 * `benefitValue` gets one extra rule beyond "is it typed": it is only
 * included when the CURRENT `benefitType` selection actually carries a
 * numeric value ({@link hostTradeBenefitTypeRequiresValue}). Without this, a
 * value entered while `benefitType` was `PERCENTAGE`/`FIXED_AMOUNT` would
 * survive switching to `TWO_FOR_ONE`/`SPECIAL_CONDITION` in form state and
 * get submitted anyway — tripping the backend's "non-numeric type rejects a
 * value" rule (`refineHostTradeBenefit`) with a confusing error on a field
 * the applicant no longer sees.
 *
 * For kinds other than `service_provider` this returns `{}` — none of their
 * fields are marked `typed`.
 */
export function buildAllianceLeadTypedFields({
    kind,
    specificValues
}: {
    readonly kind: AllianceLeadKind;
    readonly specificValues: AllianceLeadSpecificValues;
}): AllianceLeadTypedFields {
    const fields = ALLIANCE_LEAD_SPECIFIC_FIELDS[kind];
    const typedFields: Record<string, string | number> = {};

    for (const field of fields) {
        if (!field.typed) continue;

        if (field.name === 'benefitValue') {
            const benefitType = specificValues.benefitType?.trim();
            if (
                !benefitType ||
                !hostTradeBenefitTypeRequiresValue(benefitType as HostTradeBenefitTypeEnum)
            ) {
                continue;
            }
        }

        const raw = specificValues[field.name]?.trim();
        if (!raw) continue;
        typedFields[field.name] = field.type === 'number' ? Number(raw) : raw;
    }

    return typedFields as AllianceLeadTypedFields;
}

/** Flat map of specific-field name -> validation error message. */
export type AllianceLeadSpecificFieldErrors = Record<string, string>;

/**
 * Validates the kind-specific fields (required + URL format + number
 * format) purely on the client. The backend schema has no knowledge of the
 * non-typed fields (HOS-277 NG-3) — they never leave the browser as
 * separate fields, so validation for those never runs server-side. The
 * typed `service_provider` fields (HOS-278 §6.4) DO leave the browser and
 * ARE re-validated server-side (`AllianceLeadSubmissionSchema`) — this
 * client-side pass exists purely for immediate UX feedback.
 *
 * `benefitValue`'s required-ness cannot be expressed by its static
 * `required` flag (it is `false` in {@link ALLIANCE_LEAD_SPECIFIC_FIELDS} —
 * see that field's doc comment) because it depends on the sibling
 * `benefitType` value at validation time: it is handled separately below,
 * via {@link hostTradeBenefitTypeRequiresValue} — the same helper the
 * backend uses — so this can never drift from which types are numeric.
 */
export function validateAllianceLeadSpecificFields({
    kind,
    specificValues,
    t
}: {
    readonly kind: AllianceLeadKind;
    readonly specificValues: AllianceLeadSpecificValues;
    readonly t: TranslationFn;
}): AllianceLeadSpecificFieldErrors {
    const errors: AllianceLeadSpecificFieldErrors = {};
    const fields = ALLIANCE_LEAD_SPECIFIC_FIELDS[kind];

    for (const field of fields) {
        const value = specificValues[field.name]?.trim() ?? '';

        if (field.required && !value) {
            errors[field.name] = t(
                'alliance-leads.form.validation.required',
                'Este campo es obligatorio.'
            );
            continue;
        }

        if (field.type === 'url' && value && !isValidUrl(value)) {
            errors[field.name] = t(
                'alliance-leads.form.validation.url',
                'Ingresá una URL válida (con http:// o https://).'
            );
            continue;
        }

        if (field.type === 'number' && value && !isValidPositiveInteger(value)) {
            errors[field.name] = t(
                'alliance-leads.form.validation.number',
                'Ingresá un número entero positivo.'
            );
        }
    }

    if (kind === 'service_provider' && !errors.benefitValue) {
        const benefitType = specificValues.benefitType?.trim();
        const benefitValueMissing = !specificValues.benefitValue?.trim();

        if (
            benefitType &&
            hostTradeBenefitTypeRequiresValue(benefitType as HostTradeBenefitTypeEnum) &&
            benefitValueMissing
        ) {
            errors.benefitValue = t(
                'alliance-leads.form.validation.required',
                'Este campo es obligatorio.'
            );
        }
    }

    return errors;
}

/** Returns `true` when `value` parses as an absolute `http(s)` URL. */
function isValidUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/** Returns `true` when `value` is a positive integer string (e.g. `"15"`). */
function isValidPositiveInteger(value: string): boolean {
    if (!/^\d+$/.test(value)) return false;
    return Number(value) > 0;
}

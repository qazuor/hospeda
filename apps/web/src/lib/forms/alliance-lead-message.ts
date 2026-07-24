/**
 * @file alliance-lead-message.ts
 * @description Pure helpers for the Alliance Lead form (HOS-277 §7.3):
 * per-kind specific-field configuration, `message` serialization, and
 * front-only validation for those specific fields.
 *
 * `AllianceLeadCreateInputSchema` (the public payload persisted by the
 * backend) only carries generic fields: `kind`, `contactName`, `email`,
 * `phone`, `message`. Kind-specific details collected in the UI (business
 * name, website, portfolio links, etc.) are NOT persisted as separate
 * columns in V1 (HOS-277 NG-3) — the form instead serializes them into the
 * `message` field with human-readable labels before submitting, so the
 * backend contract stays generic across all four kinds.
 */

import type { AllianceLeadKind } from '@repo/schemas';
import type { TranslationFn } from '@/lib/api-errors';

/** A single kind-specific field's UI configuration. */
export interface AllianceLeadSpecificFieldConfig {
    /** Field name — used as both the form-state key and the i18n label key suffix. */
    readonly name: string;
    /** Input type. `'url'` fields additionally get URL-format validation. */
    readonly type: 'text' | 'url';
    /** Whether the field is required for this kind. */
    readonly required: boolean;
}

/**
 * Kind-specific fields collected by the alliance-lead form, per HOS-277
 * §7.3. Declaration order is also render order and serialization order.
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
    service_provider: [
        { name: 'businessName', type: 'text', required: true },
        { name: 'serviceType', type: 'text', required: true },
        { name: 'coverageArea', type: 'text', required: true },
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
 * §7.3). Empty specific fields are skipped; the free-text block is appended
 * last, preceded by a blank line and a `messageIntro` label, only when
 * non-empty.
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

/** Flat map of specific-field name -> validation error message. */
export type AllianceLeadSpecificFieldErrors = Record<string, string>;

/**
 * Validates the kind-specific fields (required + URL format) purely on the
 * client. The backend schema has no knowledge of these fields (HOS-277
 * NG-3) — they never leave the browser as separate fields, so this
 * validation never runs server-side.
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

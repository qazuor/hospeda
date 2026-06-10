import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Custom summarizer function that may be provided per section via config. */
export type SectionSummaryFn = (values: Record<string, unknown>, section: SectionConfig) => string;

// ---------------------------------------------------------------------------
// Field-level value extraction helpers
// ---------------------------------------------------------------------------

/**
 * Reads a (possibly dot-notated) key from a flat Record.
 * "location.country" → values["location.country"] (flat map from prepareFormValues)
 */
function readValue(values: Record<string, unknown>, fieldId: string): unknown {
    if (fieldId in values) return values[fieldId];

    // Fallback: walk nested object for non-flat data
    const parts = fieldId.split('.');
    let cursor: unknown = values;
    for (const part of parts) {
        if (cursor === null || typeof cursor !== 'object') return undefined;
        cursor = (cursor as Record<string, unknown>)[part];
    }
    return cursor;
}

/** UUID v4 pattern — 8-4-4-4-12 hex groups separated by hyphens. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true when the value looks like a UUID string.
 * Used to detect arrays of entity-reference IDs that should never be
 * shown verbatim in the accordion summary (SPEC-172 PR4).
 */
function isUuidLike(s: unknown): boolean {
    return typeof s === 'string' && UUID_RE.test(s);
}

/**
 * Converts a raw field value to a display string.
 * Handles strings, numbers, booleans, arrays (count or join), and objects.
 *
 * Arrays of UUID strings are collapsed to a count ("N items") instead of
 * showing raw IDs — these arise from AMENITY_SELECT / FEATURE_SELECT and
 * similar entity-reference multi-selects (SPEC-172 PR4 fix).
 */
function valueToDisplayString(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';

    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        // For arrays of objects (gallery images, etc.) — show count
        if (typeof value[0] === 'object') return `${value.length} elementos`;
        // For arrays whose first element looks like a UUID — show count only.
        // Joining UUIDs produces unreadable garbage in the accordion header.
        if (isUuidLike(value[0])) return `${value.length} elementos`;
        // For string/primitive arrays — join first few
        return value.slice(0, 3).join(', ');
    }

    if (typeof value === 'object') {
        // Gallery-style: { url, ... } objects are opaque
        const asRecord = value as Record<string, unknown>;
        if ('url' in asRecord || 'publicId' in asRecord) return 'imagen';
        return null;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Gallery-specific summarizer
// ---------------------------------------------------------------------------

/**
 * Produces a summary for gallery-type sections.
 * Looks for fields with ids containing "gallery" or "images" and counts entries.
 */
function galleryCount(values: Record<string, unknown>, fields: FieldConfig[]): string | null {
    const galleryFields = fields.filter(
        (f) =>
            f.id.toLowerCase().includes('gallery') ||
            f.id.toLowerCase().includes('images') ||
            f.type === 'GALLERY'
    );

    for (const field of galleryFields) {
        const value = readValue(values, field.id);
        if (Array.isArray(value) && value.length > 0) {
            return `${value.length} ${value.length === 1 ? 'foto' : 'fotos'}`;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Generic summarizer
// ---------------------------------------------------------------------------

/** Maximum number of field values to include in the summary. */
const MAX_SUMMARY_FIELDS = 3;

// ---------------------------------------------------------------------------
// Entity-select count summarizer
// ---------------------------------------------------------------------------

/**
 * Produces a readable count summary for entity-select multi-value fields
 * (AMENITY_SELECT, FEATURE_SELECT, ENTITY_SELECT with multiple=true).
 *
 * Returns null when no entity-select fields are present or all are empty,
 * so the caller can fall back to the generic field-scan strategy.
 *
 * Label mapping (SPEC-172 PR4):
 *   AMENITY_SELECT → "amenidad / amenidades"
 *   FEATURE_SELECT → "característica / características"
 *   ENTITY_SELECT  → "elemento / elementos"
 */
function entitySelectCountSummary(
    values: Record<string, unknown>,
    fields: FieldConfig[]
): string | null {
    const selectFields = fields.filter((f) =>
        [
            FieldTypeEnum.AMENITY_SELECT,
            FieldTypeEnum.FEATURE_SELECT,
            FieldTypeEnum.ENTITY_SELECT
        ].includes(f.type as FieldTypeEnum)
    );

    if (selectFields.length === 0) return null;

    const parts: string[] = [];

    for (const field of selectFields) {
        const raw = readValue(values, field.id);
        if (!Array.isArray(raw) || raw.length === 0) continue;
        const count = raw.length;

        let singular: string;
        let plural: string;
        if (field.type === FieldTypeEnum.AMENITY_SELECT) {
            singular = 'amenidad';
            plural = 'amenidades';
        } else if (field.type === FieldTypeEnum.FEATURE_SELECT) {
            singular = 'característica';
            plural = 'características';
        } else {
            singular = 'elemento';
            plural = 'elementos';
        }

        parts.push(`${count} ${count === 1 ? singular : plural}`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Generic section summarizer.
 *
 * Strategy:
 * 1. If the section has any GALLERY fields → show photo count.
 * 2. If the section has AMENITY_SELECT / FEATURE_SELECT / multi ENTITY_SELECT
 *    fields → show "N amenidades, M características" count summary.
 * 3. Otherwise: pick up to `MAX_SUMMARY_FIELDS` non-empty field values,
 *    join with " · ".
 * 4. If nothing is non-empty → return "— sin datos".
 */
function genericSummarize(values: Record<string, unknown>, section: SectionConfig): string {
    const fields = section.fields ?? [];

    // Gallery shortcut
    const galleryResult = galleryCount(values, fields);
    if (galleryResult !== null) return galleryResult;

    // Entity-select count shortcut (amenities, features, multi entity-selects)
    const entitySelectResult = entitySelectCountSummary(values, fields);
    if (entitySelectResult !== null) return entitySelectResult;

    const parts: string[] = [];

    for (const field of fields) {
        if (parts.length >= MAX_SUMMARY_FIELDS) break;
        if (field.type === 'HIDDEN' || field.type === 'COMPUTED') continue;

        const raw = readValue(values, field.id);
        const display = valueToDisplayString(raw);
        if (display !== null) {
            // Truncate long values for header display
            parts.push(display.length > 40 ? `${display.slice(0, 40)}…` : display);
        }
    }

    return parts.length > 0 ? parts.join(' · ') : '— sin datos';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes the collapsed-state summary string for a section.
 *
 * @param values      - Current form values (flat dot-notated map).
 * @param section     - Section configuration.
 * @param customFn    - Optional per-section override summarizer function.
 *                      When provided, it takes precedence over the generic logic.
 * @returns A one-line display string suitable for the SectionAccordionItem
 *          `collapsedSummary` prop.
 *
 * @example
 * ```ts
 * const summary = computeSectionSummary(values, basicInfoSection);
 * // → "Hotel Plaza · Hotel · Gualeguaychú"
 * ```
 */
export function computeSectionSummary({
    values,
    section,
    customFn
}: {
    readonly values: Record<string, unknown>;
    readonly section: SectionConfig;
    readonly customFn?: SectionSummaryFn;
}): string {
    if (customFn) return customFn(values, section);
    return genericSummarize(values, section);
}

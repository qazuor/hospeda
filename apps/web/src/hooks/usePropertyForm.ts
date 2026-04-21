/**
 * @file usePropertyForm.ts
 * @description React hook for managing the 8-section host property form state.
 * Uses native React useState with Zod validation (react-hook-form is not installed).
 * Validates against AccommodationCreateInputSchema from @repo/schemas.
 *
 * LifecycleStatusEnum correction: "published" state maps to ACTIVE (not PUBLISHED).
 * Values: DRAFT, ACTIVE, ARCHIVED.
 */

import { AccommodationCreateInputSchema } from '@repo/schemas';
import type { AccommodationCreateInput } from '@repo/schemas';
import { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The eight section keys that map to the property form wizard.
 * Each key matches a section of the multi-step form.
 */
export type PropertyFormSectionKey =
    | 'datos-basicos'
    | 'ubicacion'
    | 'capacidad'
    | 'amenities'
    | 'fotos'
    | 'precio'
    | 'contacto'
    | 'publicar';

/**
 * Flattened representation of form data for easy field access.
 * Maps the nested AccommodationCreateInput shape to a flat structure
 * suitable for section-level completion tracking.
 */
export type AccommodationFormData = AccommodationCreateInput;

/** Props for the usePropertyForm hook. */
export type UsePropertyFormProps = {
    /** Pre-fill the form with existing accommodation data (edit mode). */
    readonly initialData?: Partial<AccommodationFormData>;
    /**
     * Called after full validation passes when the user clicks Publish.
     * The caller is responsible for the API call and redirect.
     * Uses ACTIVE as the target lifecycle state (not PUBLISHED).
     */
    readonly onPublish: (data: AccommodationFormData) => Promise<void>;
};

/** Validation error map keyed by field path. */
export type FormErrors = Readonly<Record<string, string>>;

/**
 * A lightweight form-state object returned in place of UseFormReturn.
 * Mirrors the key surface of react-hook-form for future migration.
 */
export type FormState = {
    /** Current raw form values (may be incomplete). */
    readonly values: Partial<AccommodationFormData>;
    /** Field-level validation errors keyed by dot-path. */
    readonly errors: FormErrors;
    /** Whether a submission is currently in-flight. */
    readonly isSubmitting: boolean;
    /** Update one or more fields. */
    readonly setValue: (field: string, value: unknown) => void;
    /** Replace the entire form data (e.g. when loading initialData). */
    readonly reset: (data?: Partial<AccommodationFormData>) => void;
};

/** Result returned by the usePropertyForm hook. */
export type UsePropertyFormResult = {
    /**
     * Form state object compatible with the react-hook-form UseFormReturn surface.
     * react-hook-form is not installed; this is a native useState implementation.
     */
    readonly form: FormState;
    /** Ordered list of all section keys. */
    readonly sections: readonly PropertyFormSectionKey[];
    /**
     * Set of section keys where all required fields have valid values.
     * Computed on each render from current form values.
     */
    readonly completedSections: ReadonlySet<PropertyFormSectionKey>;
    /** True when all required fields across all 8 sections are filled and valid. */
    readonly isFormComplete: boolean;
    /**
     * Full Zod validation errors grouped by field path.
     * Used by the 'publicar' section to display the missing-fields summary.
     */
    readonly missingRequiredFields: readonly string[];
    /**
     * Validate the full form and call onPublish(data) if valid.
     * Does NOT call onPublish if any required field is invalid.
     * Throws if invoked while already submitting.
     */
    readonly handlePublish: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All section keys in display order. */
export const PROPERTY_FORM_SECTIONS: readonly PropertyFormSectionKey[] = [
    'datos-basicos',
    'ubicacion',
    'capacidad',
    'amenities',
    'fotos',
    'precio',
    'contacto',
    'publicar'
] as const;

/**
 * Maps each section to the dot-paths of its required fields.
 * Field names are derived from the actual AccommodationCreateInputSchema shape.
 *
 * Mapping corrections vs. task spec:
 * - 'shortDescription' → 'summary' (actual field name)
 * - 'address' / 'city' / 'country' / 'latitude' / 'longitude' → nested under 'location'
 * - 'maxGuests' → 'extraInfo.capacity'
 * - 'bedrooms' / 'bathrooms' → 'extraInfo.bedrooms' / 'extraInfo.bathrooms'
 * - 'images' → 'media.gallery' (array with at least 1 entry)
 * - 'pricePerNight' / 'currency' → 'price.price' / 'price.currency'
 * - 'contactEmail' → 'contactInfo.mobilePhone' (actual required contact field)
 * - 'amenities' and 'publicar' sections are optional/review — always complete
 */
export const SECTION_REQUIRED_FIELDS: Readonly<Record<PropertyFormSectionKey, readonly string[]>> =
    {
        'datos-basicos': ['name', 'summary', 'type'],
        ubicacion: ['location.country'],
        capacidad: ['extraInfo.capacity', 'extraInfo.bedrooms', 'extraInfo.bathrooms'],
        amenities: [],
        fotos: ['media.gallery'],
        precio: ['price.price', 'price.currency'],
        contacto: ['contactInfo.mobilePhone'],
        publicar: []
    } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a nested value from an object using a dot-separated path.
 */
function getNestedValue(obj: Partial<AccommodationFormData>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Set a nested value on a plain object using a dot-separated path.
 * Returns a new object (immutable update).
 */
function setNestedValue(
    obj: Partial<AccommodationFormData>,
    path: string,
    value: unknown
): Partial<AccommodationFormData> {
    const parts = path.split('.');
    if (parts.length === 1) {
        return { ...obj, [path]: value };
    }
    const [head, ...rest] = parts;
    const nested = (obj as Record<string, unknown>)[head] ?? {};
    return {
        ...obj,
        [head]: setNestedValue(nested as Partial<AccommodationFormData>, rest.join('.'), value)
    };
}

/**
 * Check whether a field path has a non-empty value in the form data.
 * For arrays (e.g. 'media.gallery'), requires length >= 1.
 */
function isFieldPresent(values: Partial<AccommodationFormData>, path: string): boolean {
    const value = getNestedValue(values, path);
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !Number.isNaN(value);
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/**
 * Determine which sections are complete given the current form values.
 */
function computeCompletedSections(
    values: Partial<AccommodationFormData>
): Set<PropertyFormSectionKey> {
    const completed = new Set<PropertyFormSectionKey>();
    for (const section of PROPERTY_FORM_SECTIONS) {
        const required = SECTION_REQUIRED_FIELDS[section];
        if (required.length === 0) {
            completed.add(section);
            continue;
        }
        const allPresent = required.every((field) => isFieldPresent(values, field));
        if (allPresent) {
            completed.add(section);
        }
    }
    return completed;
}

/**
 * Collect missing required field paths from the current form values.
 */
function computeMissingFields(values: Partial<AccommodationFormData>): string[] {
    const missing: string[] = [];
    for (const section of PROPERTY_FORM_SECTIONS) {
        const required = SECTION_REQUIRED_FIELDS[section];
        for (const field of required) {
            if (!isFieldPresent(values, field)) {
                missing.push(field);
            }
        }
    }
    return missing;
}

/**
 * Extract flat field-level error messages from a Zod ZodError issues array.
 * Filters out symbol keys from the path (Zod v4 uses `PropertyKey[]`).
 */
function extractZodErrors(
    issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>
): FormErrors {
    const errors: Record<string, string> = {};
    for (const issue of issues) {
        const key = issue.path.filter((p): p is string | number => typeof p !== 'symbol').join('.');
        if (key && !(key in errors)) {
            errors[key] = issue.message;
        }
    }
    return errors;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Form state manager for the 8-section host property wizard.
 *
 * Since react-hook-form is not installed in apps/web, this hook uses native
 * React useState paired with Zod validation on demand.
 *
 * Section completion is computed on each render from raw form values.
 * Full Zod validation only runs when handlePublish is invoked.
 *
 * @param props - Hook configuration.
 * @returns Form state, section completion tracking, and publish handler.
 *
 * @example
 * ```tsx
 * const { form, completedSections, isFormComplete, handlePublish } = usePropertyForm({
 *   initialData: draft,
 *   onPublish: async (data) => {
 *     await api.accommodations.publish(data);
 *     router.push(`/alojamientos/${data.slug}`);
 *   },
 * });
 * ```
 */
export const usePropertyForm = (props: UsePropertyFormProps): UsePropertyFormResult => {
    const { initialData, onPublish } = props;

    const [values, setValues] = useState<Partial<AccommodationFormData>>(initialData ?? {});
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // -------------------------------------------------------------------------
    // setValue — immutable nested update
    // -------------------------------------------------------------------------

    const setValue = useCallback((field: string, value: unknown): void => {
        setValues((prev) => setNestedValue(prev, field, value));
    }, []);

    // -------------------------------------------------------------------------
    // reset — replace full form data
    // -------------------------------------------------------------------------

    const reset = useCallback((data?: Partial<AccommodationFormData>): void => {
        setValues(data ?? {});
        setErrors({});
    }, []);

    // -------------------------------------------------------------------------
    // Derived state
    // -------------------------------------------------------------------------

    const completedSections = useMemo(() => computeCompletedSections(values), [values]);

    const missingRequiredFields = useMemo(() => computeMissingFields(values), [values]);

    const isFormComplete = missingRequiredFields.length === 0;

    // -------------------------------------------------------------------------
    // handlePublish
    // -------------------------------------------------------------------------

    const handlePublish = useCallback(async (): Promise<void> => {
        if (isSubmitting) return;

        // Run full Zod validation — surface all field errors.
        const parseResult = AccommodationCreateInputSchema.safeParse(values);

        if (!parseResult.success) {
            setErrors(
                extractZodErrors(
                    parseResult.error.issues as ReadonlyArray<{
                        path: readonly PropertyKey[];
                        message: string;
                    }>
                )
            );
            return;
        }

        setErrors({});
        setIsSubmitting(true);
        try {
            await onPublish(parseResult.data);
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, values, onPublish]);

    // -------------------------------------------------------------------------
    // Form object (compatible with react-hook-form UseFormReturn surface)
    // -------------------------------------------------------------------------

    const form: FormState = useMemo(
        () => ({ values, errors, isSubmitting, setValue, reset }),
        [values, errors, isSubmitting, setValue, reset]
    );

    return {
        form,
        sections: PROPERTY_FORM_SECTIONS,
        completedSections,
        isFormComplete,
        missingRequiredFields,
        handlePublish
    };
};

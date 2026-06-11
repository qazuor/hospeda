import { z } from 'zod';

// Regex for slugs (e.g.: my-slug-123)
export const SlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Regex for time in HH:mm format (24h)
export const TimeRegExp = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Regex for international phone number (E.164)
export const InternationalPhoneRegex = /^\+[1-9]\d{1,14}(?:\s\d{1,15})*$/;

// Regex for social network URLs
export const FacebookUrlRegex = /^https?:\/\/(www\.)?facebook\.com\//;
export const InstagramUrlRegex = /^https?:\/\/(www\.)?instagram\.com\//;
// Accepts both the legacy twitter.com domain and x.com (post-rebrand).
export const TwitterUrlRegex = /^https?:\/\/(www\.)?(twitter|x)\.com\//;
export const LinkedInUrlRegex = /^https?:\/\/(www\.)?linkedin\.com\//;
export const TikTokUrlRegex = /^https?:\/\/(www\.)?tiktok\.com\//;
export const YouTubeUrlRegex = /^https?:\/\/(www\.)?youtube\.com\//;

export const isValidLatitude = (val: string) => {
    if (val.trim() === '') return false; // Reject empty strings
    const n = Number(val);
    return !Number.isNaN(n) && Number.isFinite(n) && n >= -90 && n <= 90;
};
export const isValidLongitude = (val: string) => {
    if (val.trim() === '') return false; // Reject empty strings
    const n = Number(val);
    return !Number.isNaN(n) && Number.isFinite(n) && n >= -180 && n <= 180;
};

// Common fields to omit in CRUD actions (auto-managed by system)
export const omittedSystemFieldsForActions = [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedById'
];

/**
 * Transform helper for numeric fields that may come as strings from database (Drizzle numeric/decimal)
 * Accepts both string and number, transforms string to number, then validates as number
 *
 * @example
 * ```ts
 * // Basic usage
 * const schema = numericField();
 *
 * // With validation
 * const schema = numericField(z.number().positive().min(0).max(100));
 * ```
 */
export const numericField = (validation?: z.ZodNumber) => {
    const baseTransform = z
        .union([z.string(), z.number()])
        .transform((val: string | number) =>
            typeof val === 'string' ? Number.parseFloat(val) : val
        );

    return validation ? baseTransform.pipe(validation) : baseTransform.pipe(z.number());
};

/**
 * Returns a shallow copy of a Zod object shape with every top-level `.default()`
 * wrapper removed.
 *
 * ### Why this exists
 *
 * In **Zod 4**, `ZodObject.partial()` does NOT strip `.default()` from its fields
 * (this is a behaviour change from Zod 3). A partial schema built over fields that
 * carry defaults therefore still *injects* those defaults on every parse — even for
 * an empty input object:
 *
 * ```ts
 * const base = z.object({ a: z.string().default('X'), b: z.number() });
 * base.partial().parse({}); // → { a: 'X' }  (NOT {})
 * ```
 *
 * For a PATCH / partial-update schema this is a correctness bug: a field the client
 * never sent gets a value, violating the "absent key = no change" contract and
 * silently overwriting server state. Wrapping the shape with `stripShapeDefaults`
 * before `.partial()` restores the intended semantics:
 *
 * ```ts
 * z.object(stripShapeDefaults(base.shape)).partial().parse({}); // → {}
 * ```
 *
 * Only TOP-LEVEL defaults are removed. Nested object/array defaults are left intact,
 * because they only ever fire when the client explicitly sends the parent key (i.e.
 * an intentional update of that sub-object), which is the desired behaviour.
 *
 * Defaults nested inside `.optional()` / `.nullable()` wrappers are also removed —
 * e.g. `z.number().default(0).optional()` becomes `z.number().optional()` — because
 * in Zod 4 a `ZodDefault` still fires through an enclosing `ZodOptional`. The
 * optional / nullable modifiers themselves are preserved.
 *
 * ### Known boundary
 *
 * Only `ZodDefault`, `ZodOptional` and `ZodNullable` are traversed. A `ZodDefault`
 * hidden behind an OUTER `ZodCatch`, `ZodPipe` or `ZodEffects`/transform wrapper
 * (e.g. `z.string().default('X').catch('Y')` or `.default('X').transform(fn)`) is
 * NOT stripped — re-wrapping a transform/catch while removing the default is not
 * safely reversible. None of the fields on `AccommodationSchema` use that outer
 * pattern (a `ZodPipe` nested INSIDE a `ZodDefault`, as in `averageRating`, IS
 * handled — the default is the outer wrapper there). Revisit this if a future
 * defaulted field places `.catch()` / `.transform()` outside `.default()`.
 *
 * @param shape - The raw Zod object shape (e.g. `SomeSchema.shape`).
 * @returns A new shape object with `ZodDefault` wrappers unwrapped to their inner type.
 */
const removeFieldDefault = (field: z.ZodTypeAny): z.ZodTypeAny => {
    // Zod 4's `.unwrap()` / `.removeDefault()` return the core `$ZodType`, which is
    // structurally narrower than `ZodTypeAny`; cast at the boundary (runtime is fine).
    if (field instanceof z.ZodDefault) {
        return removeFieldDefault(field.removeDefault() as unknown as z.ZodTypeAny);
    }
    if (field instanceof z.ZodOptional) {
        return removeFieldDefault(field.unwrap() as unknown as z.ZodTypeAny).optional();
    }
    if (field instanceof z.ZodNullable) {
        return removeFieldDefault(field.unwrap() as unknown as z.ZodTypeAny).nullable();
    }
    // Any other wrapper (ZodCatch / ZodPipe / ZodEffects / etc.) is returned as-is —
    // see "Known boundary" above.
    return field;
};

export const stripShapeDefaults = <Shape extends z.ZodRawShape>(shape: Shape): Shape =>
    Object.fromEntries(
        Object.entries(shape).map(([key, field]) => [
            key,
            removeFieldDefault(field as unknown as z.ZodTypeAny)
        ])
    ) as unknown as Shape;

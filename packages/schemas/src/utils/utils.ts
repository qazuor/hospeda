import { z } from 'zod';

// Regex for slugs (e.g.: my-slug-123)
export const SlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Regex for time in HH:mm format (24h)
export const TimeRegExp = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Regex for international phone number (E.164): a leading "+", a 1-9 country-code
// digit, then 6-14 further digits (7-15 total) with optional single spaces as
// separators. Requiring at least 7 total digits rejects a bare country code like
// "+54" (which the previous `\d{1,14}` allowed as a 2-digit "number", HOS-190)
// while still accepting spaced local formats like "+54 11 1234 5678".
export const InternationalPhoneRegex = /^\+[1-9](?:\s?\d){6,14}$/;

/** Characters a human may type in a phone field (digits, optional leading `+`, separators). */
export const ArgentinePhoneRegex = /^\+?[0-9().\s-]+$/;

/**
 * Result of {@link parsePhoneNumber}.
 *
 * - `argentina`: ten national digits (area code + subscriber number) plus
 *   whether the number is a mobile line.
 * - `international`: an E.164 value kept exactly as typed (digits only), either
 *   because the country is not Argentina or because it is a legacy `+54` value
 *   that does not fit the ten-digit national shape.
 */
export type ParsedPhone =
    | { kind: 'argentina'; digits: string; mobile: boolean }
    | { kind: 'international'; value: string };

const NATIONAL_DIGITS = 10;
const MOBILE_MARKER = '15';

/**
 * Removes the domestic mobile marker (`15`) from a national-format number that
 * carries it (12 digits once the trunk `0` is gone).
 *
 * The marker sits right after the area code: `11` (2 digits) or a 3-4 digit
 * code. Only called for national-format input, never for `+54`/`54` numbers.
 */
const stripMobileMarker = (national: string): string | undefined => {
    const candidates = national.startsWith('11') ? [2, 3, 4] : [3, 4];
    const index = candidates.find((i) => national.slice(i, i + 2) === MOBILE_MARKER);
    return index === undefined ? undefined : national.slice(0, index) + national.slice(index + 2);
};

/**
 * Single source of truth for phone rules, shared by the validators and the
 * service-core normalizer (so the normalizer can never emit a value the
 * validator rejects).
 *
 * Rules, in order:
 * 1. Only digits, one leading `+` and `( ) . - space` are allowed.
 * 2. `+<country>` with a country other than 54 is kept as E.164 (7-15 digits).
 * 3. `+54` / `54` followed by an optional mobile `9` and exactly ten national
 *    digits is Argentine; the `9` marks a mobile. A ten-digit rest is never
 *    touched (a `15` inside it is part of the number). Editors compose
 *    `+54 <typed>`, so a longer rest is read like national input: a trunk `0`
 *    is dropped and a 12-digit rest loses its `15` marker.
 * 4. Any other `+54...` value that the historical {@link InternationalPhoneRegex}
 *    accepted stays valid and is kept as E.164 (never tightened).
 * 5. National format: an optional trunk `0`, then ten digits, or twelve digits
 *    when the `15` mobile marker follows the area code (which is dropped and
 *    marks a mobile).
 *
 * @param phone - Raw human input
 * @param mobileByMeaning - `true` when the field is mobile by meaning
 *   (`mobilePhone`, `whatsapp`)
 * @returns The parsed phone, or `undefined` when the input is not accepted
 */
export const parsePhoneNumber = (
    phone: string,
    mobileByMeaning = false
): ParsedPhone | undefined => {
    const trimmed = phone.trim();
    if (!ArgentinePhoneRegex.test(trimmed)) return undefined;
    const digits = trimmed.replace(/\D/g, '');
    const hasPlus = trimmed.startsWith('+');

    if (hasPlus && !digits.startsWith('54')) {
        const valid = digits.length >= 7 && digits.length <= 15 && !digits.startsWith('0');
        return valid ? { kind: 'international', value: `+${digits}` } : undefined;
    }

    if (digits.startsWith('54')) {
        const rest = digits.slice(2);
        const marked = rest.startsWith('9');
        const afterMarker = marked ? rest.slice(1) : rest;
        if (afterMarker.length === NATIONAL_DIGITS) {
            return { kind: 'argentina', digits: afterMarker, mobile: mobileByMeaning || marked };
        }
        // Editors compose "+54 <typed>", so the national part may still carry the
        // domestic trunk 0 and/or the 15 marker. A bare 9 prefix never does (area
        // codes do not start with 9), which also keeps legacy +549... values intact.
        if (!marked) {
            const national = rest.startsWith('0') ? rest.slice(1) : rest;
            if (national.length === NATIONAL_DIGITS) {
                return { kind: 'argentina', digits: national, mobile: mobileByMeaning };
            }
            if (national.length === NATIONAL_DIGITS + MOBILE_MARKER.length) {
                const stripped = stripMobileMarker(national);
                if (stripped) return { kind: 'argentina', digits: stripped, mobile: true };
            }
        }
        // Historical E.164 values (any length 7-15) stay valid, untouched.
        return hasPlus && InternationalPhoneRegex.test(trimmed)
            ? { kind: 'international', value: `+${digits}` }
            : undefined;
    }
    if (hasPlus) return undefined;

    const national = digits.startsWith('0') ? digits.slice(1) : digits;
    if (national.length === NATIONAL_DIGITS) {
        return { kind: 'argentina', digits: national, mobile: mobileByMeaning };
    }
    if (national.length === NATIONAL_DIGITS + MOBILE_MARKER.length) {
        const stripped = stripMobileMarker(national);
        if (stripped) return { kind: 'argentina', digits: stripped, mobile: true };
    }
    return undefined;
};

/** Accepts valid Argentine input and well-formed international E.164 numbers. */
export const isValidPhoneNumber = (phone: string): boolean => parsePhoneNumber(phone) !== undefined;

/** Compatibility alias for isValidPhoneNumber. */
export const isValidArgentinePhone = isValidPhoneNumber;

/** Normalizes an accepted phone to its canonical international representation. */
export const normalizeArgentinePhone = (phone: string, mobileByMeaning = false): string => {
    const parsed = parsePhoneNumber(phone, mobileByMeaning);
    if (!parsed) return phone;
    return parsed.kind === 'international'
        ? parsed.value
        : `+54${parsed.mobile ? '9' : ''}${parsed.digits}`;
};

/** Builds the shared Zod phone validator with a caller-specific translation key. */
export const phoneNumberSchema = (message: string) =>
    z.string().refine(isValidPhoneNumber, { message });

/** Compatibility alias for phoneNumberSchema. */
export const argentinePhoneSchema = phoneNumberSchema;

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

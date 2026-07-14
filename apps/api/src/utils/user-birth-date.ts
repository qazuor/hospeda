/**
 * Helper for converting the HTTP-layer `birthDate` wire format (validated by
 * `BirthDateHttpInputSchema` from `@repo/schemas`) into the `Date` shape the
 * domain layer (`UserService.update`) expects.
 *
 * Background (BETA-34): `UserSchema.birthDate` is `z.date().nullish()` on
 * the domain side, but the web app's `<input type="date">` — and every user
 * write route's HTTP schema override — only ever sends a plain `YYYY-MM-DD`
 * string (or `''` to clear the field). `transformApiInputToDomain()` does
 * NOT convert this value: its `isDateString()` detector only matches full
 * ISO-8601 datetimes (`YYYY-MM-DDTHH:mm:ss[.sss]Z`), not a bare calendar
 * date. Every user write route must therefore run this conversion
 * explicitly before calling the service.
 *
 * @module utils/user-birth-date
 */

/**
 * Converts a single HTTP-layer birth date value into its domain shape.
 *
 * @param value - The raw wire value: a `YYYY-MM-DD` string, `''` (clear), or
 *   `null` (clear).
 * @returns `Date` for a valid date string, `null` to clear the field.
 */
function toBirthDateDomainValue(value: string | null): Date | null {
    if (value === null || value === '') {
        return null;
    }
    return new Date(value);
}

/**
 * Applies {@link toBirthDateDomainValue} to the `birthDate` key of a
 * (already Zod-validated) request body, if present. Returns a new object;
 * the input is never mutated.
 *
 * - `birthDate` absent from `input` → returned unchanged (no field to
 *   convert; the service must not overwrite the existing value).
 * - `birthDate` already a `Date` → returned unchanged (defensive; covers a
 *   caller that already ran a prior conversion step).
 * - `birthDate` is `'YYYY-MM-DD'` / `''` / `null` → converted per
 *   {@link toBirthDateDomainValue}.
 *
 * @param input - The validated request body.
 * @returns A shallow copy of `input` with `birthDate` converted to its
 *   domain `Date | null` shape (or the original object when there was
 *   nothing to convert).
 */
export function withDomainBirthDate<T extends Record<string, unknown>>(input: T): T {
    if (!Object.hasOwn(input, 'birthDate')) {
        return input;
    }

    const raw = input.birthDate;

    if (raw === undefined || raw instanceof Date) {
        return input;
    }

    return {
        ...input,
        birthDate: toBirthDateDomainValue(raw as string | null)
    };
}

import type { User, UserCreateInput, UserUpdateInput } from '@repo/schemas';
import { toSlug } from '@repo/utils';
import type { Actor, ListOptions } from '../../types';
import { normalizeAdminInfo, normalizeContactInfo } from '../../utils';
import { generateUserSlug } from './user.helpers';

/**
 * The slug shape the PUBLIC author route accepts as a path param
 * (`apps/api/src/routes/user/public/getBySlug.ts`): lowercase alphanumerics,
 * segments joined by a single hyphen or underscore.
 *
 * It lives here, in the normalizer, and NOT on `UserCreateInputSchema` /
 * `UserUpdateInputSchema` — those are published write schemas, so a regex there
 * would be a narrowing the package's additive-only policy forbids, and it would
 * reject a value the caller never typed (the slug is derived). Repairing beats
 * rejecting for a derived field.
 */
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/**
 * Coerces a caller-supplied slug into the shape the public author URL can
 * address, leaving an already-conforming value byte-identical.
 *
 * Returns `undefined` when the input is absent, and — deliberately — when
 * `toSlug` cannot produce anything addressable from it (e.g. a slug of only
 * punctuation, or of characters `slugify` strips entirely). Dropping the key
 * means "no change" on an update and lets `generateUserSlug` take over on a
 * create, which is strictly better than persisting an empty slug: `users.slug`
 * is NOT NULL and every author URL is built from it.
 *
 * @param slug - The raw slug from the input, if any.
 * @returns The repaired slug, or `undefined` when there is nothing to write.
 */
const normalizeSlug = (slug: string | undefined): string | undefined => {
    if (slug === undefined) return undefined;

    const trimmed = slug.trim();
    if (PUBLIC_SLUG_PATTERN.test(trimmed)) return trimmed;

    const repaired = toSlug(trimmed);
    return repaired.length > 0 ? repaired : undefined;
};

/**
 * Normalizes the input data for creating a user.
 * Trims displayName, normalizes contact info, and lowercases emails.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (data: UserCreateInput, _actor: Actor): UserCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        displayName: data.displayName?.trim(),
        contactInfo: normalizedContactInfo
    };
};

/**
 * Normalizes the input data for updating a user.
 * Trims displayName and normalizes contact info if present.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (data: UserUpdateInput, _actor: Actor): UserUpdateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        displayName: data.displayName?.trim(),
        contactInfo: normalizedContactInfo
    };
};

/**
 * Normalizes the parameters for listing users.
 * Currently a pass-through.
 * @param params The original listing parameters.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) parameters.
 */
export const normalizeListInput = (params: ListOptions, _actor: Actor): ListOptions => {
    return params;
};

/**
 * Normalizes the parameters for viewing a single user.
 * Currently a pass-through.
 * @param field The field being queried (e.g., 'id', 'slug').
 * @param value The value for the query.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) field and value.
 */
export const normalizeViewInput = (
    field: string,
    value: unknown,
    _actor: Actor
): { field: string; value: unknown } => {
    return { field, value };
};

/** Which write path {@link normalizeUserInput} is normalizing for. */
export type UserNormalizeMode = 'create' | 'update';

/**
 * Normalizes user input: trims strings, repairs a supplied slug, and — on
 * CREATE only — derives one when it is missing.
 *
 * ## `mode` is why this is not one code path
 *
 * The slug is derived from the name, so the obvious rule ("no slug? derive one
 * from the name we have") is right on create and wrong on update. On an UPDATE
 * the input is a PARTIAL patch: a user renaming themselves sends
 * `{ displayName }` and no slug, and the old rule read that as "derive a new
 * slug" — silently rewriting `users.slug`.
 *
 * That was harmless while `/autores/<slug>/` was `noindex`. Under HOS-375 that
 * URL is indexed and listed in the sitemap, and nothing in this codebase issues
 * a redirect from an old user slug, so an unrelated profile edit would break
 * every inbound link and every Google result pointing at the author. A slug
 * change is a deliberate operation (see
 * `packages/seed/src/data-migrations/0041-editorial-author-slug.ts`), not a side
 * effect of editing a name.
 *
 * An explicitly supplied slug is still honoured on both paths — it is just
 * repaired into the public URL shape first (see {@link normalizeSlug}) rather
 * than rejected, which is what the write schemas would otherwise have to do.
 *
 * @param params - RO-RO input.
 * @param params.input - Partial user input.
 * @param params.mode - `'create'` derives a missing slug; `'update'` never does.
 * @returns The normalized input.
 */
export const normalizeUserInput = async ({
    input,
    mode
}: {
    readonly input: Partial<User>;
    readonly mode: UserNormalizeMode;
}): Promise<Partial<User>> => {
    // Exclude sensitive fields from normalization
    const { bookmarks, ...rest } = input as Partial<User> & { bookmarks?: unknown };
    const normalized: Partial<User> = { ...rest };

    // Trim string fields if present
    if (normalized.displayName) {
        normalized.displayName = normalized.displayName.trim();
    }
    if (normalized.firstName) {
        normalized.firstName = normalized.firstName.trim();
    }
    if (normalized.lastName) {
        normalized.lastName = normalized.lastName.trim();
    }

    // Repair a caller-supplied slug into the shape the public author URL can
    // address. `undefined` means "nothing usable was supplied": drop the key so
    // an update means "no change" and a create falls through to derivation.
    if (Object.hasOwn(normalized, 'slug')) {
        const repaired = normalizeSlug(normalized.slug);
        if (repaired === undefined) {
            delete normalized.slug;
        } else {
            normalized.slug = repaired;
        }
    }

    // Derive a slug ONLY on create — see the JSDoc for why an update must never
    // regenerate one.
    if (
        mode === 'create' &&
        !normalized.slug &&
        (normalized.displayName || normalized.firstName || normalized.lastName)
    ) {
        normalized.slug = await generateUserSlug(
            normalized as Pick<User, 'displayName' | 'firstName' | 'lastName'>
        );
    }

    // Normalize contact info if present
    if (normalized.contactInfo) {
        normalized.contactInfo = normalizeContactInfo(
            normalized.contactInfo
        ) as typeof normalized.contactInfo;
    }

    // Normalize admin info if present
    if (normalized.adminInfo) {
        normalized.adminInfo = normalizeAdminInfo(normalized.adminInfo);
    }

    return normalized;
};

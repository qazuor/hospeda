import type { User, UserCreateInput, UserUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';
import { normalizeAdminInfo, normalizeContactInfo } from '../../utils';
import { generateUserSlug } from './user.helpers';

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
export const normalizeListInput = (
    params: Record<string, unknown>,
    _actor: Actor
): Record<string, unknown> => {
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

/**
 * Normalizes user input: trims strings, lowercases emails, generates slug if missing.
 *
 * @param input - Partial user input
 * @returns {Promise<Partial<User>>} Normalized input
 */
export const normalizeUserInput = async (input: Partial<User>): Promise<Partial<User>> => {
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

    // Generate slug if missing and we have necessary fields
    if (
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

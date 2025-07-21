import type { CreateUserSchema, UpdateUserSchema } from '@repo/schemas/entities/user/user.schema';
import type { UserType } from '@repo/types';
import type { z } from 'zod';
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
export const normalizeCreateInput = (
    data: z.infer<typeof CreateUserSchema>,
    _actor: Actor
): z.infer<typeof CreateUserSchema> => {
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
export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateUserSchema>,
    _actor: Actor
): z.infer<typeof UpdateUserSchema> => {
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
 * @returns {Promise<Partial<UserType>>} Normalized input
 */
export const normalizeUserInput = async (input: Partial<UserType>): Promise<Partial<UserType>> => {
    // Handle data that might not have bookmarks (like CreateUserSchema)
    const { bookmarks, ...rest } = input as Partial<UserType> & { bookmarks?: unknown };
    const normalized: Partial<UserType> = { ...rest };
    if (normalized.displayName) normalized.displayName = normalized.displayName.trim();
    if (normalized.firstName) normalized.firstName = normalized.firstName.trim();
    if (normalized.lastName) normalized.lastName = normalized.lastName.trim();
    if (normalized.contactInfo?.personalEmail)
        normalized.contactInfo.personalEmail = normalized.contactInfo.personalEmail
            .trim()
            .toLowerCase();
    if (!normalized.slug) {
        normalized.slug = await generateUserSlug(
            normalized as Pick<UserType, 'displayName' | 'firstName' | 'lastName'>
        );
    }
    return normalized;
};

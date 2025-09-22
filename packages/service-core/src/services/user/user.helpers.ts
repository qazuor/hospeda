import { UserModel } from '@repo/db';
import type { User } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for a user based on displayName or firstName + lastName.
 * Ensures uniqueness by checking with the UserModel.
 *
 * @param input - User input (displayName, firstName, lastName)
 * @returns {Promise<string>} The unique slug
 */
export const generateUserSlug = async (
    input: Pick<User, 'displayName' | 'firstName' | 'lastName'>
): Promise<string> => {
    const base =
        input.displayName?.trim() || `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim();
    const model = new UserModel();
    return createUniqueSlug(base, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
};

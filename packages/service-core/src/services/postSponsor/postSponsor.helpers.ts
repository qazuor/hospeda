/**
 * Checks if a post sponsor name is unique.
 * Throws an error if the name already exists.
 * @param name The sponsor name to check.
 * @param model The PostSponsor model instance.
 */
export const checkPostSponsorNameUnique = async (
    // name: string,
    // model: PostSponsorModel
    ..._args: unknown[]
): Promise<void> => {
    // TODO: Implement uniqueness check using model
    // Example: if (await model.findOne({ name })) throw new Error('Name already exists');
};

// TODO: Add helpers for normalizing contact/social if needed

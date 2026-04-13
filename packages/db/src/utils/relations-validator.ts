import { dbLogger } from './logger.ts';

/**
 * Validates that all keys in the relations object are known valid relation names for a model.
 * Logs a warning for each unknown key found, aiding debugging when callers pass incorrect keys.
 *
 * @param relations - The relations object passed to findWithRelations
 * @param validKeys - Array of valid relation key names for this model
 * @param modelName - Name of the model (used in the warning message)
 */
export function warnUnknownRelationKeys(
    relations: Record<string, boolean | Record<string, unknown>>,
    validKeys: ReadonlyArray<string>,
    modelName: string
): void {
    for (const key of Object.keys(relations)) {
        if (!validKeys.includes(key)) {
            dbLogger.warn(
                { modelName, unknownKey: key, validKeys },
                `findWithRelations called with unknown relation key "${key}" on model "${modelName}". Valid keys: [${validKeys.join(', ')}]`
            );
        }
    }
}

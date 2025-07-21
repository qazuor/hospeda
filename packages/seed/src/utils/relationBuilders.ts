import type { SeedContext } from './seedContext.js';

/**
 * Service constructor type
 */
type ServiceConstructor<T = unknown> = new (ctx?: { logger?: unknown }) => T;

/**
 * Creates a many-to-many relation builder
 */
export const createManyToManyRelation = (
    targetEntity: string,
    relationField: string,
    serviceClass: ServiceConstructor,
    relationMethod: string
) => {
    return async (result: unknown, item: unknown, context: SeedContext) => {
        const sourceId = (result as { data?: { id?: string } })?.data?.id;
        if (!sourceId) return;

        const targetIds = ((item as Record<string, unknown>)[relationField] as string[]) || [];
        if (targetIds.length === 0) return;

        const service = new serviceClass({});
        const actor = context.actor;
        if (!actor) {
            throw new Error('Actor not available in context');
        }

        for (const seedId of targetIds) {
            const realId = context.idMapper.getRealId(targetEntity, seedId);
            if (realId) {
                try {
                    const serviceWithMethod = service as Record<string, unknown>;
                    const method = serviceWithMethod[relationMethod];
                    if (typeof method === 'function') {
                        await method(actor, {
                            [`${targetEntity}Id`]: realId,
                            [`${context.currentEntity?.toLowerCase()}Id`]: sourceId
                        });
                    }
                } catch (error: unknown) {
                    const err = error as { code?: string; message?: string };

                    if (err.code === 'ALREADY_EXISTS') {
                        // Relationship already exists, this is fine
                        continue;
                    }

                    const errorMessage = `❌ Failed to create ${targetEntity} relationship: ${err.message}`;

                    if (context.continueOnError) {
                        console.warn(`⚠️ ${errorMessage}`);
                    } else {
                        throw new Error(errorMessage);
                    }
                }
            }
        }
    };
};

/**
 * Creates a one-to-many relation builder
 */
export const createOneToManyRelation = (
    targetEntity: string,
    relationField: string,
    serviceClass: ServiceConstructor,
    relationMethod: string
) => {
    return async (result: unknown, item: unknown, context: SeedContext) => {
        const sourceId = (result as { data?: { id?: string } })?.data?.id;
        if (!sourceId) return;

        const targetIds = ((item as Record<string, unknown>)[relationField] as string[]) || [];
        if (targetIds.length === 0) return;

        const service = new serviceClass({});
        const actor = context.actor;
        if (!actor) {
            throw new Error('Actor not available in context');
        }

        for (const seedId of targetIds) {
            const realId = context.idMapper.getRealId(targetEntity, seedId);
            if (realId) {
                try {
                    const serviceWithMethod = service as Record<string, unknown>;
                    const method = serviceWithMethod[relationMethod];
                    if (typeof method === 'function') {
                        await method(actor, {
                            id: realId,
                            [`${context.currentEntity?.toLowerCase()}Id`]: sourceId
                        });
                    }
                } catch (error: unknown) {
                    const err = error as { code?: string; message?: string };

                    const errorMessage = `❌ Failed to update ${targetEntity} relationship: ${err.message}`;

                    if (context.continueOnError) {
                        console.warn(`⚠️ ${errorMessage}`);
                    } else {
                        throw new Error(errorMessage);
                    }
                }
            }
        }
    };
};

/**
 * Creates a custom relation builder with validation
 */
export const createCustomRelationBuilder = (
    targetEntity: string,
    relationField: string,
    validator: (
        context: SeedContext,
        seedIds: string[]
    ) => { isValid: boolean; validIds: string[]; missingIds: string[] }
) => {
    return async (result: unknown, item: unknown, context: SeedContext) => {
        const sourceId = (result as { data?: { id?: string } })?.data?.id;
        if (!sourceId) return;

        const seedIds = ((item as Record<string, unknown>)[relationField] as string[]) || [];
        if (seedIds.length === 0) return;

        const validation = validator(context, seedIds);

        if (!validation.isValid) {
            const missingIdsList = validation.missingIds.map((id) => `  • ${id}`).join('\n');
            const errorMessage = `❌ Missing ${targetEntity} mappings:\n${missingIdsList}`;

            if (context.continueOnError) {
                console.warn(`⚠️ ${errorMessage}`);
                console.warn(
                    `Continuing with ${validation.validIds.length} valid ${targetEntity}s`
                );
            } else {
                throw new Error(errorMessage);
            }
        }

        // Process valid IDs
        for (const seedId of validation.validIds) {
            const realId = context.idMapper.getRealId(targetEntity, seedId);
            if (realId) {
                // Custom logic for creating the relationship
                await createCustomRelation(sourceId, realId, context);
            }
        }
    };
};

/**
 * Helper function for creating custom relations
 */
async function createCustomRelation(sourceId: string, targetId: string, _context: SeedContext) {
    // This would be implemented based on the specific relationship type
    // For now, it's a placeholder that can be overridden
    // biome-ignore lint/suspicious/noConsoleLog: Custom relation logging
    console.log(`Creating custom relation: ${sourceId} -> ${targetId}`);
}

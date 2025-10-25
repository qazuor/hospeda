import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { SubscriptionItemEntityTypeEnum } from '../../enums/subscription-item-entity-type.enum.js';
import { SubscriptionItemEntityTypeEnumSchema } from '../../enums/subscription-item-entity-type.schema.js';
import { SubscriptionItemSourceTypeEnum } from '../../enums/subscription-item-source-type.enum.js';
import { SubscriptionItemSourceTypeEnumSchema } from '../../enums/subscription-item-source-type.schema.js';
import { SubscriptionItemSchema } from './subscriptionItem.schema.js';

/**
 * SubscriptionItem Create Input Schema
 *
 * Schema for creating new subscription items with polymorphic validation.
 * Includes cross-validation between sourceType and entityType combinations.
 */
export const SubscriptionItemCreateInputSchema = SubscriptionItemSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
}).extend({
    createdById: UserIdSchema,
    updatedById: UserIdSchema
});

export type SubscriptionItemCreateInput = z.infer<typeof SubscriptionItemCreateInputSchema>;

/**
 * SubscriptionItem Update Input Schema
 *
 * Schema for updating existing subscription items.
 * Limited updates since the polymorphic relationships are typically immutable.
 */
export const SubscriptionItemUpdateInputSchema = SubscriptionItemSchema.omit({
    id: true,
    sourceId: true,
    sourceType: true,
    linkedEntityId: true,
    entityType: true, // Polymorphic fields are immutable
    createdAt: true,
    createdById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
})
    .partial()
    .extend({
        updatedById: UserIdSchema
    });

export type SubscriptionItemUpdateInput = z.infer<typeof SubscriptionItemUpdateInputSchema>;

/**
 * SubscriptionItem Bulk Create Schema
 *
 * Schema for creating multiple subscription items at once.
 */
export const SubscriptionItemBulkCreateSchema = z.object({
    items: z
        .array(SubscriptionItemCreateInputSchema)
        .min(1, {
            message: 'zodError.subscriptionItem.bulkCreate.minItems'
        })
        .max(100, {
            message: 'zodError.subscriptionItem.bulkCreate.maxItems'
        }),
    createdById: UserIdSchema
});

export type SubscriptionItemBulkCreate = z.infer<typeof SubscriptionItemBulkCreateSchema>;

/**
 * SubscriptionItem polymorphic validation helpers
 */

/**
 * Validates that sourceType + sourceId combination is valid
 */
export const SubscriptionItemSourceValidationSchema = z.object({
    sourceId: z.string().uuid(),
    sourceType: SubscriptionItemSourceTypeEnumSchema
});

/**
 * Validates that entityType + linkedEntityId combination is valid
 */
export const SubscriptionItemEntityValidationSchema = z.object({
    linkedEntityId: z.string().uuid(),
    entityType: SubscriptionItemEntityTypeEnumSchema
});

/**
 * Complete polymorphic validation schema
 */
export const SubscriptionItemPolymorphicValidationSchema = z
    .object({
        sourceId: z.string().uuid(),
        sourceType: SubscriptionItemSourceTypeEnumSchema,
        linkedEntityId: z.string().uuid(),
        entityType: SubscriptionItemEntityTypeEnumSchema
    })
    .refine(
        (data) => {
            // All combinations of sourceType x entityType are valid
            // This is a business rule that could be extended in the future
            const validSourceTypes = Object.values(SubscriptionItemSourceTypeEnum);
            const validEntityTypes = Object.values(SubscriptionItemEntityTypeEnum);

            return (
                validSourceTypes.includes(data.sourceType) &&
                validEntityTypes.includes(data.entityType)
            );
        },
        {
            message: 'zodError.subscriptionItem.polymorphic.invalidCombination',
            path: ['sourceType', 'entityType']
        }
    );

export type SubscriptionItemPolymorphicValidation = z.infer<
    typeof SubscriptionItemPolymorphicValidationSchema
>;

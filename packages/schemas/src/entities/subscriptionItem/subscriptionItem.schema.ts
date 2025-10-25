import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SubscriptionItemIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { SubscriptionItemEntityTypeEnumSchema } from '../../enums/subscription-item-entity-type.schema.js';
import { SubscriptionItemSourceTypeEnumSchema } from '../../enums/subscription-item-source-type.schema.js';

/**
 * SubscriptionItem Schema - Core Polymorphic Entity
 *
 * This schema defines the complete structure of a SubscriptionItem entity
 * according to the new business model for Hospeda.
 *
 * Represents the core polymorphic entity that links subscriptions/purchases
 * to various target entities (sponsorships, campaigns, listings, etc.)
 *
 * Polymorphic Structure:
 * - sourceId + sourceType: Points to SUBSCRIPTION or PURCHASE
 * - linkedEntityId + entityType: Points to target entity (SPONSORSHIP, CAMPAIGN, etc.)
 */
export const SubscriptionItemSchema = z.object({
    // Base fields
    id: SubscriptionItemIdSchema,
    ...BaseAuditFields,

    // Polymorphic source fields (subscription or purchase)
    sourceId: z.string().uuid({ message: 'zodError.subscriptionItem.sourceId.invalidUuid' }),
    sourceType: SubscriptionItemSourceTypeEnumSchema,

    // Polymorphic target fields (linked entity)
    linkedEntityId: z
        .string()
        .uuid({ message: 'zodError.subscriptionItem.linkedEntityId.invalidUuid' }),
    entityType: SubscriptionItemEntityTypeEnumSchema,

    // Base field groups following established patterns
    ...BaseLifecycleFields,
    ...BaseAdminFields
});

export type SubscriptionItem = z.infer<typeof SubscriptionItemSchema>;

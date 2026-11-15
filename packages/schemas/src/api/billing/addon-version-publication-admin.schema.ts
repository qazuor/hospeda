import { z } from 'zod';

const Id = z.uuid();
const Price = z.int().positive();
const Policy = z.object({
    addonId: Id,
    validity: z.enum(['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE']),
    validityDays: z.int().positive().nullable(),
    scopeType: z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'])
});

/** Request for the action 20 publication preview. */
export const AddonVersionPublicationPreviewRequestSchema = z.strictObject({
    addonVersionId: Id,
    price: Price
});

/** Billing confirmation for a proposed addon version and price. */
export const AddonVersionPublicationConfirmationSchema = z.object({
    current: z.object({ versionId: Id, price: Price, policy: Policy }),
    proposed: z.object({ versionId: Id, price: Price, policy: Policy }),
    changes: z.array(z.enum(['VERSION', 'PRICE'])),
    liveInstancesOnCurrentVersion: z.int().nonnegative(),
    alreadyPurchasedStaysAnchored: z.literal(true)
});

/** Strict compare-and-swap request for action 20. */
export const PublishAddonVersionRequestSchema = z.strictObject({
    addonVersionId: Id,
    price: Price,
    expectedCurrentVersionId: Id,
    expectedCurrentPrice: Price
});

/** Persisted product and domain event returned after publication. */
export const AddonVersionPublishedResponseSchema = z.object({
    product: z.object({ id: Id, addonId: Id, versionId: Id, price: Price }),
    domainEventId: Id
});

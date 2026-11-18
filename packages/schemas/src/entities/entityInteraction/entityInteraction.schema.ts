import { z } from 'zod';
import { EntityInteractionKindEnum } from '../../enums/entity-interaction-kind.enum.js';
import { EntityInteractionKindEnumSchema } from '../../enums/entity-interaction-kind.schema.js';
import { EntityTypeEnum } from '../../enums/entity-type.enum.js';

/**
 * Entity types whose interactions can be captured (HOS-2256).
 *
 * Distinct from `TRACKABLE_ENTITY_TYPES` (views): the table is generic by
 * `entity_type`, but only venues have anything to click today.
 */
export const TRACKABLE_INTERACTION_ENTITY_TYPES = [EntityTypeEnum.VENUE] as const;

/** Entity type of a capturable interaction. */
export type TrackableInteractionEntityType = (typeof TRACKABLE_INTERACTION_ENTITY_TYPES)[number];

/** Which interaction kinds each trackable entity type admits. */
export const INTERACTION_KINDS_BY_ENTITY_TYPE: Readonly<
    Record<TrackableInteractionEntityType, readonly EntityInteractionKindEnum[]>
> = {
    [EntityTypeEnum.VENUE]: [
        EntityInteractionKindEnum.PHONE_CLICK,
        EntityInteractionKindEnum.MAP_CLICK,
        EntityInteractionKindEnum.WEBSITE_CLICK,
        EntityInteractionKindEnum.INSTAGRAM_CLICK,
        EntityInteractionKindEnum.TICKET_CLICK,
        EntityInteractionKindEnum.WHATSAPP_CLICK
        // EVENT_IMPRESSION is deliberately NOT admitted yet: nothing emits it, so
        // accepting it would only let a script seed a metric nobody reads.
        // HOS-2265 adds it here when it ships the emitter (the enum value and the
        // DB CHECK already allow it, so no migration is needed).
    ]
};

/** Kinds that refer to one event of the listing and therefore REQUIRE an event id. */
export const EVENT_INTERACTION_KINDS: readonly EntityInteractionKindEnum[] = [
    EntityInteractionKindEnum.TICKET_CLICK,
    EntityInteractionKindEnum.EVENT_IMPRESSION
];

/**
 * Body of `POST /api/v1/public/interactions`.
 *
 * The client sends only what it cannot usefully lie about. `visitorHash` is
 * computed server-side and never accepted from the caller.
 *
 * Cross-field rules: `kind` must be valid for `entityType`, `eventId` is
 * mandatory for event kinds and forbidden for the rest.
 */
export const EntityInteractionCaptureBodySchema = z
    .object({
        entityType: z.enum(TRACKABLE_INTERACTION_ENTITY_TYPES, {
            message: 'zodError.entityInteraction.entityType.invalid'
        }),
        entityId: z
            .string({ message: 'zodError.entityInteraction.entityId.required' })
            .uuid({ message: 'zodError.entityInteraction.entityId.invalidUuid' }),
        kind: EntityInteractionKindEnumSchema,
        eventId: z
            .string({ message: 'zodError.entityInteraction.eventId.invalidUuid' })
            .uuid({ message: 'zodError.entityInteraction.eventId.invalidUuid' })
            .optional()
    })
    .superRefine((value, ctx) => {
        const admittedKinds = INTERACTION_KINDS_BY_ENTITY_TYPE[value.entityType];
        if (!admittedKinds.includes(value.kind)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['kind'],
                message: 'zodError.entityInteraction.kind.notForEntityType'
            });
            return;
        }
        const isEventKind = EVENT_INTERACTION_KINDS.includes(value.kind);
        if (isEventKind && value.eventId === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['eventId'],
                message: 'zodError.entityInteraction.eventId.required'
            });
        }
        if (!isEventKind && value.eventId !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['eventId'],
                message: 'zodError.entityInteraction.eventId.forbidden'
            });
        }
    });

/** Inferred type of the interaction capture body. */
export type EntityInteractionCaptureBody = z.infer<typeof EntityInteractionCaptureBodySchema>;

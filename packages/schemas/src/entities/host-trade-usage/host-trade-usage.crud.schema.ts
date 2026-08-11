import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { HOST_TRADE_USAGE_REJECTION_NOTE_MAX } from '../host-trade/host-trade-usage.constants.js';
import { HostTradeBenefitUsageSchema } from './host-trade-usage.schema.js';

/**
 * @file host-trade-usage.crud.schema.ts
 * @description Write shapes for benefit usages (HOS-376 §7.5).
 *
 * The security model here is ABSENCE, following `host-trade.owner.schema.ts`:
 * a field the client may not set is one these schemas do not declare. On top of
 * that, every HTTP body carries `.strict()`, so an injected key is REJECTED
 * rather than silently stripped — an impersonation attempt should fail loudly
 * at the door, not succeed quietly minus one field.
 */

// ============================================================================
// CREATE — service layer
// ============================================================================

/**
 * What the SERVICE supplies when opening a usage record.
 *
 * Everything the state machine owns is absent: `status` starts at `PENDING`,
 * `expiresAt` is derived from the clock, and the confirm/reject/reminder
 * columns are written only by the transitions that earn them.
 */
export const HostTradeBenefitUsageCreateInputSchema = HostTradeBenefitUsageSchema.omit({
    id: true,
    status: true,
    expiresAt: true,
    reminderSentAt: true,
    confirmedAt: true,
    confirmedById: true,
    rejectedAt: true,
    rejectedById: true,
    rejectionNote: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** Inferred type for {@link HostTradeBenefitUsageCreateInputSchema}. */
export type HostTradeBenefitUsageCreateInput = z.infer<
    typeof HostTradeBenefitUsageCreateInputSchema
>;

/**
 * The fields BOTH HTTP create bodies share: what happened, and when.
 *
 * Everything identifying the two parties is resolved server-side and is
 * therefore absent here — see each body below for where its identifiers
 * actually come from.
 */
const HostTradeBenefitUsageCreateBodyBaseSchema = HostTradeBenefitUsageCreateInputSchema.omit({
    hostTradeId: true,
    hostUserId: true,
    declaredBy: true,
    declaredById: true,
    creationChannel: true
});

// ============================================================================
// CREATE — HTTP bodies
// ============================================================================

/**
 * Body for `POST /protected/host-trades/{slug}/usages` — the QR path (§6.2a).
 *
 * Carries no identifiers at all, and does not need any: the provider comes from
 * the `{slug}` in the URL the QR encodes, and THE HOST IS HIS OWN SESSION. That
 * is precisely why the QR is the primary path — the identification problem the
 * other two channels have to solve simply does not arise here.
 */
export const HostTradeBenefitUsageHostCreateBodySchema =
    HostTradeBenefitUsageCreateBodyBaseSchema.strict();

/** Inferred type for {@link HostTradeBenefitUsageHostCreateBodySchema}. */
export type HostTradeBenefitUsageHostCreateBody = z.infer<
    typeof HostTradeBenefitUsageHostCreateBodySchema
>;

/**
 * Body for `POST /protected/host-trades/mine/usages` — the provider's two
 * channels (§6.2b and §6.2c).
 *
 * The provider is resolved from row ownership, never from the body. The HOST is
 * identified by EXACTLY ONE of:
 *
 * - `hostUserId` — picked from the scoped selector, which only ever lists hosts
 *   who already confirmed a usage with him. Zero data exposure.
 * - `hostEmail` — the fallback for a first-time client. Resolving it to nobody
 *   answers `404 HOST_NOT_FOUND` explicitly rather than opaquely: a typo is the
 *   most common failure here, and hiding it makes the provider wait thirty days
 *   for a pending row that was never going to resolve.
 *
 * Exactly one, not "at least one": accepting both would leave the server to
 * pick a winner, and a mismatched pair is a mistake worth surfacing rather than
 * silently resolving to whichever field the implementation happens to read first.
 */
export const HostTradeBenefitUsageProviderCreateBodySchema =
    HostTradeBenefitUsageCreateBodyBaseSchema.extend({
        /** Host chosen from the scoped selector. Mutually exclusive with `hostEmail`. */
        hostUserId: UserIdSchema.optional(),
        /** Host addressed by email. Mutually exclusive with `hostUserId`. */
        hostEmail: z
            .string()
            .email({ message: 'zodError.hostTradeUsage.hostEmail.invalid' })
            .optional()
    })
        .strict()
        .superRefine((value, ctx) => {
            const provided = [value.hostUserId, value.hostEmail].filter(
                (candidate) => candidate !== undefined
            ).length;
            if (provided !== 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'zodError.hostTradeUsage.hostIdentifier.exactlyOne',
                    path: ['hostUserId']
                });
            }
        });

/** Inferred type for {@link HostTradeBenefitUsageProviderCreateBodySchema}. */
export type HostTradeBenefitUsageProviderCreateBody = z.infer<
    typeof HostTradeBenefitUsageProviderCreateBodySchema
>;

// ============================================================================
// TRANSITIONS
// ============================================================================

/**
 * Body for `POST /protected/host-trades/usages/{id}/reject`.
 *
 * The note is optional because a rejection must stay cheap. Requiring an
 * explanation to say "that never happened" adds friction to the one control
 * that keeps the counter honest, and the silence of a host who could not be
 * bothered to write a paragraph is worth less than his explicit "no".
 *
 * `rejectedById` and `rejectedAt` are absent: the server stamps them from the
 * actor and the clock.
 */
export const HostTradeBenefitUsageRejectBodySchema = z
    .object({
        note: z
            .string()
            .max(HOST_TRADE_USAGE_REJECTION_NOTE_MAX, {
                message: 'zodError.hostTradeUsage.rejectionNote.max'
            })
            .optional()
    })
    .strict();

/** Inferred type for {@link HostTradeBenefitUsageRejectBodySchema}. */
export type HostTradeBenefitUsageRejectBody = z.infer<typeof HostTradeBenefitUsageRejectBodySchema>;

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Partial update of a usage record.
 *
 * Deliberately narrow: only the descriptive fields are here. A status change is
 * a TRANSITION, not an update — it has its own endpoint, its own permission
 * check on who the counterpart is, and its own stamping of who acted and when.
 * Exposing `status` to a generic PATCH would let one side confirm its own
 * declaration, which is the whole thing this domain exists to prevent.
 */
// Zod 4 `.partial()` keeps `.default()`; strip them so an absent key means "no change".
export const HostTradeBenefitUsageUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            HostTradeBenefitUsageSchema.pick({
                servicedAt: true,
                note: true
            }).shape
        )
    )
    .partial()
    .strict();

/** Inferred type for {@link HostTradeBenefitUsageUpdateInputSchema}. */
export type HostTradeBenefitUsageUpdateInput = z.infer<
    typeof HostTradeBenefitUsageUpdateInputSchema
>;

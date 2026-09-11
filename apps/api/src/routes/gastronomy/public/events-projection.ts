/**
 * Public projection gate for a gastronomy listing's venue events (HOS-1042).
 *
 * Extracted out of `getBySlug.ts` for the same reason `menu-projection.ts` was:
 * the withholding rule gets a direct unit-test surface, independent of building
 * a full `GastronomyPublicSchema` fixture through the route/HTTP layer.
 *
 * ## Two filters, not one, and they refuse for different reasons
 *
 * 1. **The entitlement.** The owner's CURRENT gastronomy plan must grant
 *    `MANAGE_GASTRONOMY_EVENTS`. Rows written while a `-pro` subscription was
 *    live are NOT deleted when it lapses (see
 *    `resolveOwnerGastronomyPlanEntitlements` in `@repo/service-core`) — they
 *    simply stop being published, which is what stops a lapsed venue from
 *    keeping the paid presentation for free.
 * 2. **`isActive`.** The owner parked the entry. This one has nothing to do
 *    with billing: the winter cena show is switched off in December and back on
 *    next year, and the OWNER's read (`GET .../events`) deliberately still
 *    returns it so they can switch it back.
 *
 * Order does not matter between them — both are refusals — but keeping them
 * separate does: conflating "you did not pay for this" with "you turned this
 * off" is how a future reader concludes that resubscribing should un-park
 * everything.
 *
 * @module routes/gastronomy/public/events-projection
 */
import type { GastronomyEventPublic } from '@repo/schemas';

/** The projected field, ready to spread into the public response. */
export interface GastronomyEventsGateResult {
    readonly venueEvents: readonly GastronomyEventPublic[] | undefined;
}

/**
 * Withholds the venue agenda when the owner's CURRENT gastronomy plan does not
 * grant `manage_gastronomy_events`, and drops the entries the owner switched
 * off.
 *
 * @param input.events - The agenda as read, in display order. May be non-empty
 *   even when `ownerGrantsVenueEvents` is `false` — a downgraded owner's rows
 *   are not deleted.
 * @param input.ownerGrantsVenueEvents - The live entitlement check result.
 * @returns The field to spread into the public response. `venueEvents` is
 *   `undefined` (not `[]`) when nothing survives, matching the "not loaded" vs
 *   "empty" convention `amenities` / `features` / `menuSections` already use on
 *   this schema.
 */
export function applyGastronomyVenueEventsGate(input: {
    readonly events: readonly GastronomyEventPublic[];
    readonly ownerGrantsVenueEvents: boolean;
}): GastronomyEventsGateResult {
    const { events, ownerGrantsVenueEvents } = input;

    if (!ownerGrantsVenueEvents) {
        return { venueEvents: undefined };
    }

    const visible = events.filter((event) => event.isActive);

    return { venueEvents: visible.length > 0 ? visible : undefined };
}

/**
 * Public projection gate for an experience's how-to-get-there half (HOS-1049).
 *
 * Extracted out of the two public detail routes so the withholding rule has a
 * direct unit-test surface, independent of building a full
 * `ExperiencePublicSchema` fixture through the route/HTTP layer. Same shape,
 * and same reason, as `routes/gastronomy/public/menu-projection.ts`.
 *
 * @module routes/experience/public/directions-projection
 */

/** What the public route needs from the stored listing to project directions. */
export interface ExperienceDirectionsGateSource {
    readonly meetingPointDirections?: readonly string[] | null | undefined;
}

/** The projected fields, ready to spread into the public response. */
export interface ExperienceDirectionsGateResult {
    readonly meetingPointDirections: readonly string[] | undefined;
    readonly meetingPointDirectionsEnabled: boolean;
}

/**
 * Withholds the how-to-get-there instructions, and tells the page not to draw
 * the map, when the provider's CURRENT experience plan does not grant
 * `manage_experience_directions`.
 *
 * The stored rows are NOT deleted (see `resolveOwnerGrantsExperienceDirections`
 * in `@repo/service-core`) — a downgraded provider's instructions survive and
 * reappear the moment they upgrade again.
 *
 * `meetingPoint`, `meetingPointLat` and `meetingPointLong` are NOT parameters
 * here on purpose: all three are ficha data on every tier (HOS-1048) and are
 * never withheld. The caller passes them through unchanged. That is exactly why
 * {@link ExperienceDirectionsGateResult.meetingPointDirectionsEnabled} has to
 * exist — the coordinates reach the page either way, so their presence cannot
 * be what decides whether the paid map is drawn.
 *
 * @param input.experience - The stored `meetingPointDirections` column.
 * @param input.ownerGrantsDirections - The live entitlement check result.
 * @returns The fields to spread into the public response.
 *   `meetingPointDirections` is `undefined` (not `[]`) when withheld or empty,
 *   matching the "not loaded" vs "empty" convention `amenities`/`features`
 *   already use on this schema.
 */
export function applyExperienceDirectionsGate(input: {
    readonly experience: ExperienceDirectionsGateSource;
    readonly ownerGrantsDirections: boolean;
}): ExperienceDirectionsGateResult {
    const { experience, ownerGrantsDirections } = input;

    if (!ownerGrantsDirections) {
        return { meetingPointDirections: undefined, meetingPointDirectionsEnabled: false };
    }

    const directions = experience.meetingPointDirections ?? [];

    return {
        meetingPointDirections: directions.length > 0 ? directions : undefined,
        meetingPointDirectionsEnabled: true
    };
}

/**
 * Strips the paid half off every item of a public LIST payload (HOS-1049).
 *
 * A list route resolves no entitlement — one owner lookup per card would turn
 * a 24-item page into 24 extra round trips — and `meetingPointDirections` is
 * named on `ExperiencePublicSchema`, so without this the stored column would
 * ride out on the cards for free while the detail routes gate it. A card has
 * no use for walking directions anyway; the map and the instructions belong to
 * the detail page.
 *
 * Implemented by calling {@link applyExperienceDirectionsGate} with
 * `ownerGrantsDirections: false` rather than by deleting the key inline, so
 * there is exactly ONE definition of what "withheld" looks like on the wire.
 *
 * @param items - The search result items, straight from the service.
 * @returns The same items with the directions withheld and the flag `false`.
 */
export function withholdExperienceDirectionsFromList<T extends ExperienceDirectionsGateSource>(
    items: readonly T[]
): (T & ExperienceDirectionsGateResult)[] {
    return items.map((item) => ({
        ...item,
        ...applyExperienceDirectionsGate({ experience: item, ownerGrantsDirections: false })
    }));
}

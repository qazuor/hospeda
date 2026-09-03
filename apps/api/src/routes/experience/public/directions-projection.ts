/**
 * Public projection gate for an experience's how-to-get-there half (HOS-1049).
 *
 * Extracted out of the public routes so the withholding rule has a direct
 * unit-test surface, independent of building a full `ExperiencePublicSchema`
 * fixture through the route/HTTP layer. Same purpose as
 * `routes/gastronomy/public/menu-projection.ts`.
 *
 * ## It REMOVES the key; it does not set it to `undefined`
 *
 * The schema half of this gate — `meetingPointDirections` declared
 * `.optional()` on `ExperiencePublicSchema` rather than picked from the base —
 * is a promise about TYPES. What actually flows through a public route is a raw
 * database row, and a `{ ...row, meetingPointDirections: undefined }` spread
 * leaves the key PRESENT with an undefined value. `JSON.stringify` happens to
 * drop it, which is exactly what makes that bug invisible: the wire looks right
 * while the object does not, and anything that inspects the object before
 * serialization — a test, a cache layer, a future SSR path — sees a key that
 * was supposed to be gone.
 *
 * So this returns the projected object with the key genuinely destructured
 * away, and its tests assert `not.toHaveProperty` rather than `toBeUndefined`:
 * the two are indistinguishable to `toBeUndefined`, and only the first says
 * what this gate actually promises. (Measured on HOS-1045.)
 *
 * @module routes/experience/public/directions-projection
 */

/** What the gate needs from the stored listing. */
export interface ExperienceDirectionsGateSource {
    readonly meetingPointDirections?: readonly string[] | null | undefined;
}

/** The fields the gate adds on top of whatever it was handed. */
export interface ExperienceDirectionsGateFields {
    readonly meetingPointDirections?: readonly string[];
    readonly meetingPointDirectionsEnabled: boolean;
}

/** The projected object: the input minus the raw column, plus the gate's own. */
export type ExperienceDirectionsGateResult<T extends ExperienceDirectionsGateSource> = Omit<
    T,
    'meetingPointDirections'
> &
    ExperienceDirectionsGateFields;

/**
 * Withholds the how-to-get-there instructions, and tells the page not to draw
 * the map, when the provider's CURRENT experience plan does not grant
 * `manage_experience_directions`.
 *
 * The stored rows are NOT deleted (see `resolveOwnerGrantsExperienceDirections`
 * in `@repo/service-core`) — a downgraded provider's instructions survive and
 * reappear the moment they upgrade again.
 *
 * `meetingPoint`, `meetingPointLat` and `meetingPointLong` pass through
 * untouched on purpose: all three are ficha data on every tier (HOS-1048) and
 * are never withheld. That is exactly why
 * {@link ExperienceDirectionsGateFields.meetingPointDirectionsEnabled} has to
 * exist — the coordinates reach the page either way, so their presence cannot
 * be what decides whether the paid map is drawn.
 *
 * @param input.experience - The listing, as read.
 * @param input.ownerGrantsDirections - The live entitlement check result.
 * @returns The listing carrying `meetingPointDirections` ONLY when the provider
 *   is entitled and wrote at least one — matching the "not loaded" vs "empty"
 *   convention `amenities`/`features` already use on this schema.
 */
export function applyExperienceDirectionsGate<T extends ExperienceDirectionsGateSource>(input: {
    readonly experience: T;
    readonly ownerGrantsDirections: boolean;
}): ExperienceDirectionsGateResult<T> {
    const { experience, ownerGrantsDirections } = input;

    // Destructured OUT, not overwritten with `undefined`. See the module doc.
    const { meetingPointDirections, ...rest } = experience;

    const withheld = { ...rest, meetingPointDirectionsEnabled: false };
    if (!ownerGrantsDirections) {
        return withheld as ExperienceDirectionsGateResult<T>;
    }

    const directions = meetingPointDirections ?? [];

    if (directions.length === 0) {
        return {
            ...rest,
            meetingPointDirectionsEnabled: true
        } as ExperienceDirectionsGateResult<T>;
    }

    return {
        ...rest,
        meetingPointDirections: directions,
        meetingPointDirectionsEnabled: true
    } as ExperienceDirectionsGateResult<T>;
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
 * @returns The same items with the directions removed and the flag `false`.
 */
export function withholdExperienceDirectionsFromList<T extends ExperienceDirectionsGateSource>(
    items: readonly T[]
): ExperienceDirectionsGateResult<T>[] {
    return items.map((experience) =>
        applyExperienceDirectionsGate({ experience, ownerGrantsDirections: false })
    );
}

import { VerticalEnum } from '../enums/vertical.enum.js';

/**
 * Whether each vertical owns publications, i.e. listings the account manages from
 * the publications hub (HOS-2565 D16).
 *
 * This is the ONLY place that rule lives. Consumers ask
 * {@link resolveEmailAccountLink} and never compare `VerticalEnum` members
 * themselves: per-vertical branches scattered through the code have caused bugs
 * before. Typed as a full `Record` so adding a vertical does not compile until
 * someone decides its value.
 */
export const VERTICAL_OWNS_PUBLICATIONS: Readonly<Record<VerticalEnum, boolean>> = {
    [VerticalEnum.ACCOMMODATION]: true,
    [VerticalEnum.VENUE]: true,
    [VerticalEnum.EXPERIENCE]: true,
    [VerticalEnum.TOURIST]: false,
    [VerticalEnum.PARTNER]: false
};

/** Which account link the user email footer shows (HOS-2565 D16). */
export type EmailAccountLink = 'publications' | 'account';

/**
 * Picks the user email footer's account link from the verticals a recipient holds.
 *
 * `'publications'` when ANY of them owns publications (so partner plus a listing
 * vertical gives `'publications'`), `'account'` otherwise: partner alone, tourist
 * alone, no vertical, or a value this map does not know.
 *
 * @param input - RO-RO input.
 * @param input.verticals - The recipient's verticals; empty or absent when unknown.
 * @returns `{ accountLink }`.
 *
 * @example
 * ```ts
 * resolveEmailAccountLink({ verticals: ['partner', 'venue'] }); // { accountLink: 'publications' }
 * resolveEmailAccountLink({ verticals: ['tourist'] }); // { accountLink: 'account' }
 * ```
 */
export function resolveEmailAccountLink(input: {
    readonly verticals?: readonly (VerticalEnum | `${VerticalEnum}`)[];
}): { readonly accountLink: EmailAccountLink } {
    const ownsPublications = (input.verticals ?? []).some(
        (vertical) => VERTICAL_OWNS_PUBLICATIONS[vertical as VerticalEnum] === true
    );
    return { accountLink: ownsPublications ? 'publications' : 'account' };
}

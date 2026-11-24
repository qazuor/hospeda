/**
 * @file listing-contact.types.ts
 * @description Shared prop types for `ListingContactBlock.astro` and `ListingSocialLinks.astro`, the one
 * presentation of a listing's contact channels and social profiles used by the
 * accommodation, venue and experience contact blocks (HOS-2520, owner smoke
 * items 18 and 19).
 */

import type { GlobeIcon } from '@repo/icons';

/** Kind of a contact channel button. Selects the leading icon. */
export type ListingContactChannelKind = 'phone' | 'email' | 'website';

/** One contact channel rendered as an outline `GradientButton`. */
export interface ListingContactChannel {
    /** Which icon leads the button. There is deliberately no WhatsApp kind. */
    readonly kind: ListingContactChannelKind;
    /** Already-safe href (`tel:`, `mailto:` or an allow-listed URL). */
    readonly href: string;
    /** Visible text of the button (the number, address or host). */
    readonly label: string;
    /** Screen-reader-only context appended after the label (WCAG 2.5.3). */
    readonly srHint: string;
    /** Optional `data-interaction-kind` for the owner-panel counters. */
    readonly interactionKind?: string;
}

/** One social profile rendered as an outline `IconButton` with its brand logo. */
export interface ListingContactSocialLink {
    /** Already-safe, allow-listed href. */
    readonly href: string;
    /** Accessible name (the button has no visible text). */
    readonly ariaLabel: string;
    /** Brand logo component from `@repo/icons`. */
    readonly Icon: typeof GlobeIcon;
    /** Optional `data-interaction-kind` for the owner-panel counters. */
    readonly interactionKind?: string;
}

/** Visual shell around the block. */
export type ListingContactShell = 'card' | 'plain';

/** The venue's «Ver menú» outbound link, drawn between channels and socials. */
export interface ListingContactMenuLink {
    /** Already-safe, allow-listed href. */
    readonly href: string;
    /** Visible text of the button. */
    readonly label: string;
}

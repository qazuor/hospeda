export interface ProjectedCartaListing {
    readonly menuSections?: readonly unknown[] | null;
    readonly menuFileUrl?: string | null;
    readonly menuFileKind?: string | null;
}

export type CartaPageDecision =
    | { readonly kind: 'render' }
    | {
          readonly kind: 'redirect';
          readonly status: 302;
          readonly headers: Readonly<{ Location: string; 'Cache-Control': 'no-store' }>;
      };

/** Decide whether the projected listing has printable menu content. */
export function decideCartaPage(args: {
    readonly listing: ProjectedCartaListing;
    readonly listingUrl: string;
}): CartaPageDecision {
    const hasStructuredMenu = (args.listing.menuSections?.length ?? 0) > 0;
    const hasFile = Boolean(args.listing.menuFileUrl && args.listing.menuFileKind);
    if (hasStructuredMenu || hasFile) return { kind: 'render' };
    return {
        kind: 'redirect',
        status: 302,
        headers: { Location: args.listingUrl, 'Cache-Control': 'no-store' }
    };
}

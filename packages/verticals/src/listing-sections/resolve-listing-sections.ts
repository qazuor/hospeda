import {
    BUSINESS_LINES,
    getCatalogKey,
    LISTING_SECTIONS,
    type ListingSectionState,
    type ListingVertical,
    VerticalEnum
} from '@repo/schemas';
import { isGranted } from '../authorization/entitlement-step';
import type { RehydratedEffectiveSet } from '../effective-set-cache/snapshot';

type SectionDefinition = {
    readonly id: string;
    readonly vertical: ListingVertical;
    readonly common: boolean;
    readonly entitlementKey?: string;
    readonly traits?: readonly { readonly id: string; readonly entitlementKey?: string }[];
};
type BusinessLineDefinition = { readonly value: string; readonly sections: readonly string[] };
const VERTICAL_ENUM: Readonly<Record<ListingVertical, VerticalEnum>> = {
    venue: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE,
    accommodation: VerticalEnum.ACCOMMODATION
};

/** A business line or the catalog names a section id the vertical's catalog does not have. */
export class UnknownListingSectionIdError extends Error {
    constructor(readonly id: string) {
        super(`Unknown listing section id: ${id}`);
        this.name = 'UnknownListingSectionIdError';
    }
}
/** The listing carries a business line that is not declared for its vertical. */
export class UnknownBusinessLineError extends Error {
    constructor(
        readonly vertical: ListingVertical,
        readonly value: string
    ) {
        super(`Unknown business line "${value}" for vertical "${vertical}"`);
        this.name = 'UnknownBusinessLineError';
    }
}
/** A section or trait names an entitlement key that is not in the key catalog. */
export class UnknownListingSectionKeyError extends Error {
    constructor(readonly key: string) {
        super(`Unknown listing section entitlement key: ${key}`);
        this.name = 'UnknownListingSectionKeyError';
    }
}

/** One section's resolved state and the state of each of its traits. */
export interface ResolvedListingSection {
    /** `absent` (no line lists it), `locked` (key not granted) or `available`. */
    readonly state: ListingSectionState;
    /** Trait id → state; a non-available section imposes its own state on every trait. */
    readonly traits: ReadonlyMap<string, ListingSectionState>;
}
/** Output of {@link resolveListingSections}. */
export interface ResolveListingSectionsResult {
    /** Section id → resolved section, for every section of the vertical's catalog. */
    readonly sections: ReadonlyMap<string, ResolvedListingSection>;
    /** More than one of the listing's business lines owns a non-`absent` section. */
    readonly multiLine: boolean;
}

/** Resolve only catalog presence when a caller does not need entitlement state. */
export function resolveListingSectionPresence(args: {
    readonly vertical: ListingVertical;
    readonly businessLines: readonly string[];
    readonly requested: readonly string[];
}): ReadonlyMap<string, boolean> {
    const linesCatalog = BUSINESS_LINES[args.vertical];
    const selected = args.businessLines.map((value) => {
        const line = linesCatalog.find((entry) => entry.value === value);
        if (!line) throw new UnknownBusinessLineError(args.vertical, value);
        return line;
    });
    const catalog = LISTING_SECTIONS[args.vertical];
    return new Map(
        args.requested.map((id) => {
            const section = catalog.find((entry) => entry.id === id);
            if (!section) throw new UnknownListingSectionIdError(id);
            return [
                id,
                !section.common && !selected.some((line) => line.sections.includes(id as never))
            ];
        })
    );
}

/**
 * Resolves every section and trait of a listing from one already-read effective set
 * (sub-spec 3, DEC-FAC-020/050/051). A non-common section that none of the listing's
 * business lines lists is `absent`; otherwise it is `locked` when its entitlement key
 * is not granted, and `available` when it is. Traits inherit a non-available section's
 * state and are otherwise gated by their own key. Pure: no I/O.
 *
 * @param args.vertical - The listing's vertical.
 * @param args.businessLines - The listing's stored business lines.
 * @param args.effective - The owner's effective set, read once for the listing.
 * @param args.userId - The owner whose entitlements are evaluated.
 * @param args.catalog - Test-only catalog override; production reads `@repo/schemas`.
 * @returns The state of every section and trait, plus `multiLine`.
 * @throws {UnknownBusinessLineError} A business line not declared for the vertical.
 * @throws {UnknownListingSectionIdError} A section id missing from the vertical's catalog.
 * @throws {UnknownListingSectionKeyError} An entitlement key missing from the key catalog.
 */
export function resolveListingSections(args: {
    readonly vertical: ListingVertical;
    readonly businessLines: readonly string[];
    readonly effective: RehydratedEffectiveSet;
    readonly userId: string;
    /** Catalog seam for validating alternate catalogs in focused tests. */
    readonly catalog?: {
        readonly sections: readonly SectionDefinition[];
        readonly businessLines: readonly BusinessLineDefinition[];
    };
}): ResolveListingSectionsResult {
    const sectionsCatalog: readonly SectionDefinition[] =
        args.catalog?.sections ?? LISTING_SECTIONS[args.vertical];
    const linesCatalog = args.catalog?.businessLines ?? BUSINESS_LINES[args.vertical];
    const knownLines = new Map(linesCatalog.map((line) => [line.value, line]));
    const selectedLines = args.businessLines.map((value) => {
        const line = knownLines.get(value);
        if (!line) throw new UnknownBusinessLineError(args.vertical, value);
        for (const id of line.sections) {
            if (!sectionsCatalog.some((section) => section.id === id))
                throw new UnknownListingSectionIdError(id);
        }
        return line;
    });
    const listedSections = new Set(selectedLines.flatMap((line) => line.sections));
    const sectionStates = new Map<string, ResolvedListingSection>();
    const lineHasAvailableSection = new Map(selectedLines.map((line) => [line.value, false]));

    const granted = (key: string): boolean => {
        if (!getCatalogKey({ key })) throw new UnknownListingSectionKeyError(key);
        return isGranted({
            effective: args.effective,
            key,
            userId: args.userId,
            vertical: VERTICAL_ENUM[args.vertical]
        });
    };

    for (const section of sectionsCatalog) {
        if (section.vertical !== args.vertical) throw new UnknownListingSectionIdError(section.id);
        if (
            getCatalogKey({ key: section.entitlementKey ?? '' }) === undefined &&
            section.entitlementKey
        )
            throw new UnknownListingSectionKeyError(section.entitlementKey);
        const absent = !section.common && !listedSections.has(section.id);
        const sectionState: ListingSectionState = absent
            ? 'absent'
            : section.entitlementKey && !granted(section.entitlementKey)
              ? 'locked'
              : 'available';
        const traits = new Map<string, ListingSectionState>();
        for (const trait of section.traits ?? []) {
            if (trait.entitlementKey && !getCatalogKey({ key: trait.entitlementKey }))
                throw new UnknownListingSectionKeyError(trait.entitlementKey);
            traits.set(
                trait.id,
                sectionState === 'absent'
                    ? 'absent'
                    : sectionState === 'locked'
                      ? 'locked'
                      : trait.entitlementKey && !granted(trait.entitlementKey)
                        ? 'locked'
                        : 'available'
            );
        }
        sectionStates.set(section.id, { state: sectionState, traits });
        if (sectionState !== 'absent') {
            for (const line of selectedLines) {
                if (line.sections.includes(section.id))
                    lineHasAvailableSection.set(line.value, true);
            }
        }
    }
    return {
        sections: sectionStates,
        multiLine: [...lineHasAvailableSection.values()].filter(Boolean).length > 1
    };
}

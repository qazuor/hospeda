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

export class UnknownListingSectionIdError extends Error {
    constructor(readonly id: string) {
        super(`Unknown listing section id: ${id}`);
        this.name = 'UnknownListingSectionIdError';
    }
}
export class UnknownBusinessLineError extends Error {
    constructor(
        readonly vertical: ListingVertical,
        readonly value: string
    ) {
        super(`Unknown business line "${value}" for vertical "${vertical}"`);
        this.name = 'UnknownBusinessLineError';
    }
}
export class UnknownListingSectionKeyError extends Error {
    constructor(readonly key: string) {
        super(`Unknown listing section entitlement key: ${key}`);
        this.name = 'UnknownListingSectionKeyError';
    }
}

export interface ResolvedListingSection {
    readonly state: ListingSectionState;
    readonly traits: ReadonlyMap<string, ListingSectionState>;
}
export interface ResolveListingSectionsResult {
    readonly sections: ReadonlyMap<string, ResolvedListingSection>;
    readonly multiLine: boolean;
}

/** Resolves every section and trait from one already-read effective set. */
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

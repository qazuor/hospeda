/**
 * @file anchors.ts
 * @description The `Anchor` grammar of `covers` and `entryFor` (HOS-2410
 * `docs/data-model.md` §2.2): `kind:target`. This module checks the SHAPE of an
 * anchor only. Whether its target exists in the repo is guard (a), predicate a5
 * (`scripts/check-help-catalog.ts`).
 */

/** Every anchor kind. */
export const HELP_ANCHOR_KINDS = [
    'page',
    'section',
    'entitlement',
    'limit',
    'enum',
    'tool',
    'activation',
    'file'
] as const;

/** One anchor kind. */
export type HelpAnchorKind = (typeof HELP_ANCHOR_KINDS)[number];

/** The closed list of vocabularies an `enum:` anchor may name. Adding one is a guard change. */
export const HELP_ENUM_VOCABULARIES = [
    'PublicationStatus',
    'SubscriptionStatus',
    'TrialStatus'
] as const;

/** One vocabulary of {@link HELP_ENUM_VOCABULARIES}. */
export type HelpEnumVocabulary = (typeof HELP_ENUM_VOCABULARIES)[number];

/** One segment of a page route template: a kebab-case name or a `[dynamic]` one. */
const PAGE_SEGMENT = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[[A-Za-z]+\])$/;

/** One segment of a repo-relative path. */
const FILE_SEGMENT = /^[A-Za-z0-9._@[\]-]+$/;

/** Whether a slash-separated path has only valid segments, none of them `..`. */
function isPath({ text, segment }: { readonly text: string; readonly segment: RegExp }): boolean {
    return (
        text !== '' &&
        text.split('/').every((part) => part !== '..' && part !== '.' && segment.test(part))
    );
}

/** Shape check of the target of each anchor kind. */
const TARGET_CHECKS: Readonly<Record<HelpAnchorKind, (target: string) => boolean>> = {
    // A route template under `apps/web/src/pages/[lang]/`: no locale, no edge slashes.
    page: (target) => isPath({ text: target, segment: PAGE_SEGMENT }),
    section: (target) => /^[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target),
    entitlement: (target) => /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(target),
    limit: (target) => /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(target),
    enum: (target) =>
        new RegExp(`^(?:${HELP_ENUM_VOCABULARIES.join('|')})\\.[A-Z0-9]+(?:_[A-Z0-9]+)*$`).test(
            target
        ),
    tool: (target) => /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(target),
    activation: (target) => /^[a-z]+$/.test(target),
    // A repo-relative path: no leading slash, no `..` segment.
    file: (target) => isPath({ text: target, segment: FILE_SEGMENT })
};

/** A parsed anchor. */
export interface HelpAnchor {
    /** The anchor kind. */
    readonly kind: HelpAnchorKind;
    /** Everything after the first `:`. */
    readonly target: string;
}

/**
 * Parses an anchor string.
 *
 * @param args.anchor - For example `page:mi-cuenta/suscripcion`
 * @returns The kind and target, or `undefined` when the kind is unknown or the
 *   target does not have that kind's shape
 *
 * @example
 * ```ts
 * parseHelpAnchor({ anchor: 'section:venue.carta' }); // { kind: 'section', target: 'venue.carta' }
 * parseHelpAnchor({ anchor: 'nope:x' });              // undefined
 * ```
 */
export function parseHelpAnchor({ anchor }: { readonly anchor: string }): HelpAnchor | undefined {
    const colon = anchor.indexOf(':');
    if (colon <= 0) {
        return undefined;
    }
    const kind = HELP_ANCHOR_KINDS.find((candidate) => candidate === anchor.slice(0, colon));
    const target = anchor.slice(colon + 1);
    if (kind === undefined || !TARGET_CHECKS[kind](target)) {
        return undefined;
    }
    return { kind, target };
}

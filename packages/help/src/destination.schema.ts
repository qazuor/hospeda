/**
 * @file destination.schema.ts
 * @description `HelpDestination` (HOS-2410 `docs/data-model.md` §2.1): where an
 * article sends the owner. Any portal destination that names no record, or an
 * editor section of one of the owner's own listings (`ownEditorSection`, which
 * `get_help` fills in from the caller's listings). Each may carry a `label`.
 */

import {
    EDITOR_SECTION_SLUGS,
    PORTAL_PAGE_LABELS,
    PORTAL_ROUTE_TEMPLATES,
    type PortalPageKey,
    type PortalPageParamNames
} from '@repo/portal-routes';
import { z } from 'zod';

/** Longest label a destination may carry. */
export const HELP_DESTINATION_LABEL_MAX = 80;

/** A page of the generic `page` destination whose template has no dynamic segment. */
export type HelpStaticPageKey = {
    [K in PortalPageKey]: [PortalPageParamNames<K>] extends [never] ? K : never;
}[PortalPageKey];

/** The keys of an object, typed. */
function keysOf<T extends object>(value: T): Array<keyof T & string> {
    return Object.keys(value) as Array<keyof T & string>;
}

/** Whether a page key names no record (its template has no `[dynamic]` segment). */
function isStaticPageKey(key: PortalPageKey): key is HelpStaticPageKey {
    return !PORTAL_ROUTE_TEMPLATES[key].includes('[');
}

/** The `page` destinations an article may use: those that name no record. */
export const HELP_STATIC_PAGE_KEYS: readonly HelpStaticPageKey[] =
    keysOf(PORTAL_PAGE_LABELS).filter(isStaticPageKey);

/** The verticals whose listings the portal manages. */
const LISTING_VERTICAL = z.enum(['accommodation', 'venue', 'experience']);

/** Optional label shared by every destination. */
const label = z.string().min(1).max(HELP_DESTINATION_LABEL_MAX).optional();

/** A destination of one kind that carries nothing but the kind. */
const bare = <K extends string>(kind: K) => z.object({ kind: z.literal(kind), label }).strict();

/** An editor section of one vertical, by catalog section id. */
const ownEditorSection = <V extends 'accommodation' | 'venue' | 'experience'>(vertical: V) =>
    z
        .object({
            kind: z.literal('ownEditorSection'),
            vertical: z.literal(vertical),
            section: z.enum(keysOf(EDITOR_SECTION_SLUGS[vertical])),
            label
        })
        .strict();

/**
 * Every destination an article may name. Strict: an unknown key, a section the
 * vertical does not have, or a `page` that needs an id fails.
 */
export const HelpDestinationSchema = z.union([
    z.object({ kind: z.literal('ownerListings'), vertical: LISTING_VERTICAL, label }).strict(),
    z.object({ kind: z.literal('createListing'), vertical: LISTING_VERTICAL, label }).strict(),
    z.object({ kind: z.literal('plans'), vertical: LISTING_VERTICAL, label }).strict(),
    bare('subscription'),
    bare('addons'),
    bare('inquiry'),
    bare('providerDirectory'),
    bare('benefitUsages'),
    bare('providerPanel'),
    bare('aiAssistants'),
    bare('aiAssistantsHistory'),
    bare('faq'),
    bare('contact'),
    bare('partnerPanel'),
    bare('helpLanding'),
    z
        .object({
            kind: z.literal('helpArticle'),
            id: z
                .string()
                .max(64)
                .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            label
        })
        .strict(),
    z.object({ kind: z.literal('page'), page: z.enum(HELP_STATIC_PAGE_KEYS), label }).strict(),
    ownEditorSection('accommodation'),
    ownEditorSection('venue'),
    ownEditorSection('experience')
]);

/** Where an article sends the owner. */
export type HelpDestination = z.infer<typeof HelpDestinationSchema>;

/** The `ownEditorSection` member of {@link HelpDestination}. */
export type HelpOwnEditorSectionDestination = Extract<
    HelpDestination,
    { readonly kind: 'ownEditorSection' }
>;

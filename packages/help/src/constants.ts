/**
 * @file constants.ts
 * @description Fixed vocabulary of the help catalog (HOS-2410
 * `docs/data-model.md` §1–§4): audiences, locales, the five authored body
 * sections with their headings and anchors, and the size limits.
 */

import type { VerticalEnum } from '@repo/schemas';

/** Who an article is for (O-6). Tourists are out of scope. */
export const HELP_AUDIENCES = ['host', 'venue', 'experience', 'provider', 'partner'] as const;

/** One audience of {@link HELP_AUDIENCES}. */
export type HelpAudience = (typeof HELP_AUDIENCES)[number];

/**
 * The Spanish name of each audience, as the help landing's tabs show it
 * (HOS-2410 `docs/web-ui.md` §2) and the export titles its bundle (AC-35).
 */
export const HELP_AUDIENCE_LABELS = {
    host: 'Alojamientos',
    venue: 'Comer y salir',
    experience: 'Experiencias',
    provider: 'Proveedores',
    partner: 'Aliados'
} as const satisfies Record<HelpAudience, string>;

/**
 * The verticals an article may name in `verticals`: every `VerticalEnum` value
 * but `tourist` (`docs/data-model.md` §2). Written out instead of derived from
 * the enum so the runtime imports no value from `@repo/schemas`; the
 * `satisfies` rejects a value the enum does not have, and a test rejects a
 * missing one.
 */
export const HELP_VERTICALS = [
    'accommodation',
    'venue',
    'experience',
    'partner'
] as const satisfies readonly `${Exclude<VerticalEnum, VerticalEnum.TOURIST>}`[];

/** One vertical of {@link HELP_VERTICALS}. */
export type HelpVertical = (typeof HELP_VERTICALS)[number];

/** Content locales. Only `es` has content in v1 (O-7). */
export const HELP_LOCALES = ['es', 'en', 'pt'] as const;

/** One locale of {@link HELP_LOCALES}. */
export type HelpLocale = (typeof HELP_LOCALES)[number];

/** The locale every article is written in first; other locales translate it. */
export const HELP_SOURCE_LOCALE = 'es' as const satisfies HelpLocale;

/** Folder of an article whose `audiences` has more than one value (R-2). */
export const HELP_COMMON_FOLDER = 'common';

/** Every content folder: one per audience plus {@link HELP_COMMON_FOLDER}. */
export const HELP_FOLDERS = [...HELP_AUDIENCES, HELP_COMMON_FOLDER] as const;

/** One content folder. */
export type HelpFolder = (typeof HELP_FOLDERS)[number];

/** The five authored body sections, in their fixed order (O-3). */
export const HELP_SECTION_KEYS = [
    'canDo',
    'howTo',
    'expect',
    'notExpect',
    'troubleshooting'
] as const;

/** One authored body section. */
export type HelpSectionKey = (typeof HELP_SECTION_KEYS)[number];

/** Anchor id of each authored section, the same in every locale. */
export const HELP_SECTION_ANCHORS = {
    canDo: 'que-podes-hacer',
    howTo: 'como-se-hace',
    expect: 'que-esperar',
    notExpect: 'que-no-esperar',
    troubleshooting: 'problemas-comunes'
} as const satisfies Record<HelpSectionKey, string>;

/** Anchor id of the generated «Relacionados» list (D-H3). */
export const HELP_RELATED_ANCHOR = 'relacionados';

/**
 * The `##` heading of each authored section, per locale that has content.
 * Only `es` is defined: the en/pt heading texts are not fixed by the spec yet,
 * so a non-es file is rejected until they are.
 */
export const HELP_SECTION_HEADINGS: Readonly<
    Partial<Record<HelpLocale, Readonly<Record<HelpSectionKey, string>>>>
> = {
    es: {
        canDo: 'Qué podés hacer',
        howTo: 'Cómo se hace',
        expect: 'Qué esperar',
        notExpect: 'Qué NO esperar',
        troubleshooting: 'Problemas comunes'
    }
};

/** The heading of the generated related list, which an author must never write (D-H3). */
export const HELP_RELATED_HEADINGS: Readonly<Partial<Record<HelpLocale, string>>> = {
    es: 'Relacionados'
};

/** Most steps the «Cómo se hace» list may have. */
export const HELP_MAX_STEPS = 12;

/** Longest an article may be, all sections rendered with tokens resolved neutrally. */
export const HELP_MAX_RENDERED_CHARS = 5000;

/** Fewest and most `related` entries an article may have (IL-5). */
export const HELP_RELATED_MIN = 2;
export const HELP_RELATED_MAX = 8;

/** An article whose `reviewedAt` is older than this many days is reported as stale. */
export const HELP_STALE_DAYS = 180;

/** Version of the `help-index.json` format. */
export const HELP_INDEX_VERSION = 1;

/** What a `{{limit}}` token reads as when the reader's value is unknown. */
export const HELP_NEUTRAL_LIMIT_TEXT = 'el tope de tu plan';

/** What a `{{limit}}` token reads as in the Markdown export (`docs/data-model.md` §5.2). */
export const HELP_EXPORT_LIMIT_TEXT = 'según tu plan';

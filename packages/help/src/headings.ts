/**
 * @file headings.ts
 * @description Anchor ids of the `###` sub-headings of an article body
 * (HOS-2410 `docs/data-model.md` §3): the heading text slugified, unless the
 * author wrote an explicit `{#id}` at its end.
 *
 * Runtime module: the generator checks the anchors with it, and the web
 * article page gives each rendered `<h3>` the same id, so an
 * `{{article:<id>:<anchor>}}` link always lands where guard (a) said it would.
 *
 * An anchor id must start with a letter: the web sanitizer drops an `id` that
 * starts with a digit, which would leave the heading unlinkable. A slug that
 * would start with a digit gets the {@link HELP_DIGIT_ANCHOR_PREFIX}; an
 * explicit `{#24h}` is rejected by the generator ({@link isHelpAnchorId}).
 */

/**
 * An explicit `### Heading {#id}` anchor at the end of the heading text. It
 * matches a leading digit on purpose, so the generator can name and reject it
 * instead of showing `{#24h}` as heading text.
 */
export const HELP_EXPLICIT_ANCHOR = /\s*\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/;

/** What a valid anchor id looks like: kebab-case starting with a letter. */
export const HELP_ANCHOR_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Prefix of a slugged anchor whose heading starts with a digit. */
export const HELP_DIGIT_ANCHOR_PREFIX = 'h-';

/**
 * Whether an anchor id is usable on the web (starts with a letter).
 *
 * @param args.anchor - The anchor id
 * @returns `true` when the web keeps it as an `id`
 */
export function isHelpAnchorId({ anchor }: { readonly anchor: string }): boolean {
    return HELP_ANCHOR_ID.test(anchor);
}

/**
 * Slugifies a `###` heading into its anchor id: lowercase, accents stripped,
 * every run of non-alphanumerics a single `-`, no edge hyphens, and
 * {@link HELP_DIGIT_ANCHOR_PREFIX} in front when it would start with a digit.
 *
 * @param args.text - The heading text
 * @returns The anchor id
 *
 * @example
 * ```ts
 * slugifyHelpHeading({ text: 'Mis fotos no se ven' }); // 'mis-fotos-no-se-ven'
 * slugifyHelpHeading({ text: '48 horas sin respuesta' }); // 'h-48-horas-sin-respuesta'
 * ```
 */
export function slugifyHelpHeading({ text }: { readonly text: string }): string {
    const slug = text
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return /^[0-9]/.test(slug) ? `${HELP_DIGIT_ANCHOR_PREFIX}${slug}` : slug;
}

/** What a `###` heading shows and where it can be linked to. */
export interface HelpSubHeading {
    /** The heading text without its explicit `{#id}`. */
    readonly text: string;
    /** The anchor id: the explicit one, else the slug of the text. */
    readonly anchor: string;
}

/**
 * The visible text and the anchor id of a `###` heading.
 *
 * @param args.text - The heading text as written, maybe ending in `{#id}`
 * @returns The text to show and its anchor id
 *
 * @example
 * ```ts
 * helpSubHeading({ text: 'Mis fotos no se ven {#fotos-no-se-ven}' });
 * // { text: 'Mis fotos no se ven', anchor: 'fotos-no-se-ven' }
 * ```
 */
export function helpSubHeading({ text }: { readonly text: string }): HelpSubHeading {
    const explicit = HELP_EXPLICIT_ANCHOR.exec(text);
    if (explicit?.[1] !== undefined) {
        return { text: text.slice(0, explicit.index).trim(), anchor: explicit[1] };
    }
    return { text: text.trim(), anchor: slugifyHelpHeading({ text }) };
}

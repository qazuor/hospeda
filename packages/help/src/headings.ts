/**
 * @file headings.ts
 * @description Anchor ids of the `###` sub-headings of an article body
 * (HOS-2410 `docs/data-model.md` §3): the heading text slugified, unless the
 * author wrote an explicit `{#id}` at its end.
 *
 * Runtime module: the generator checks the anchors with it, and the web
 * article page gives each rendered `<h3>` the same id, so an
 * `{{article:<id>:<anchor>}}` link always lands where guard (a) said it would.
 */

/** An explicit `### Heading {#id}` anchor at the end of the heading text. */
export const HELP_EXPLICIT_ANCHOR = /\s*\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/;

/**
 * Slugifies a `###` heading into its anchor id: lowercase, accents stripped,
 * every run of non-alphanumerics a single `-`, no edge hyphens.
 *
 * @param args.text - The heading text
 * @returns The anchor id
 *
 * @example
 * ```ts
 * slugifyHelpHeading({ text: 'Mis fotos no se ven' }); // 'mis-fotos-no-se-ven'
 * ```
 */
export function slugifyHelpHeading({ text }: { readonly text: string }): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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

/**
 * `ProfilePage` JSON-LD builder for the author page (HOS-375 §6.8).
 *
 * The node is built here rather than inline in `ProfilePageJsonLd.astro` for
 * the same reason `event-json-ld-date.ts` exists: a `.astro` file cannot be
 * rendered by Vitest, so the only way to assert on the EMITTED JSON — rather
 * than on the component's source text — is to keep the object construction in
 * a pure module and have the component delegate to it.
 *
 * Every optional field is OMITTED when absent, never emitted as `null` or `''`.
 * A `"description": null` is not "no description" to a consumer, it is a
 * malformed one.
 */

/** Input for {@link buildProfilePageJsonLd}. */
export interface BuildProfilePageJsonLdParams {
    /** The author's display name. */
    readonly name: string;

    /** Absolute URL of the author page (`https://…/es/autores/<slug>/`). */
    readonly url: string;

    /** Avatar URL. Omitted from the output when absent or blank. */
    readonly image?: string | null;

    /** The author's bio. Omitted from the output when absent or blank. */
    readonly description?: string | null;

    /**
     * Social profile URLs, already filtered by the caller.
     *
     * The opt-in decision (`settings.publicProfileShowSocialNetworks`, §6.7)
     * is NOT made here: the page only ever receives social networks when the
     * author opted in, so an empty or absent array is the whole contract this
     * module needs. Blank entries are dropped, and `sameAs` is omitted entirely
     * when nothing survives.
     */
    readonly sameAs?: readonly (string | null | undefined)[] | null;
}

/** A schema.org `Person` node, as nested under `ProfilePage.mainEntity`. */
type PersonNode = {
    readonly '@type': 'Person';
    readonly name: string;
    readonly url: string;
    readonly image?: string;
    readonly description?: string;
    readonly sameAs?: readonly string[];
};

/**
 * The `ProfilePage` node handed to `JsonLd.astro`.
 *
 * A `type` alias, not an `interface`: `JsonLd.astro`'s prop is
 * `Record<string, unknown>`, and TypeScript gives an interface no implicit
 * index signature, so an interface here fails to assign with
 * "Index signature for type 'string' is missing".
 */
export type ProfilePageJsonLd = {
    readonly '@context': 'https://schema.org';
    readonly '@type': 'ProfilePage';
    readonly mainEntity: PersonNode;
};

/** Whether a value carries actual content. */
function isNonEmpty(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build the `ProfilePage` JSON-LD node for an author page.
 *
 * `ProfilePage` rather than a bare `Person` because the page is the profile
 * DOCUMENT, not the person: it gives `Person` a correct home as `mainEntity`
 * and leaves room to declare the produced posts and events later. A bare
 * `Person` has nowhere to hang them.
 *
 * @param params - {@link BuildProfilePageJsonLdParams}
 * @returns The node, with every absent optional field omitted.
 *
 * @example
 * ```ts
 * buildProfilePageJsonLd({
 *   name: 'Equipo Hospeda',
 *   url: 'https://hospeda.com.ar/es/autores/equipo-hospeda/'
 * });
 * // { '@context': ..., '@type': 'ProfilePage',
 * //   mainEntity: { '@type': 'Person', name: 'Equipo Hospeda', url: '…' } }
 * ```
 */
export function buildProfilePageJsonLd(params: BuildProfilePageJsonLdParams): ProfilePageJsonLd {
    const person: {
        '@type': 'Person';
        name: string;
        url: string;
        image?: string;
        description?: string;
        sameAs?: readonly string[];
    } = {
        '@type': 'Person',
        name: params.name,
        url: params.url
    };

    if (isNonEmpty(params.image)) {
        person.image = params.image.trim();
    }

    if (isNonEmpty(params.description)) {
        person.description = params.description.trim();
    }

    const sameAs = (params.sameAs ?? []).filter(isNonEmpty).map((entry) => entry.trim());
    if (sameAs.length > 0) {
        person.sameAs = sameAs;
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: person
    };
}

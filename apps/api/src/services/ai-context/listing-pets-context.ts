/**
 * The pets line of the AI chat context when a listing says nothing about pets
 * (HOS-2102).
 *
 * On listings with no pet data at all the model filled the gap itself — the
 * observed failure was "La casa acepta mascotas" invented out of nothing. When
 * nothing that reaches the context signals pets, the block now states the fact
 * explicitly so the model relays it instead of inferring it, the same way
 * `venue-age-windows-context.ts` moved the age-window arithmetic into code so
 * the model only has to look it up (HOS-2098).
 *
 * ## What counts as a pet signal
 *
 * - `policies.pets.admission` set to a value the policies builder renders
 *   («sí, se admiten» / «a consultar» / «no se admiten», see
 *   {@link RENDERED_PETS_ADMISSIONS}), so pets ARE informed — an explicit "no"
 *   included. An unknown stored value renders nothing there, so it is NOT a
 *   signal here either.
 * - An amenity or feature slug starting with `pet`: the catalog is CLOSED and
 *   today holds exactly `pet_friendly` (amenity) and `pet_suitable` /
 *   `pet_friendly_area` (features), per migration
 *   `0194_hos_2060_listing_policies.sql`. A prefix test, not a slug list, stays
 *   correct the day the catalog grows a fourth pet slug.
 * - A pet word in any owner free text that reaches the context. The words are
 *   the ones the three page locales write; every one starts and ends with an
 *   ASCII letter, so `\b` boundaries work with the plain `i` flag (no `u` flag
 *   needed around the accents).
 *
 * ## Scan what is rendered, not what is stored
 *
 * The caller passes the text the context renders — the truncated and
 * sanitized variants, the capped lists — never the raw fields. Scanning text
 * the model does not see, or missing text it does, both turn the line into a
 * lie: a mention hidden by a truncation cut must read as "not informed", and a
 * rendered mention must suppress the line.
 *
 * Known gap: the FAQ texts are scanned before the FAQ renderer applies its
 * per-answer word cut and section budget, so a pet word that only lives in a
 * cut-off FAQ suppresses the line. That can only OVER-detect (no line, the
 * pre-HOS-2102 behaviour), never state "not informed" over rendered pet data.
 *
 * @module apps/api/services/ai-context/listing-pets-context
 */

/** Pet words across the three page locales (es / en / pt), matched whole-word. */
const PET_WORDS = [
    // es
    'mascota',
    'mascotas',
    'perrito',
    'perrita',
    'perritos',
    'perro',
    'perros',
    'perra',
    'perras',
    'gato',
    'gatos',
    'animal',
    'animales',
    // en ("pet" also matches the hyphenated "pet-friendly")
    'pet',
    'pets',
    'dog',
    'dogs',
    'puppy',
    'puppies',
    'cat',
    'cats',
    'animals',
    // pt
    'animais',
    'cachorro',
    'cachorros',
    'cão',
    'cães'
] as const;

/**
 * Case-insensitive whole-word matcher built from {@link PET_WORDS}. No `g`
 * flag, so `test()` is stateless across calls.
 */
const PET_WORD_PATTERN = new RegExp(`\\b(?:${PET_WORDS.join('|')})\\b`, 'i');

/**
 * The `policies.pets.admission` values `listing-policies-context.ts` renders
 * (its `PETS_LABELS` keys). Kept in step with that map by the unit test.
 */
export const RENDERED_PETS_ADMISSIONS: ReadonlySet<string> = new Set(['yes', 'on_request', 'no']);

/** The line rendered when nothing in the context informs pets (Spanish, like every label). */
const PETS_NOT_INFORMED_LINE = '**Mascotas**: no figura información en la ficha';

/**
 * What the pets scan reads. Structural on purpose — the accommodation and the
 * venue `policies` shapes both fit — so this file stays dependency-free like
 * its sibling `listing-policies-context.ts`.
 */
export interface ListingPetSignalInput {
    /** The stored `policies`; only `pets.admission` is read here. */
    readonly policies?:
        | { readonly pets?: { readonly admission?: string | null } | null }
        | null
        | undefined;
    /** Slugs of the amenities the context renders; empty means none. */
    readonly amenitySlugs: readonly string[];
    /** Slugs of the features the context renders; empty means none. */
    readonly featureSlugs: readonly string[];
    /** Every owner free-text string the context renders. */
    readonly texts: readonly string[];
}

/**
 * Whether anything that reaches the context informs pets. PURE — no I/O.
 *
 * @param input - The policies plus the slugs and texts exactly as rendered.
 * @returns True when at least one pet signal exists.
 */
export function findListingPetSignal(input: ListingPetSignalInput): boolean {
    const admission = input.policies?.pets?.admission;
    if (admission && RENDERED_PETS_ADMISSIONS.has(admission)) return true;
    if (input.amenitySlugs.some((slug) => slug.startsWith('pet'))) return true;
    if (input.featureSlugs.some((slug) => slug.startsWith('pet'))) return true;
    return input.texts.some((text) => PET_WORD_PATTERN.test(text));
}

/**
 * Builds the pets lines: none when a signal exists — the policies builder or
 * the listing data itself informs pets — otherwise the one explicit line that
 * states the ficha carries no pets information («no figura», phrasing the
 * answer-quality heuristics accept as "not informed", HOS-2102 round 2).
 *
 * @param input - The policies plus the slugs and texts exactly as rendered.
 * @returns `{ lines }`, carrying at most one line.
 */
export function buildListingPetsLines(input: ListingPetSignalInput): {
    readonly lines: readonly string[];
} {
    if (findListingPetSignal(input)) return { lines: [] };
    return { lines: [PETS_NOT_INFORMED_LINE] };
}

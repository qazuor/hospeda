/**
 * Amenity and feature allowlists for the AI NL search route (SPEC-199 §5.4).
 *
 * Two static per-locale dictionaries map common natural-language terms to
 * stable slug identifiers:
 *   - `AMENITY_ALLOWLIST` — physical services (pool, wifi, bbq, etc.)
 *   - `FEATURE_ALLOWLIST` — environment / atmosphere / aptitude / style only
 *
 * The route handler resolves slugs to database UUIDs server-side, so the
 * allowlists remain portable across dev / staging / production environments.
 *
 * ## ANTI-OVERLAP RULE (enforced in both dictionaries)
 *
 * Physical services — pets, wifi, parking, pool, breakfast, air-conditioning,
 * BBQ — MUST appear ONLY in `AMENITY_ALLOWLIST` (or in the boolean shortcut
 * slots: `allowsPets`, `hasWifi`, `hasParking`, `hasPool`). They MUST NOT
 * appear in `FEATURE_ALLOWLIST`. The `features` table is reserved for
 * environment, atmosphere, aptitude, and style descriptors. Double-mapping a
 * physical service would silently duplicate filter state and produce incorrect
 * search results.
 *
 * @module apps/api/routes/ai/protected/amenity-allowlist
 */

// ─── Amenity Allowlist ────────────────────────────────────────────────────────

/**
 * Per-locale dictionary mapping NL term variants → amenity slug.
 *
 * Keys are the natural-language terms users might write (already lowercased and
 * trimmed in the spec; matching code normalises at call time). Values are the
 * stable slug identifiers used by the `amenities` database table.
 *
 * Physical services only — no environment / atmosphere / aptitude / style terms
 * (those belong in `FEATURE_ALLOWLIST`).
 *
 * @example
 * ```ts
 * const slug = AMENITY_ALLOWLIST['es']['pileta']; // 'pool'
 * ```
 */
export const AMENITY_ALLOWLIST: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    es: {
        pileta: 'pool',
        piscina: 'pool',
        natación: 'pool',
        wifi: 'wifi',
        internet: 'wifi',
        parrilla: 'bbq',
        asador: 'bbq',
        barbacoa: 'bbq',
        bbq: 'bbq',
        'aire acondicionado': 'air-conditioning',
        aire: 'air-conditioning',
        estacionamiento: 'parking',
        garage: 'parking',
        cochera: 'parking',
        mascotas: 'pets-allowed',
        'acepta mascotas': 'pets-allowed',
        desayuno: 'breakfast',
        'desayuno incluido': 'breakfast'
    },
    en: {
        pool: 'pool',
        'swimming pool': 'pool',
        wifi: 'wifi',
        internet: 'wifi',
        bbq: 'bbq',
        barbecue: 'bbq',
        grill: 'bbq',
        'air conditioning': 'air-conditioning',
        ac: 'air-conditioning',
        'air conditioner': 'air-conditioning',
        parking: 'parking',
        garage: 'parking',
        pets: 'pets-allowed',
        'pet friendly': 'pets-allowed',
        'pet-friendly': 'pets-allowed',
        breakfast: 'breakfast',
        'breakfast included': 'breakfast'
    },
    pt: {
        piscina: 'pool',
        wifi: 'wifi',
        internet: 'wifi',
        churrasqueira: 'bbq',
        churrasco: 'bbq',
        'ar condicionado': 'air-conditioning',
        ar: 'air-conditioning',
        estacionamento: 'parking',
        garagem: 'parking',
        animais: 'pets-allowed',
        'aceita animais': 'pets-allowed',
        'café da manhã': 'breakfast',
        'café incluído': 'breakfast'
    }
} as const;

/**
 * Match NL amenity mentions to slugs.
 *
 * Scans `text` for every key in the locale-specific `AMENITY_ALLOWLIST`
 * dictionary. Both the text and each dictionary key are lowercased and trimmed
 * before comparison so matching is case-insensitive. The function checks whether
 * the lowercased-trimmed key appears as a substring of the lowercased text.
 *
 * Returns a de-duplicated, readonly array of matched slugs. Unmatched terms are
 * silently ignored — the function never guesses.
 *
 * @param text   - Raw text to scan (typically the full user query or a slot value).
 * @param locale - User locale for dictionary selection (`es` | `en` | `pt`).
 * @returns De-duplicated array of matched amenity slugs.
 *
 * @example
 * ```ts
 * matchAmenityTerms('quiero pileta y wifi', 'es'); // ['pool', 'wifi']
 * matchAmenityTerms('I want a pool', 'en');         // ['pool']
 * matchAmenityTerms('nothing here', 'en');           // []
 * ```
 */
export function matchAmenityTerms(text: string, locale: 'es' | 'en' | 'pt'): readonly string[] {
    // The type of AMENITY_ALLOWLIST values is `Readonly<Record<string, string>>`,
    // but TypeScript infers `| undefined` for index-access on a `Record<string, …>`.
    // The fallback to 'es' guarantees a defined value; the cast makes this explicit.
    const dict = (AMENITY_ALLOWLIST[locale] ?? AMENITY_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const normalised = text.toLowerCase();
    const matched = new Set<string>();

    for (const [term, slug] of Object.entries(dict)) {
        if (normalised.includes(term.toLowerCase().trim())) {
            matched.add(slug);
        }
    }

    return Array.from(matched);
}

// ─── Feature Allowlist ────────────────────────────────────────────────────────

/**
 * Per-locale dictionary mapping NL term variants → feature slug.
 *
 * Covers environment, atmosphere, aptitude, and style descriptors only.
 * Physical services (pets / wifi / parking / pool / breakfast / air-conditioning
 * / BBQ) are INTENTIONALLY absent — they have boolean shortcut slots or belong
 * in `AMENITY_ALLOWLIST`. See the anti-overlap rule in the module JSDoc.
 *
 * The 18 allowed feature slugs are:
 * `river_front`, `natural_environment`, `silent_environment`, `quiet_zone`,
 * `rural_area`, `central_area`, `panoramic_view_extended`, `dock_access`,
 * `couple_suitable`, `family_suitable`, `ideal_for_groups`, `wedding_suitable`,
 * `rustic_style`, `modern_style`, `yoga_meditation_area`,
 * `spiritual_retreat_suitable`, `digital_detox_zone`, `sustainable_accommodation`.
 *
 * @example
 * ```ts
 * const slug = FEATURE_ALLOWLIST['es']['tranquilo']; // 'quiet_zone'
 * ```
 */
export const FEATURE_ALLOWLIST: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    es: {
        'frente al río': 'river_front',
        'cerca del río': 'river_front',
        'sobre el río': 'river_front',
        naturaleza: 'natural_environment',
        'entorno natural': 'natural_environment',
        'en la naturaleza': 'natural_environment',
        silencioso: 'silent_environment',
        'sin ruido': 'silent_environment',
        tranquilo: 'quiet_zone',
        'zona tranquila': 'quiet_zone',
        'zona rural': 'rural_area',
        campo: 'rural_area',
        rural: 'rural_area',
        céntrico: 'central_area',
        'en el centro': 'central_area',
        'zona céntrica': 'central_area',
        'vista panorámica': 'panoramic_view_extended',
        vistas: 'panoramic_view_extended',
        muelle: 'dock_access',
        'acceso al muelle': 'dock_access',
        embarcadero: 'dock_access',
        'para parejas': 'couple_suitable',
        romántico: 'couple_suitable',
        'escapada de pareja': 'couple_suitable',
        'para familias': 'family_suitable',
        familiar: 'family_suitable',
        'para grupos': 'ideal_for_groups',
        'grupos grandes': 'ideal_for_groups',
        casamiento: 'wedding_suitable',
        boda: 'wedding_suitable',
        'para casamientos': 'wedding_suitable',
        rústico: 'rustic_style',
        'estilo rústico': 'rustic_style',
        moderno: 'modern_style',
        'estilo moderno': 'modern_style',
        yoga: 'yoga_meditation_area',
        meditación: 'yoga_meditation_area',
        'retiro espiritual': 'spiritual_retreat_suitable',
        espiritual: 'spiritual_retreat_suitable',
        'desconexión digital': 'digital_detox_zone',
        'detox digital': 'digital_detox_zone',
        'sin pantallas': 'digital_detox_zone',
        sustentable: 'sustainable_accommodation',
        ecológico: 'sustainable_accommodation',
        sostenible: 'sustainable_accommodation'
    },
    en: {
        riverfront: 'river_front',
        'river front': 'river_front',
        'by the river': 'river_front',
        'near the river': 'river_front',
        nature: 'natural_environment',
        'natural setting': 'natural_environment',
        'in nature': 'natural_environment',
        silent: 'silent_environment',
        'no noise': 'silent_environment',
        quiet: 'quiet_zone',
        peaceful: 'quiet_zone',
        rural: 'rural_area',
        countryside: 'rural_area',
        central: 'central_area',
        downtown: 'central_area',
        'city center': 'central_area',
        'panoramic view': 'panoramic_view_extended',
        views: 'panoramic_view_extended',
        dock: 'dock_access',
        'dock access': 'dock_access',
        pier: 'dock_access',
        'for couples': 'couple_suitable',
        romantic: 'couple_suitable',
        'couples getaway': 'couple_suitable',
        'family friendly': 'family_suitable',
        'for families': 'family_suitable',
        'for groups': 'ideal_for_groups',
        'large groups': 'ideal_for_groups',
        wedding: 'wedding_suitable',
        'for weddings': 'wedding_suitable',
        rustic: 'rustic_style',
        'rustic style': 'rustic_style',
        modern: 'modern_style',
        'modern style': 'modern_style',
        yoga: 'yoga_meditation_area',
        meditation: 'yoga_meditation_area',
        'spiritual retreat': 'spiritual_retreat_suitable',
        retreat: 'spiritual_retreat_suitable',
        'digital detox': 'digital_detox_zone',
        unplugged: 'digital_detox_zone',
        'screen free': 'digital_detox_zone',
        sustainable: 'sustainable_accommodation',
        eco: 'sustainable_accommodation',
        'eco friendly': 'sustainable_accommodation'
    },
    pt: {
        'frente ao rio': 'river_front',
        'perto do rio': 'river_front',
        'beira-rio': 'river_front',
        natureza: 'natural_environment',
        'ambiente natural': 'natural_environment',
        silencioso: 'silent_environment',
        'sem ruído': 'silent_environment',
        tranquilo: 'quiet_zone',
        'zona tranquila': 'quiet_zone',
        'zona rural': 'rural_area',
        campo: 'rural_area',
        rural: 'rural_area',
        central: 'central_area',
        'no centro': 'central_area',
        cêntrico: 'central_area',
        'vista panorâmica': 'panoramic_view_extended',
        vistas: 'panoramic_view_extended',
        cais: 'dock_access',
        'acesso ao cais': 'dock_access',
        píer: 'dock_access',
        'para casais': 'couple_suitable',
        romântico: 'couple_suitable',
        'para famílias': 'family_suitable',
        familiar: 'family_suitable',
        'para grupos': 'ideal_for_groups',
        'grupos grandes': 'ideal_for_groups',
        casamento: 'wedding_suitable',
        'para casamentos': 'wedding_suitable',
        rústico: 'rustic_style',
        'estilo rústico': 'rustic_style',
        moderno: 'modern_style',
        'estilo moderno': 'modern_style',
        ioga: 'yoga_meditation_area',
        yoga: 'yoga_meditation_area',
        meditação: 'yoga_meditation_area',
        'retiro espiritual': 'spiritual_retreat_suitable',
        espiritual: 'spiritual_retreat_suitable',
        'detox digital': 'digital_detox_zone',
        'desconexão digital': 'digital_detox_zone',
        sustentável: 'sustainable_accommodation',
        ecológico: 'sustainable_accommodation'
    }
} as const;

/**
 * Match NL feature mentions to slugs.
 *
 * Scans `text` for every key in the locale-specific `FEATURE_ALLOWLIST`
 * dictionary. Both the text and each dictionary key are lowercased and trimmed
 * before comparison so matching is case-insensitive. The function checks whether
 * the lowercased-trimmed key appears as a substring of the lowercased text.
 *
 * Returns a de-duplicated, readonly array of matched slugs. Unmatched terms are
 * silently ignored — the function never guesses.
 *
 * Physical services (pets / wifi / parking) are excluded from `FEATURE_ALLOWLIST`
 * by design. Calling this function with "pet friendly" or "wifi" will always
 * return an empty array for those terms — they belong in the boolean shortcut
 * slots (`allowsPets`, `hasWifi`, `hasParking`) or in `AMENITY_ALLOWLIST`.
 *
 * @param text   - Raw text to scan (typically the full user query or a slot value).
 * @param locale - User locale for dictionary selection (`es` | `en` | `pt`).
 * @returns De-duplicated array of matched feature slugs.
 *
 * @example
 * ```ts
 * matchFeatureTerms('quiero algo tranquilo frente al río', 'es');
 * // ['quiet_zone', 'river_front']
 *
 * matchFeatureTerms('pet friendly', 'en'); // [] — anti-overlap rule
 * matchFeatureTerms('wifi', 'en');          // [] — anti-overlap rule
 * ```
 */
export function matchFeatureTerms(text: string, locale: 'es' | 'en' | 'pt'): readonly string[] {
    // Same TypeScript narrowing issue as matchAmenityTerms — cast ensures a
    // defined value after the 'es' fallback.
    const dict = (FEATURE_ALLOWLIST[locale] ?? FEATURE_ALLOWLIST.es) as Readonly<
        Record<string, string>
    >;
    const normalised = text.toLowerCase();
    const matched = new Set<string>();

    for (const [term, slug] of Object.entries(dict)) {
        if (normalised.includes(term.toLowerCase().trim())) {
            matched.add(slug);
        }
    }

    return Array.from(matched);
}

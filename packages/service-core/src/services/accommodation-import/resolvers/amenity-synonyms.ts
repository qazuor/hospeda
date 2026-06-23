/**
 * Amenity Synonym Dictionary and Normalization Helpers (SPEC-258)
 *
 * Provides:
 * - {@link normalizeAmenityTerm} — canonical normalization of a raw amenity string.
 * - {@link AMENITY_SYNONYMS} — static map from a normalized variant term to a
 *   canonical Hospeda amenity **slug** (slugs are stable and unique; UUIDs are not).
 *
 * ## Design decisions
 *
 * - **Canonical key = slug** (not UUID). Slugs are stable, human-readable, and
 *   unique within the catalog. They survive catalog refactors that might reassign
 *   UUIDs.
 * - **Conservative dictionary**: only unambiguous synonyms are included. When
 *   there is any doubt about the target amenity, the term is omitted and the
 *   original name flows to `unresolved` for host review.
 * - **No fuzzy matching**: the dictionary is an exact lookup on the normalized
 *   form. Levenshtein / edit-distance matching is intentionally excluded to
 *   avoid false positives (SPEC-222 AC-9.3).
 * - The normalization step (lowercase, strip diacritics, collapse whitespace,
 *   simple plural fold) is applied to BOTH the raw input AND the dictionary
 *   keys at build-time so runtime lookup is a plain Map.get() call.
 *
 * ## Catalog slugs targeted by this map
 *
 * The following real catalog slugs (from `packages/seed/src/data/amenity/`)
 * are referenced:
 *   pool, heated_pool, wifi, air_conditioning, heating, parking, covered_parking,
 *   bbq_grill, jacuzzi, sauna, fireplace, wood_stove, terrace, balcony, patio,
 *   private_garden, washer, dryer, iron, hair_dryer, fan, kitchen_utensils,
 *   full_kitchen, refrigerator_freezer, microwave, coffee_maker, electric_kettle,
 *   gas_electric_stove, cable_tv, smart_tv, tv_per_room, bed_linens, towels,
 *   breakfast, pet_friendly, elevator, wheelchair_accessible, gym, spa,
 *   playground, crib, high_chair, bicycles, kayaks, first_aid_kit,
 *   smoke_detector, fire_extinguisher, safe, room_service, daily_cleaning,
 *   laundry_service, luggage_storage, bar, restaurant, coworking_space,
 *   river_access, river_view, panoramic_view, organic_garden, outdoor_furniture,
 *   beach_equipment, fishing_equipment, outdoor_kitchen, shared_kitchen,
 *   relaxation_area, security_parking, water_heater, international_adapters
 *
 * @module services/accommodation-import/resolvers/amenity-synonyms
 */

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw amenity string for synonym lookup.
 *
 * Applies, in order:
 * 1. Trim leading/trailing whitespace.
 * 2. Lowercase.
 * 3. Strip diacritics (NFD decomposition + remove combining marks U+0300–U+036F).
 * 4. Collapse internal whitespace sequences to a single space.
 * 5. Simple singular fold: remove trailing `s` only when the resulting stem is
 *    ≥ 3 characters AND the preceding character is a vowel (`a`, `e`, `i`, `o`,
 *    `u`) or the letter `l`. This covers the common Spanish/Portuguese/English
 *    plurals (piletas→pileta, pools→pool, towels→towel) while avoiding false
 *    folds on consonant clusters (bikes→bike would fold to "bik" without the
 *    guard, which is wrong).
 *
 * The fold is intentionally conservative. Words not handled by this rule are
 * covered by explicit entries in the synonym dictionary.
 *
 * @param raw - The raw amenity string to normalize.
 * @returns The normalized form, suitable for dictionary lookup.
 *
 * @example
 * ```ts
 * normalizeAmenityTerm('Piscinas')  // 'piscina'  (vowel before s → fold)
 * normalizeAmenityTerm('Pools')     // 'pool'     (l before s → fold)
 * normalizeAmenityTerm('Bikes')     // 'bikes'    (k before s → no fold)
 * normalizeAmenityTerm('Aire acondicionado') // 'aire acondicionado'
 * normalizeAmenityTerm('  WIFI  ')  // 'wifi'
 * ```
 */
export function normalizeAmenityTerm(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed === '') {
        return '';
    }

    // Lowercase + strip diacritics
    const withoutAccents = trimmed
        .toLowerCase()
        .normalize('NFD')
        // Strip combining diacritical marks: \p{Mn} (nonspacing marks) after NFD is
        // the idiomatic accent-strip and avoids biome's noMisleadingCharacterClass.
        .replace(/\p{Mn}/gu, '');

    // Collapse internal whitespace
    const collapsed = withoutAccents.replace(/\s+/g, ' ');

    // Simple plural fold: strip trailing `s` when the preceding character is a
    // vowel or `l` (covers -as/-es/-os/-is/-us and -ls) and the stem is ≥ 3 chars.
    if (
        collapsed.endsWith('s') &&
        collapsed.length - 1 >= 3 &&
        /[aeioul]$/.test(collapsed.slice(0, -1))
    ) {
        return collapsed.slice(0, -1);
    }

    return collapsed;
}

// ---------------------------------------------------------------------------
// Synonym dictionary
// ---------------------------------------------------------------------------

/**
 * Maps a normalized amenity variant term to its canonical Hospeda catalog slug.
 *
 * Keys are pre-normalized using {@link normalizeAmenityTerm} so runtime lookup
 * is a direct Map.get() without any additional transformation.
 *
 * Coverage: es/en/pt common scraped variants for the most frequently encountered
 * amenities. Seeded from the `accommodation_import` and `translate` prompt
 * terminology in `packages/ai-core/src/engine/default-prompts.ts`, expanded for
 * regional variants (Rioplatense Spanish: pileta, cochera, quincho, etc.).
 *
 * @example
 * ```ts
 * AMENITY_SYNONYMS.get(normalizeAmenityTerm('pileta')) // 'pool'
 * AMENITY_SYNONYMS.get(normalizeAmenityTerm('Wi-Fi'))  // 'wifi'
 * ```
 */
export const AMENITY_SYNONYMS: ReadonlyMap<string, string> = new Map<string, string>(
    (
        [
            // ----------------------------------------------------------------
            // Pool / piscina / pileta
            // ----------------------------------------------------------------
            ['pileta', 'pool'],
            ['piscina', 'pool'],
            ['pool', 'pool'],
            ['swimming pool', 'pool'],
            ['swimming-pool', 'pool'],
            ['alberca', 'pool'], // Mexican Spanish

            // Heated pool
            ['pileta climatizada', 'heated_pool'],
            ['piscina climatizada', 'heated_pool'],
            ['heated pool', 'heated_pool'],
            ['pool climatizado', 'heated_pool'],

            // ----------------------------------------------------------------
            // WiFi / internet
            // ----------------------------------------------------------------
            ['wi-fi', 'wifi'],
            ['wi fi', 'wifi'],
            ['internet', 'wifi'],
            ['acceso a internet', 'wifi'],
            ['conexion wifi', 'wifi'],
            ['conexion wi-fi', 'wifi'],
            ['wireless', 'wifi'],
            ['wireless internet', 'wifi'],

            // ----------------------------------------------------------------
            // Air conditioning / aire acondicionado
            // ----------------------------------------------------------------
            ['aire', 'air_conditioning'],
            ['a/c', 'air_conditioning'],
            ['ac', 'air_conditioning'],
            ['aire acondicionado', 'air_conditioning'],
            ['air conditioning', 'air_conditioning'],
            ['air conditioner', 'air_conditioning'],
            ['ar condicionado', 'air_conditioning'], // Portuguese
            ['climatizacion', 'air_conditioning'],
            ['climatizador', 'air_conditioning'],

            // ----------------------------------------------------------------
            // Heating / calefaccion
            // ----------------------------------------------------------------
            ['calefaccion', 'heating'],
            ['calefaccion central', 'heating'],
            ['central heating', 'heating'],
            ['aquecimento', 'heating'], // Portuguese
            ['calefacc', 'heating'],

            // ----------------------------------------------------------------
            // Parking / cochera / garage
            // ----------------------------------------------------------------
            ['cochera', 'parking'],
            ['garage', 'parking'],
            ['garaje', 'parking'],
            ['estacionamiento', 'parking'],
            ['parking', 'parking'],
            ['car park', 'parking'],
            ['estacionamento', 'parking'], // Portuguese

            // Covered parking
            ['cochera cubierta', 'covered_parking'],
            ['garage cubierto', 'covered_parking'],
            ['covered parking', 'covered_parking'],
            ['estacionamiento cubierto', 'covered_parking'],

            // ----------------------------------------------------------------
            // BBQ / parrilla / grill
            // ----------------------------------------------------------------
            ['parrilla', 'bbq_grill'],
            ['bbq', 'bbq_grill'],
            ['barbecue', 'bbq_grill'],
            ['grill', 'bbq_grill'],
            ['asador', 'bbq_grill'],
            ['parrillada', 'bbq_grill'],
            ['churrasqueira', 'bbq_grill'], // Portuguese

            // ----------------------------------------------------------------
            // Jacuzzi / banheira de hidromassagem
            // ----------------------------------------------------------------
            ['jacuzzi', 'jacuzzi'],
            ['jacuzzy', 'jacuzzi'],
            ['banheira de hidromassagem', 'jacuzzi'], // Portuguese
            ['hidromasaje', 'jacuzzi'],
            ['hot tub', 'jacuzzi'],
            ['tina caliente', 'jacuzzi'],
            ['spa de hidroterapia', 'jacuzzi'],

            // ----------------------------------------------------------------
            // Sauna
            // ----------------------------------------------------------------
            ['sauna', 'sauna'],

            // ----------------------------------------------------------------
            // Fireplace / chimenea
            // ----------------------------------------------------------------
            ['chimenea', 'fireplace'],
            ['hogar a lena', 'fireplace'],
            ['fireplace', 'fireplace'],
            ['lareira', 'fireplace'], // Portuguese
            ['fogao a lenha', 'fireplace'], // Portuguese

            // Wood stove
            ['salamandra', 'wood_stove'],
            ['estufa a lena', 'wood_stove'],
            ['wood stove', 'wood_stove'],
            ['estufa de lenha', 'wood_stove'], // Portuguese
            ['fogon', 'wood_stove'],

            // ----------------------------------------------------------------
            // Terrace / terraza
            // ----------------------------------------------------------------
            ['terraza', 'terrace'],
            ['terrace', 'terrace'],
            ['terraco', 'terrace'], // Portuguese
            ['techo terraza', 'terrace'],

            // Balcony / balcon
            ['balcon', 'balcony'],
            ['balcony', 'balcony'],
            ['varanda', 'balcony'], // Portuguese

            // Patio
            ['patio', 'patio'],
            ['patio exterior', 'patio'],
            ['deck', 'patio'],

            // Private garden / jardin
            ['jardin', 'private_garden'],
            ['jardin privado', 'private_garden'],
            ['private garden', 'private_garden'],
            ['jardim privado', 'private_garden'], // Portuguese

            // ----------------------------------------------------------------
            // Washer / lavarropas / lavadora
            // ----------------------------------------------------------------
            ['lavarropas', 'washer'],
            ['lavadora', 'washer'],
            ['washing machine', 'washer'],
            ['maquina de lavar', 'washer'], // Portuguese
            ['washer', 'washer'],
            ['lavanderia', 'washer'],

            // Dryer / secadora
            ['secadora', 'dryer'],
            ['dryer', 'dryer'],
            ['tumble dryer', 'dryer'],

            // Iron / plancha
            ['plancha', 'iron'],
            ['iron', 'iron'],

            // Hair dryer / secador de pelo
            ['secador de pelo', 'hair_dryer'],
            ['secador', 'hair_dryer'],
            ['hair dryer', 'hair_dryer'],
            ['blow dryer', 'hair_dryer'],
            ['secador de cabelo', 'hair_dryer'], // Portuguese

            // Fan / ventilador
            ['ventilador', 'fan'],
            ['fan', 'fan'],
            ['ventilacao', 'fan'], // Portuguese

            // ----------------------------------------------------------------
            // Kitchen / cocina
            // ----------------------------------------------------------------
            ['cocina completa', 'full_kitchen'],
            ['cocina equipada', 'full_kitchen'],
            ['full kitchen', 'full_kitchen'],
            ['cocina', 'full_kitchen'],
            ['kitchen', 'full_kitchen'],
            ['cozinha completa', 'full_kitchen'], // Portuguese
            ['cozinha equipada', 'full_kitchen'], // Portuguese
            ['kitchenette', 'full_kitchen'],

            // Kitchen utensils
            ['utensilios de cocina', 'kitchen_utensils'],
            ['kitchen utensils', 'kitchen_utensils'],
            ['utensilios', 'kitchen_utensils'],
            ['vajilla', 'kitchen_utensils'],
            ['kit de cocina', 'kitchen_utensils'],

            // Refrigerator
            ['heladera', 'refrigerator_freezer'],
            ['frigorifico', 'refrigerator_freezer'],
            ['refrigerador', 'refrigerator_freezer'],
            ['refrigerator', 'refrigerator_freezer'],
            ['fridge', 'refrigerator_freezer'],
            ['geladeira', 'refrigerator_freezer'], // Portuguese

            // Microwave
            ['microondas', 'microwave'],
            ['microwave', 'microwave'],

            // Coffee maker / cafetera
            ['cafetera', 'coffee_maker'],
            ['coffee maker', 'coffee_maker'],
            ['coffee machine', 'coffee_maker'],
            ['cafeteira', 'coffee_maker'], // Portuguese
            ['maquina de cafe', 'coffee_maker'],

            // Electric kettle / pava electrica
            ['pava electrica', 'electric_kettle'],
            ['electric kettle', 'electric_kettle'],
            ['kettle', 'electric_kettle'],
            ['chaleira eletrica', 'electric_kettle'], // Portuguese

            // Stove / hornallas
            ['hornallas', 'gas_electric_stove'],
            ['cocina a gas', 'gas_electric_stove'],
            ['cocina electrica', 'gas_electric_stove'],
            ['gas stove', 'gas_electric_stove'],
            ['electric stove', 'gas_electric_stove'],
            ['fogao', 'gas_electric_stove'], // Portuguese

            // ----------------------------------------------------------------
            // TV / television
            // ----------------------------------------------------------------
            ['television', 'cable_tv'],
            ['tv', 'cable_tv'],
            ['television por cable', 'cable_tv'],
            ['cable tv', 'cable_tv'],
            ['tv a cable', 'cable_tv'],

            ['smart tv', 'smart_tv'],
            ['television inteligente', 'smart_tv'],
            ['tv smart', 'smart_tv'],

            // ----------------------------------------------------------------
            // Bed linens / ropa de cama
            // ----------------------------------------------------------------
            ['ropa de cama', 'bed_linens'],
            ['sabanas', 'bed_linens'],
            ['bed linens', 'bed_linens'],
            ['linen', 'bed_linens'],
            ['roupa de cama', 'bed_linens'], // Portuguese

            // Towels / toallas
            ['toallas', 'towels'],
            ['towels', 'towels'],
            ['toalha', 'towels'], // Portuguese

            // ----------------------------------------------------------------
            // Breakfast / desayuno
            // ----------------------------------------------------------------
            ['desayuno', 'breakfast'],
            ['desayuno incluido', 'breakfast'],
            ['breakfast', 'breakfast'],
            ['breakfast included', 'breakfast'],
            ['cafe da manha', 'breakfast'], // Portuguese

            // ----------------------------------------------------------------
            // Pet friendly / mascotas
            // ----------------------------------------------------------------
            ['mascotas permitidas', 'pet_friendly'],
            ['se admiten mascotas', 'pet_friendly'],
            ['pets allowed', 'pet_friendly'],
            ['pet friendly', 'pet_friendly'],
            ['pet-friendly', 'pet_friendly'],
            ['animais permitidos', 'pet_friendly'], // Portuguese

            // ----------------------------------------------------------------
            // Accessibility
            // ----------------------------------------------------------------
            ['acceso para discapacitados', 'wheelchair_accessible'],
            ['accesible para silla de ruedas', 'wheelchair_accessible'],
            ['wheelchair accessible', 'wheelchair_accessible'],
            ['accessible', 'wheelchair_accessible'],

            ['ascensor', 'elevator'],
            ['elevator', 'elevator'],
            ['lift', 'elevator'],
            ['elevador', 'elevator'], // Portuguese

            // ----------------------------------------------------------------
            // Gym / gimnasio
            // ----------------------------------------------------------------
            ['gimnasio', 'gym'],
            ['gym', 'gym'],
            ['fitness', 'gym'],
            ['fitness center', 'gym'],
            ['sala de musculacion', 'gym'],

            // ----------------------------------------------------------------
            // Spa
            // ----------------------------------------------------------------
            ['spa', 'spa'],
            ['centro de spa', 'spa'],

            // ----------------------------------------------------------------
            // Children / niños
            // ----------------------------------------------------------------
            ['zona de juegos', 'playground'],
            ['parque infantil', 'playground'],
            ['playground', 'playground'],
            ['juegos para ninos', 'playground'],

            ['cuna', 'crib'],
            ['crib', 'crib'],
            ['berco', 'crib'], // Portuguese

            ['silla alta', 'high_chair'],
            ['high chair', 'high_chair'],
            ['cadeira alta', 'high_chair'], // Portuguese

            // ----------------------------------------------------------------
            // Activities / actividades
            // ----------------------------------------------------------------
            ['bicicletas', 'bicycles'],
            ['bicicletas disponibles', 'bicycles'],
            ['bicycles', 'bicycles'],
            ['bikes', 'bicycles'],

            ['kayak', 'kayaks'],
            ['kayaks', 'kayaks'],
            ['canoas', 'kayaks'],

            ['equipo de pesca', 'fishing_equipment'],
            ['fishing equipment', 'fishing_equipment'],
            ['material de pesca', 'fishing_equipment'],

            // ----------------------------------------------------------------
            // Safety / seguridad
            // ----------------------------------------------------------------
            ['botiquin', 'first_aid_kit'],
            ['botiquin de primeros auxilios', 'first_aid_kit'],
            ['first aid kit', 'first_aid_kit'],
            ['kit de primeiros socorros', 'first_aid_kit'], // Portuguese

            ['detector de humo', 'smoke_detector'],
            ['smoke detector', 'smoke_detector'],
            ['detector de fumaca', 'smoke_detector'], // Portuguese

            ['extintor', 'fire_extinguisher'],
            ['matafuego', 'fire_extinguisher'],
            ['fire extinguisher', 'fire_extinguisher'],
            ['extinguidor', 'fire_extinguisher'],

            ['caja fuerte', 'safe'],
            ['safe', 'safe'],
            ['cofre', 'safe'], // Portuguese

            // ----------------------------------------------------------------
            // Services / servicios
            // ----------------------------------------------------------------
            ['servicio de habitaciones', 'room_service'],
            ['room service', 'room_service'],

            ['limpieza diaria', 'daily_cleaning'],
            ['servicio de limpieza', 'daily_cleaning'],
            ['daily cleaning', 'daily_cleaning'],

            ['servicio de lavanderia', 'laundry_service'],
            ['laundry service', 'laundry_service'],

            ['guarda equipaje', 'luggage_storage'],
            ['luggage storage', 'luggage_storage'],

            ['bar', 'bar'],

            ['restaurante', 'restaurant'],
            ['restaurant', 'restaurant'],

            // ----------------------------------------------------------------
            // Work-friendly
            // ----------------------------------------------------------------
            ['espacio de coworking', 'coworking_space'],
            ['coworking', 'coworking_space'],
            ['coworking space', 'coworking_space'],
            ['espacio de trabajo', 'coworking_space'],

            // ----------------------------------------------------------------
            // Outdoor / vistas
            // ----------------------------------------------------------------
            ['acceso al rio', 'river_access'],
            ['acceso directo al rio', 'river_access'],
            ['river access', 'river_access'],
            ['frente al rio', 'river_access'],

            ['vista al rio', 'river_view'],
            ['river view', 'river_view'],
            ['vista rio', 'river_view'],

            ['vista panoramica', 'panoramic_view'],
            ['panoramic view', 'panoramic_view'],
            ['vistas panoramicas', 'panoramic_view'],

            ['jardin organico', 'organic_garden'],
            ['huerta organica', 'organic_garden'],
            ['organic garden', 'organic_garden'],

            ['muebles de jardin', 'outdoor_furniture'],
            ['outdoor furniture', 'outdoor_furniture'],
            ['muebles de exterior', 'outdoor_furniture'],

            ['equipo de playa', 'beach_equipment'],
            ['beach equipment', 'beach_equipment'],
            ['kit de playa', 'beach_equipment'],

            ['cocina exterior', 'outdoor_kitchen'],
            ['cocina al aire libre', 'outdoor_kitchen'],
            ['outdoor kitchen', 'outdoor_kitchen'],

            ['cocina compartida', 'shared_kitchen'],
            ['shared kitchen', 'shared_kitchen'],

            ['zona de relax', 'relaxation_area'],
            ['relaxation area', 'relaxation_area'],
            ['area de descanso', 'relaxation_area'],

            ['estacionamiento con seguridad', 'security_parking'],
            ['security parking', 'security_parking'],
            ['estacionamiento vigilado', 'security_parking'],

            ['calentador de agua', 'water_heater'],
            ['water heater', 'water_heater'],
            ['termotanque', 'water_heater'],

            ['adaptadores internacionales', 'international_adapters'],
            ['international adapters', 'international_adapters'],
            ['adaptadores de corriente', 'international_adapters']
        ] as const
    ).map(([raw, slug]) => [normalizeAmenityTerm(raw), slug] as [string, string])
);

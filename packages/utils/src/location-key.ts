/**
 * Location key (HOS-1810): a normalized, comparable form of a postal address,
 * used to detect two listings that describe the same physical place.
 * @module utils/location-key
 */

/**
 * Street-type spellings, each mapped to ONE canonical token. The type is part
 * of the key: «Calle 9», «Ruta 9» and «Av. 9» are three different places.
 */
const STREET_TYPES: Readonly<Record<string, string>> = {
    calle: 'calle',
    c: 'calle',
    av: 'av',
    avda: 'av',
    avd: 'av',
    avenida: 'av',
    bv: 'bv',
    bvd: 'bv',
    bvard: 'bv',
    blvd: 'bv',
    bulevar: 'bv',
    boulevard: 'bv',
    ruta: 'ruta',
    rn: 'ruta',
    rp: 'ruta',
    pasaje: 'pje',
    psje: 'pje',
    pje: 'pje',
    diag: 'diag',
    diagonal: 'diag'
};

/** Words that follow «Ruta» and carry no identity («Ruta nacional 9»). */
const ROUTE_QUALIFIERS: ReadonlySet<string> = new Set(['nacional', 'provincial']);

/** Common title abbreviations expanded to the full word, anywhere in the street. */
const TITLE_ABBREVIATIONS: Readonly<Record<string, string>> = {
    gral: 'general',
    cnel: 'coronel',
    dr: 'doctor',
    dra: 'doctora',
    pte: 'presidente',
    tte: 'teniente',
    alte: 'almirante',
    brig: 'brigadier',
    sgto: 'sargento',
    ing: 'ingeniero',
    cap: 'capitan',
    mtro: 'maestro',
    pbro: 'presbitero',
    mons: 'monsenor',
    fray: 'fray'
};

/** Ground-floor spellings unified to one token. */
const GROUND_FLOOR_TOKENS: ReadonlySet<string> = new Set(['pb', 'planta baja', 'p b']);

/** Apartment markers dropped before comparing («Depto. A» equals «a»). */
const APARTMENT_MARKERS: ReadonlySet<string> = new Set([
    'depto',
    'dpto',
    'dto',
    'departamento',
    'of',
    'oficina',
    'local'
]);

/**
 * Lowercases, removes accents and punctuation and collapses whitespace.
 *
 * @param value - Raw text.
 * @returns The normalized text, possibly empty.
 */
function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[°º]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Input of {@link buildLocationKey}. */
export interface BuildLocationKeyInput {
    /** Street name, as typed. */
    readonly street?: string | null;
    /** Street number, as typed. `s/n` or no digits means no key. */
    readonly number?: string | null;
    /** Floor, optional. */
    readonly floor?: string | null;
    /** Apartment, optional. */
    readonly apartment?: string | null;
    /** The listing's destination id. */
    readonly destinationId?: string | null;
}

/**
 * Normalizes a street: drops accents, case and punctuation, canonicalizes the
 * leading street type («Av.», «Avenida», «Avda» are all `av`) and expands
 * common title abbreviations («Gral.» is `general`). The type stays in the key.
 */
function normalizeStreet(street: string): string {
    let words = normalizeText(street).split(' ').filter(Boolean);
    // «R.N. 9» / «R.P. 9» normalize to «r n 9»: rejoin the two letters.
    if (words[0] === 'r' && (words[1] === 'n' || words[1] === 'p')) {
        words = ['ruta', ...words.slice(2)];
    }
    const type = words.length > 0 ? STREET_TYPES[words[0] as string] : undefined;
    if (type) {
        words = [type, ...words.slice(1)];
        if (type === 'ruta' && ROUTE_QUALIFIERS.has(words[1] as string)) words.splice(1, 1);
    }
    words = words.map((word, index) =>
        index === 0 && type ? word : (TITLE_ABBREVIATIONS[word] ?? word)
    );
    // A street that is only a type («Av.») names nothing.
    if (words.length === 1 && type) return '';
    return words.join(' ');
}

/** Normalizes a floor; ground floor spellings collapse to `pb`. */
function normalizeFloor(floor: string): string {
    const text = normalizeText(floor);
    return GROUND_FLOOR_TOKENS.has(text) ? 'pb' : text;
}

/** Normalizes an apartment; drops a leading marker such as «Depto.». */
function normalizeApartment(apartment: string): string {
    const words = normalizeText(apartment).split(' ').filter(Boolean);
    while (words.length > 1 && APARTMENT_MARKERS.has(words[0] as string)) {
        words.shift();
    }
    return words.join(' ');
}

/**
 * Builds the key that identifies a physical place, or `null` when the address
 * is not specific enough to claim two listings are the same place.
 *
 * The key is `street|number|destinationId`, plus `|floor|apartment` when
 * either is present. No key is produced when the street, the destination or
 * the number is missing, and when the number is `s/n` (or has no digit, or is
 * only zeros): two «camino al arroyo s/n» are not provably the same place.
 *
 * @param input - The address parts and the destination id.
 * @returns The deterministic key, or `null`.
 *
 * @example
 * buildLocationKey({ street: 'Av. San Martín', number: '123', destinationId: 'd1' });
 * // 'san martin|123|d1'
 */
export function buildLocationKey(input: BuildLocationKeyInput): string | null {
    const destinationId = input.destinationId?.trim();
    if (!destinationId) return null;

    const street = normalizeStreet(input.street ?? '');
    if (!street) return null;

    const number = normalizeText(input.number ?? '');
    if (!/[1-9]/.test(number)) return null;

    const floor = normalizeFloor(input.floor ?? '');
    const apartment = normalizeApartment(input.apartment ?? '');

    const base = `${street}|${number}|${destinationId}`;
    return floor || apartment ? `${base}|${floor}|${apartment}` : base;
}

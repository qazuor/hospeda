/**
 * Location key (HOS-1810): a normalized, comparable form of a postal address,
 * used to detect two listings that describe the same physical place.
 * @module utils/location-key
 */

/** Street-type prefixes dropped from the start of a street name. */
const STREET_PREFIXES: ReadonlySet<string> = new Set([
    'calle',
    'av',
    'avda',
    'avenida',
    'bv',
    'bvd',
    'bulevar',
    'boulevard',
    'ruta',
    'rn',
    'rp',
    'pasaje',
    'psje',
    'pje',
    'diag',
    'diagonal'
]);

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
 * Normalizes a street: drops accents, case, punctuation and the leading
 * street-type prefix («Av.», «Avenida», «Calle»...).
 */
function normalizeStreet(street: string): string {
    const words = normalizeText(street).split(' ').filter(Boolean);
    while (words.length > 0 && STREET_PREFIXES.has(words[0] as string)) {
        words.shift();
    }
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

/**
 * @file listing-policies.ts
 * @description Web-side reading and diffing of the `policies` JSONB every
 * listing vertical carries (HOS-2060).
 *
 * House rules used to be scattered: `extraInfo.minNights`/`maxNights`/
 * `smokingAllowed` on accommodations, `minAge`/`dressCode` columns on venues,
 * `cancellationPolicy`/`acceptsPrivateGroups` on experiences, and amenity rows
 * standing in for "pets welcome" or "accepts cards". They now live in one
 * structured object validated by `@repo/schemas` (`ListingPoliciesBaseSchema`
 * plus each vertical's extension).
 *
 * Two jobs live here and nowhere else:
 *
 * 1. **Reading** — {@link parseListingPolicyValues} turns the raw payload into a
 *    typed value, dropping any key whose shape is wrong instead of rejecting the
 *    whole object. A reader must never lose every rule because one is malformed.
 *    Absent stays absent: a missing key means "not informed", never "no".
 * 2. **Diffing for a PATCH** — {@link buildListingPoliciesPatch}. The API
 *    shallow-merges `policies` per top-level key and deletes a key sent as
 *    `null`, so an editor panel sends ONLY the keys it owns. Two panels writing
 *    different keys of the same object can then never erase each other.
 *
 * @module lib/listing/listing-policies
 */

import {
    ACCOMMODATION_SPOKEN_LANGUAGES,
    type AccommodationSpokenLanguage,
    LISTING_PAYMENT_METHODS,
    LISTING_PET_ADMISSION_VALUES,
    LISTING_SMOKING_VALUES,
    type ListingPaymentMethod,
    type ListingPetAdmission,
    type ListingSmokingPolicy,
    VENUE_RESERVATION_POLICY_VALUES,
    VenueDressCodeEnum,
    type VenueMinAgeScope,
    VenueMinAgeScopeSchema,
    type VenueReservationPolicy
} from '@repo/schemas';

/** A localized short note, always all three locales. */
export interface ListingPolicyNote {
    readonly es: string;
    readonly en: string;
    readonly pt: string;
}

/** A check-in or check-out window (`HH:mm` strings). */
export interface ListingPolicyTimeWindow {
    readonly from?: string;
    readonly to?: string;
}

/** The pets policy as the web reads it. */
export interface ListingPetsPolicyValue {
    readonly admission: ListingPetAdmission;
    readonly extraCost?: boolean;
    readonly notes?: ListingPolicyNote;
}

/** The booking deposit as the web reads it (accommodation only, HOS-2120). */
export interface ListingDepositPolicyValue {
    readonly required: boolean;
    /** Percentage of the stay total, 1–100; only when `required`. */
    readonly percentage?: number;
    readonly notes?: ListingPolicyNote;
}

/**
 * The private-events details as the web reads them (accommodation only,
 * HOS-2122). Meaningful only when `eventsAllowed` is true.
 */
export interface ListingEventsDetailsValue {
    readonly maxGuests?: number;
    readonly amplifiedSound?: boolean;
    /** Latest hour an event may run, `HH:mm`. */
    readonly endTime?: string;
    readonly extraCost?: boolean;
    readonly notes?: ListingPolicyNote;
}

/**
 * Every policy key any vertical declares, all optional.
 *
 * The union of the three vertical schemas: a venue simply never carries
 * `checkIn`, an accommodation never carries `minAge`. Keeping one type lets the
 * readers and the editor panels share one parser and one diff.
 */
export interface ListingPolicyValues {
    readonly paymentMethods?: readonly ListingPaymentMethod[];
    readonly pets?: ListingPetsPolicyValue;
    readonly smokingAllowed?: ListingSmokingPolicy;
    readonly eventsAllowed?: boolean;
    /** Accommodation only. */
    readonly checkIn?: ListingPolicyTimeWindow;
    /** Accommodation only. */
    readonly checkOut?: ListingPolicyTimeWindow;
    /** Accommodation only (publish requirement). */
    readonly minNights?: number;
    /** Accommodation only. */
    readonly maxNights?: number;
    /** Accommodation only: booking deposit (HOS-2120). */
    readonly deposit?: ListingDepositPolicyValue;
    /** Accommodation only: languages the host attends guests in (HOS-2120). */
    readonly spokenLanguages?: readonly AccommodationSpokenLanguage[];
    /** Accommodation only: private-events details (HOS-2122). */
    readonly eventsDetails?: ListingEventsDetailsValue;
    /** Experience only. */
    readonly privateGroups?: boolean;
    /** Experience only: free-text cancellation policy. */
    readonly cancellation?: string;
    /** Venue only. */
    readonly reservations?: VenueReservationPolicy;
    /** Venue only (claimed by the `nightInfo` section). */
    readonly minAge?: number;
    /**
     * Venue only (claimed by the `nightInfo` section, HOS-2098): where or when
     * `minAge` applies. Absent means all day.
     */
    readonly minAgeScope?: VenueMinAgeScope;
    /** Venue only (claimed by the `nightInfo` section). */
    readonly dressCode?: VenueDressCodeEnum;
    /** Venue only (claimed by the `nightInfo` section). */
    readonly dressCodeNote?: ListingPolicyNote;
}

/** One top-level policy key. */
export type ListingPolicyKey = keyof ListingPolicyValues;

/** The shared base keys every vertical's Policies panel edits. */
export const LISTING_BASE_POLICY_KEYS = [
    'paymentMethods',
    'pets',
    'smokingAllowed',
    'eventsAllowed'
] as const satisfies readonly ListingPolicyKey[];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DRESS_CODES: readonly string[] = Object.values(VenueDressCodeEnum);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNote(value: unknown): ListingPolicyNote | undefined {
    if (!isRecord(value)) return undefined;
    const note = {
        es: typeof value.es === 'string' ? value.es : '',
        en: typeof value.en === 'string' ? value.en : '',
        pt: typeof value.pt === 'string' ? value.pt : ''
    };
    return isEmptyPolicyNote(note) ? undefined : note;
}

function readWindow(value: unknown): ListingPolicyTimeWindow | undefined {
    if (!isRecord(value)) return undefined;
    const from = typeof value.from === 'string' && HHMM.test(value.from) ? value.from : undefined;
    const to = typeof value.to === 'string' && HHMM.test(value.to) ? value.to : undefined;
    if (from === undefined && to === undefined) return undefined;
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function readMinAgeScope(value: unknown): VenueMinAgeScope | undefined {
    const parsed = VenueMinAgeScopeSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
}

function readPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readPercentage(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100
        ? value
        : undefined;
}

function readDeposit(value: unknown): ListingDepositPolicyValue | undefined {
    if (!isRecord(value) || typeof value.required !== 'boolean') return undefined;
    const percentage = value.required ? readPercentage(value.percentage) : undefined;
    const notes = readNote(value.notes);
    return {
        required: value.required,
        ...(percentage === undefined ? {} : { percentage }),
        ...(notes ? { notes } : {})
    };
}

function readEventsDetails(value: unknown): ListingEventsDetailsValue | undefined {
    if (!isRecord(value)) return undefined;
    const maxGuests = readPositiveInt(value.maxGuests);
    const endTime =
        typeof value.endTime === 'string' && HHMM.test(value.endTime) ? value.endTime : undefined;
    const notes = readNote(value.notes);
    const details: ListingEventsDetailsValue = {
        ...(maxGuests === undefined ? {} : { maxGuests }),
        ...(typeof value.amplifiedSound === 'boolean'
            ? { amplifiedSound: value.amplifiedSound }
            : {}),
        ...(endTime ? { endTime } : {}),
        ...(typeof value.extraCost === 'boolean' ? { extraCost: value.extraCost } : {}),
        ...(notes ? { notes } : {})
    };
    return Object.keys(details).length > 0 ? details : undefined;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
        ? (value as T)
        : undefined;
}

/**
 * Whether every locale of a policy note is blank.
 *
 * @param note - The note to inspect.
 * @returns True when the note says nothing in any locale.
 */
export function isEmptyPolicyNote(note: ListingPolicyNote): boolean {
    return note.es.trim() === '' && note.en.trim() === '' && note.pt.trim() === '';
}

/**
 * Reads the raw `policies` payload into {@link ListingPolicyValues}.
 *
 * Lenient per key: a malformed key is dropped, the rest survive. An empty
 * `paymentMethods` array reads as absent (the schema documents that a reader
 * must treat both the same).
 *
 * @param params.raw - The `policies` value from an API payload, of unknown shape.
 * @returns The typed policies; `{}` when nothing is declared.
 */
export function parseListingPolicyValues({ raw }: { readonly raw: unknown }): ListingPolicyValues {
    if (!isRecord(raw)) return {};

    const paymentMethods = Array.isArray(raw.paymentMethods)
        ? LISTING_PAYMENT_METHODS.filter((method) =>
              (raw.paymentMethods as unknown[]).includes(method)
          )
        : [];
    const petsRaw = isRecord(raw.pets) ? raw.pets : null;
    const admission = petsRaw
        ? readEnum(petsRaw.admission, LISTING_PET_ADMISSION_VALUES)
        : undefined;
    const petsNotes = petsRaw ? readNote(petsRaw.notes) : undefined;
    const pets: ListingPetsPolicyValue | undefined = admission
        ? {
              admission,
              ...(typeof petsRaw?.extraCost === 'boolean' ? { extraCost: petsRaw.extraCost } : {}),
              ...(petsNotes ? { notes: petsNotes } : {})
          }
        : undefined;
    const spokenLanguages = Array.isArray(raw.spokenLanguages)
        ? ACCOMMODATION_SPOKEN_LANGUAGES.filter((language) =>
              (raw.spokenLanguages as unknown[]).includes(language)
          )
        : [];
    const eventsAllowed = typeof raw.eventsAllowed === 'boolean' ? raw.eventsAllowed : undefined;
    const cancellation =
        typeof raw.cancellation === 'string' && raw.cancellation.trim() !== ''
            ? raw.cancellation
            : undefined;

    const values: Record<string, unknown> = {
        paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
        pets,
        smokingAllowed: readEnum(raw.smokingAllowed, LISTING_SMOKING_VALUES),
        eventsAllowed,
        // Details of an event that is not allowed are an orphan: never read them.
        eventsDetails: eventsAllowed === true ? readEventsDetails(raw.eventsDetails) : undefined,
        checkIn: readWindow(raw.checkIn),
        checkOut: readWindow(raw.checkOut),
        minNights: readPositiveInt(raw.minNights),
        maxNights: readPositiveInt(raw.maxNights),
        deposit: readDeposit(raw.deposit),
        spokenLanguages: spokenLanguages.length > 0 ? spokenLanguages : undefined,
        privateGroups: typeof raw.privateGroups === 'boolean' ? raw.privateGroups : undefined,
        cancellation,
        reservations: readEnum(raw.reservations, VENUE_RESERVATION_POLICY_VALUES),
        minAge: readPositiveInt(raw.minAge),
        minAgeScope: readMinAgeScope(raw.minAgeScope),
        dressCode: readEnum(raw.dressCode, DRESS_CODES as readonly VenueDressCodeEnum[]),
        dressCodeNote: readNote(raw.dressCodeNote)
    };

    for (const key of Object.keys(values)) {
        if (values[key] === undefined) delete values[key];
    }
    return values as ListingPolicyValues;
}

/**
 * Returns a copy of `policies` with one key set, or removed when `value` is
 * `undefined`.
 *
 * One cross-key rule lives here (HOS-2122): setting `eventsAllowed` to
 * anything but `true` also removes `eventsDetails`, so a panel that owns both
 * sends `eventsDetails: null` in the same PATCH and no orphan details survive.
 *
 * @param params.policies - The current policies.
 * @param params.key - The key to change.
 * @param params.value - The new value; `undefined` removes the key.
 * @returns The updated policies object (never mutates the input).
 */
export function setListingPolicy<K extends ListingPolicyKey>({
    policies,
    key,
    value
}: {
    readonly policies: ListingPolicyValues;
    readonly key: K;
    readonly value: ListingPolicyValues[K] | undefined;
}): ListingPolicyValues {
    const next: Record<string, unknown> = { ...policies };
    if (value === undefined) delete next[key];
    else next[key] = value;
    if (key === 'eventsAllowed' && value !== true) delete next.eventsDetails;
    return next as ListingPolicyValues;
}

/**
 * Builds the `policies` PATCH object for the keys one panel owns.
 *
 * Per key: unchanged → omitted; changed to a value → that value; removed →
 * `null`, which the API's merge reads as "delete this key". Keys outside `keys`
 * are never emitted, whatever the state holds.
 *
 * @param params.current - The edited policies.
 * @param params.baseline - The last persisted policies.
 * @param params.keys - The keys the calling panel owns.
 * @returns The PATCH object, or `null` when none of the owned keys changed.
 */
export function buildListingPoliciesPatch({
    current,
    baseline,
    keys
}: {
    readonly current: ListingPolicyValues;
    readonly baseline: ListingPolicyValues;
    readonly keys: readonly ListingPolicyKey[];
}): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    for (const key of keys) {
        const next = current[key];
        const prev = baseline[key];
        if (JSON.stringify(next ?? null) === JSON.stringify(prev ?? null)) continue;
        patch[key] = next === undefined ? null : next;
    }
    return Object.keys(patch).length > 0 ? patch : null;
}

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/** Spanish fallbacks for the payment-method labels. */
const PAYMENT_METHOD_FALLBACKS: Readonly<Record<ListingPaymentMethod, string>> = {
    cash: 'Efectivo',
    debit: 'Tarjeta de débito',
    credit: 'Tarjeta de crédito',
    transfer: 'Transferencia bancaria',
    mercadopago: 'Mercado Pago'
};

/**
 * Localized label of one payment method.
 *
 * @param params.t - Locale-bound translator.
 * @param params.method - The payment method.
 * @returns The human label.
 */
export function paymentMethodLabel({
    t,
    method
}: {
    readonly t: Translate;
    readonly method: ListingPaymentMethod;
}): string {
    return t(`listing.policies.paymentMethods.${method}`, PAYMENT_METHOD_FALLBACKS[method]);
}

/** Spanish fallbacks for the spoken-language labels (HOS-2120). */
const SPOKEN_LANGUAGE_FALLBACKS: Readonly<Record<AccommodationSpokenLanguage, string>> = {
    es: 'Español',
    en: 'Inglés',
    pt: 'Portugués',
    it: 'Italiano',
    fr: 'Francés',
    de: 'Alemán',
    other: 'Otros idiomas'
};

/**
 * Localized label of one spoken language (HOS-2120).
 *
 * @param params.t - Locale-bound translator.
 * @param params.language - The language code.
 * @returns The human label.
 */
export function spokenLanguageLabel({
    t,
    language
}: {
    readonly t: Translate;
    readonly language: AccommodationSpokenLanguage;
}): string {
    return t(
        `listing.policies.spokenLanguages.language.${language}`,
        SPOKEN_LANGUAGE_FALLBACKS[language]
    );
}

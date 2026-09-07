/**
 * @file lodging-jsonld.ts
 * @description Builds the two `LodgingBusiness` JSON-LD fields that are derived
 * rather than copied: `geo` and `amenityFeature[].name`.
 *
 * Both used to be computed inline in `alojamientos/[slug].astro`, where nothing
 * could unit-test them — and both were silently wrong in production for months
 * (HOS-554, HOS-557). Structured data fails quietly by nature: a missing field
 * raises no error and a machine-readable field holding the wrong string renders
 * nowhere, so the only way either defect surfaces is a test that asserts on the
 * emitted value.
 */

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/** schema.org `GeoCoordinates` payload, as `LodgingBusinessJsonLd` expects it. */
export interface LodgingGeo {
    readonly latitude: number;
    readonly longitude: number;
}

/**
 * The privacy-aware coordinate a public accommodation page is allowed to read.
 * Mirrors `AccommodationDetailData['approximateLocation']`.
 */
export interface ApproximateLocationInput {
    readonly lat: number;
    readonly lng: number;
    readonly radiusMeters: number;
}

/**
 * Builds the JSON-LD `geo` value from the accommodation's obfuscated location.
 *
 * HOS-554: `geo` is derived from `approximateLocation`, NEVER from the exact
 * pin. SPEC-097 strips `location.coordinates` (and street/number/floor/
 * apartment) from every public accommodation read, so on a public page the
 * exact coordinate does not exist — and publishing it would push every host's
 * real address into the most machine-harvestable element on the page.
 * `approximateLocation` is the circle centre the public map already renders, so
 * emitting it discloses nothing new while still giving search engines the
 * locality signal that map results and local relevance depend on.
 *
 * @param input.approximateLocation - The obfuscated coordinate, when present.
 * @returns The `GeoCoordinates` payload, or `undefined` when the accommodation
 *          has no coordinates at all (the API omits the field in that case).
 */
export function buildLodgingGeo({
    approximateLocation
}: {
    readonly approximateLocation?: ApproximateLocationInput | undefined;
}): LodgingGeo | undefined {
    if (!approximateLocation) {
        return undefined;
    }
    const { lat, lng } = approximateLocation;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return undefined;
    }
    return { latitude: lat, longitude: lng };
}

/**
 * Builds the JSON-LD `telephone` value from the accommodation's contact block.
 *
 * HOS-585 P-4: Bing assembles its local pack from NAP — name, address, phone —
 * and the component emitted a complete `PostalAddress` with no phone at all.
 *
 * Publishes nothing new: `AccommodationContactBlock` already renders this exact
 * number as a `tel:` link on the same page. That is the whole reason this is
 * safe while `geo` needed HOS-554's obfuscated coordinate — the phone is
 * already public, the exact pin is deliberately not.
 *
 * Emitted VERBATIM (trimmed). Numbers entered through the editor already carry
 * an international dial code (`composePhoneValue`), and for a legacy value that
 * does not, guessing one would publish a number that dials somewhere else.
 * An unprefixed number is a weaker signal; a wrong number is a defect.
 *
 * @param input.contactInfo - The public contact block, when present.
 * @returns The phone string, or `undefined` when there is nothing to publish.
 */
export function buildLodgingTelephone({
    contactInfo
}: {
    readonly contactInfo?: { readonly phone?: string } | undefined;
}): string | undefined {
    const phone = contactInfo?.phone?.trim();
    return phone ? phone : undefined;
}

/** The amenity shape the detail transform produces (`name` carries the slug). */
export interface LodgingAmenityInput {
    /**
     * SPEC-266 repurposed this field: it holds the catalog SLUG, which doubles
     * as the i18n key `accommodations.amenityNames.<slug>`.
     */
    readonly name: string;
}

/**
 * Builds the localized `amenityFeature[].name` list for the JSON-LD block.
 *
 * HOS-557: the detail page used to publish `amenity.name` directly. Since
 * SPEC-266 dropped the catalog's `name` column, that field carries the raw slug
 * — so schema.org was being served machine ids (`air_conditioning`,
 * `full_kitchen`), in English, on a Spanish site, in the one property whose
 * definition is "the human-readable name". `AmenitiesGrid` had always resolved
 * the slug through i18n before rendering; this simply applies the same
 * resolution to the machine-facing copy.
 *
 * Slugs that resolve to nothing fall back to a humanized key via
 * `translateAmenityName`, so an amenity is never dropped from the list.
 *
 * @param input.amenities - The accommodation's amenities, slug in `name`.
 * @param input.translateAmenityName - The catalog-name resolver, injected so
 *        this stays pure and testable.
 * @param input.t - The page's locale-bound translator.
 * @returns The localized labels, or `undefined` when there are no amenities
 *          (the JSON-LD component omits `amenityFeature` entirely for that).
 */
export function buildLodgingAmenityNames({
    amenities,
    translateAmenityName,
    t
}: {
    readonly amenities: readonly LodgingAmenityInput[];
    readonly translateAmenityName: (params: { t: Translate; name: string }) => string;
    readonly t: Translate;
}): readonly string[] | undefined {
    if (amenities.length === 0) {
        return undefined;
    }
    return amenities.map((amenity) => translateAmenityName({ t, name: amenity.name }));
}

/** The price shape the detail transform produces (`AccommodationDetailData['price']`). */
export interface LodgingPriceInput {
    readonly price: number | null;
    readonly currency: string | null;
}

/**
 * Builds the JSON-LD `priceRange` value from the accommodation's price.
 *
 * HOS-878: schema.org's `priceRange` field is free text and accepts a single
 * formatted value as well as an actual min-max range. This repo only stores a
 * single POINT price per accommodation (`AccommodationDetailData['price']`) —
 * there is no `priceFrom`/`priceTo` in the payload or the table — so this
 * deliberately emits the point price rather than fabricating a range from data
 * that doesn't exist. Two other candidates were considered and rejected by
 * product decision: the `$`/`$$`/`$$$` indicator (it needs price-band
 * thresholds that don't exist in the repo and that inflation would
 * de-calibrate over time) and a real min-max range (the underlying min/max
 * data doesn't exist and modeling it is out of scope for this fix).
 *
 * Formatting: emits `"<currency> <price>"` (e.g. `"ARS 15000"`) rather than
 * `PricingSidebar`'s `Intl.NumberFormat({style:'currency'})` helper, because
 * that helper is locale-dependent (it renders the ARS symbol as `$`, which is
 * ambiguous with USD, and applies locale-specific thousands separators).
 * Structured data is machine-read and locale-independent by convention, so an
 * unambiguous ISO-ish currency code plus the raw number is the correct target
 * here even though it looks plainer than the on-page price.
 *
 * @param input.price - The accommodation's price block, when present.
 * @returns The formatted price string, or `undefined` when there is no price
 *          to publish (`null` or `<= 0`) — the JSON-LD component omits the
 *          `priceRange` key entirely in that case, never emitting `"ARS 0"`
 *          or `"ARS null"`.
 */
export function buildLodgingPriceRange({
    price
}: {
    readonly price?: LodgingPriceInput | null;
}): string | undefined {
    const amount = price?.price;
    if (amount == null || amount <= 0) {
        return undefined;
    }
    const currency = price?.currency ?? 'ARS';
    return `${currency} ${amount}`;
}

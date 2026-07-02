import {
    AccommodationMediaModel,
    AccommodationModel,
    DestinationModel,
    amenities,
    and,
    features,
    isNull,
    rAccommodationAmenity,
    rAccommodationFeature,
    sql
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import type { AccommodationCreateInput, Destination } from '@repo/schemas';
import {
    AccommodationTypeEnum,
    DestinationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { AccommodationService } from '@repo/service-core';
import {
    IMAGE_POOL_BY_TYPE,
    type PooledAccommodationType
} from '../data/accommodation/_image-pool.js';
import { buildAccommodationMediaRows } from '../utils/accommodation-media-builder.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';

/**
 * Narrow spec shape this module needs from a `TestUserSpec` (see
 * `testUsers.seed.ts`). Kept separate to avoid a circular import between the
 * two files.
 */
export interface HostAccommodationSpec {
    readonly email: string;
    readonly displayName: string;
}

/**
 * Fallback CITY destination slug used when resolving where to place a host's
 * seed accommodation. Seeded by the required destination seed
 * (`src/data/destination/011-destination-concepcion-del-uruguay.json`), so it
 * is present on any DB that has run `--required` (the precondition for
 * `--test-users`, per `packages/seed/CLAUDE.md`).
 */
const DEFAULT_DESTINATION_SLUG = 'concepcion-del-uruguay';

/**
 * Fallback coordinates (Concepción del Uruguay) used only when the resolved
 * destination has no `location.coordinates` populated.
 */
const DEFAULT_COORDINATES = { lat: '-32.4833', long: '-58.2283' } as const;

/**
 * Deterministic accommodation type per HOST test user. Chosen from
 * {@link PooledAccommodationType} so every seeded accommodation gets a
 * populated image gallery from `IMAGE_POOL_BY_TYPE`, and so the 5 fixtures
 * are visibly distinct (not byte-identical) in an operator's staging review.
 */
export const ACCOMMODATION_TYPE_BY_EMAIL: Record<string, AccommodationTypeEnum> = {
    'host-basico@local.test': AccommodationTypeEnum.APARTMENT,
    'host-pro@local.test': AccommodationTypeEnum.HOUSE,
    'host-premium@local.test': AccommodationTypeEnum.CABIN,
    'host-pro-plus-addon@local.test': AccommodationTypeEnum.HOTEL,
    'host-trial@local.test': AccommodationTypeEnum.HOSTEL
};

/** Base nightly price (ARS) per accommodation type, used to seed a realistic Tier-3 price block. */
const BASE_PRICE_BY_TYPE: Partial<Record<AccommodationTypeEnum, number>> = {
    [AccommodationTypeEnum.APARTMENT]: 45000,
    [AccommodationTypeEnum.HOUSE]: 85000,
    [AccommodationTypeEnum.CABIN]: 70000,
    [AccommodationTypeEnum.HOTEL]: 95000,
    [AccommodationTypeEnum.HOSTEL]: 25000
};

/**
 * Actor permission set for the seed-owned accommodation lifecycle: create the
 * accommodation, then update it (FAQs go through `_canUpdate`), then edit its
 * amenities/features. Mirrors `preProcessAccommodation` in
 * `src/example/accommodations.seed.ts`.
 */
const HOST_ACCOMMODATION_ACTOR_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCOMMODATION_CREATE,
    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
    PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
    PermissionEnum.ACCOMMODATION_FEATURES_EDIT
];

/** FAQs added to every seeded host accommodation. Generic enough to apply to any accommodation type. */
const HOST_ACCOMMODATION_FAQS: ReadonlyArray<{ question: string; answer: string }> = [
    {
        question: '¿A qué hora es el check-in y el check-out?',
        answer: 'El check-in es a partir de las 14:00 y el check-out hasta las 10:00. Se puede coordinar horarios flexibles con el anfitrión.'
    },
    {
        question: '¿Se aceptan mascotas?',
        answer: 'Sí, se aceptan mascotas pequeñas y medianas avisando con anticipación. Puede aplicar un cargo adicional de limpieza.'
    },
    {
        question: '¿Hay wifi disponible en todo el alojamiento?',
        answer: 'Sí, el alojamiento cuenta con conexión wifi de alta velocidad disponible en todos los ambientes.'
    },
    {
        question: '¿Hay estacionamiento para el vehículo?',
        answer: 'Sí, el alojamiento cuenta con lugar de estacionamiento privado dentro del predio.'
    }
];

/**
 * Resolves the local (before `@`) portion of an email, used to build stable,
 * per-host slugs and identifiers (e.g. `host-pro@local.test` → `host-pro`).
 */
function emailLocalPart(email: string): string {
    return email.split('@')[0] ?? email;
}

/**
 * Builds a rich, Tier-3-equivalent price block (base price + several named
 * `additionalFees` + discounts + one `others[]` custom fee), matching the
 * shape produced by `scripts/apply-pricing-tiers.ts` for a "fully populated"
 * accommodation. Deterministic per `type` — no randomness, since this data
 * only needs to be created once per host.
 *
 * @param type - The accommodation type, used to pick a realistic base price.
 * @returns A price object valid against `AccommodationPriceSchema`.
 */
export function buildHostAccommodationPrice(
    type: AccommodationTypeEnum
): NonNullable<AccommodationCreateInput['price']> {
    const basePrice = BASE_PRICE_BY_TYPE[type] ?? 60000;
    const cleaningFee = Math.round((basePrice * 0.08) / 500) * 500;

    return {
        price: basePrice,
        currency: PriceCurrencyEnum.ARS,
        additionalFees: {
            cleaning: { price: cleaningFee, currency: PriceCurrencyEnum.ARS, isPerStay: true },
            tax: {
                price: 21,
                currency: PriceCurrencyEnum.ARS,
                isPercent: true,
                isPerStay: true
            },
            parking: { price: 1500, currency: PriceCurrencyEnum.ARS, isPerNight: true },
            lateCheckout: {
                price: 3000,
                currency: PriceCurrencyEnum.ARS,
                isPerStay: true,
                isOptional: true
            },
            securityDeposit: {
                price: basePrice,
                currency: PriceCurrencyEnum.ARS,
                isPerStay: true,
                isOptional: false
            },
            others: [
                {
                    name: 'Servicio de asado',
                    price: 4500,
                    currency: PriceCurrencyEnum.ARS,
                    isOptional: true
                }
            ]
        },
        discounts: {
            weekly: { price: 10, currency: PriceCurrencyEnum.ARS, isPercent: true },
            monthly: { price: 20, currency: PriceCurrencyEnum.ARS, isPercent: true },
            others: [
                {
                    name: 'Pago anticipado 30 días',
                    price: 8,
                    currency: PriceCurrencyEnum.ARS,
                    isPercent: true
                }
            ]
        }
    };
}

/**
 * Input for {@link buildHostAccommodationCoreFields}.
 */
export interface BuildHostAccommodationCoreFieldsInput {
    /** The narrow test-user spec (email + displayName). */
    readonly spec: HostAccommodationSpec;
    /** Real DB id of the owning user. */
    readonly ownerId: string;
    /** Real DB id of the CITY destination this accommodation belongs to. */
    readonly destinationId: string;
    /** Approximate coordinates for the `location` block. */
    readonly coordinates: { readonly lat: string; readonly long: string };
}

/**
 * Builds the core (non-relational) fields for a fully-featured host seed
 * accommodation: identity, contact, pricing, location, extra info, and SEO.
 *
 * Deliberately excludes `amenityIds` / `featureIds` / `media` — those are
 * synced separately by {@link ensureHostAccommodation} via direct model
 * inserts (matching the pattern in `src/example/accommodations.seed.ts`,
 * which needs no service transaction).
 *
 * Pure function (no I/O) so it is unit-testable in isolation against
 * `AccommodationCreateInputSchema`.
 *
 * @param input - See {@link BuildHostAccommodationCoreFieldsInput}.
 * @returns A payload valid against `AccommodationCreateInputSchema`.
 *
 * @example
 * ```ts
 * const fields = buildHostAccommodationCoreFields({
 *   spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
 *   ownerId: 'uuid-owner',
 *   destinationId: 'uuid-destination',
 *   coordinates: { lat: '-32.4833', long: '-58.2283' }
 * });
 * ```
 */
export function buildHostAccommodationCoreFields(
    input: BuildHostAccommodationCoreFieldsInput
): AccommodationCreateInput {
    const { spec, ownerId, destinationId, coordinates } = input;
    const slugSuffix = emailLocalPart(spec.email);
    const type = ACCOMMODATION_TYPE_BY_EMAIL[spec.email] ?? AccommodationTypeEnum.APARTMENT;

    const name = `Alojamiento Completo — ${spec.displayName}`;
    const summary = `Alojamiento de prueba (seed) completamente equipado para el test user "${spec.displayName}", con galería completa, todas las amenities y features del catálogo, y una tarifa detallada.`;
    const description = `Alojamiento de prueba (seed) generado automáticamente para el test user "${spec.displayName}" (HOS-30). Este fixture existe para ejercitar las rutas de propietario en /mi-cuenta/propiedades/* (formularios, previews de imagen, galería) durante el crawl de violaciones de CSP en staging.\n\nCuenta con galería fotográfica completa, todas las amenities y features aplicables al rubro alojamiento, una tarifa con cargos adicionales y descuentos, y preguntas frecuentes. No representa una propiedad real ni debe usarse como referencia de contenido productivo.`;

    return {
        slug: `alojamiento-completo-${slugSuffix}`,
        name,
        summary,
        description,
        type,
        ownerId,
        destinationId,
        isFeatured: false,
        contactInfo: {
            personalEmail: `contacto+${slugSuffix}@hospeda-seed.test`,
            mobilePhone: '+5493442100000',
            preferredEmail: PreferredContactEnum.HOME,
            preferredPhone: PreferredContactEnum.MOBILE
        },
        socialNetworks: {
            instagram: `https://instagram.com/${slugSuffix.replace(/-/g, '_')}`,
            facebook: `https://facebook.com/${slugSuffix.replace(/-/g, '.')}`
        },
        price: buildHostAccommodationPrice(type),
        location: {
            coordinates,
            street: 'Av. Seed Test',
            number: '100'
        },
        extraInfo: {
            capacity: 4,
            minNights: 2,
            maxNights: 20,
            bedrooms: 2,
            beds: 3,
            bathrooms: 1,
            smokingAllowed: false,
            extraInfo: [
                'Alojamiento de prueba generado por el seed de test users (HOS-30)',
                'No representa una propiedad real'
            ]
        },
        seo: {
            title: `Alojamiento Completo - ${spec.displayName} (Seed Test)`,
            description: `Propiedad de prueba (seed) para el test user ${spec.displayName}, usada para ejercitar rutas de owner durante el crawl CSP de staging (HOS-30).`,
            keywords: ['seed', 'test', 'hos-30', slugSuffix]
        },
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        visibility: VisibilityEnum.PUBLIC,
        reviewsCount: 0,
        averageRating: 0,
        moderationState: ModerationStatusEnum.APPROVED
    };
}

/**
 * Resolves the CITY destination to use for host seed accommodations.
 *
 * Tries the well-known `concepcion-del-uruguay` slug first (fast path — it is
 * required seed data). Falls back to the first available CITY destination
 * (sorted by slug for determinism) so this does not hard-fail on a DB where
 * that specific city was renamed or removed. Throws a clear, actionable error
 * if no CITY destination exists at all — the required seed must run first.
 *
 * @throws {Error} When no CITY destination exists in the database.
 */
async function resolveHostAccommodationDestination(
    destinationModel: DestinationModel
): Promise<Destination> {
    const bySlug = await destinationModel.findOne({
        slug: DEFAULT_DESTINATION_SLUG,
        destinationType: DestinationTypeEnum.CITY
    });
    if (bySlug) {
        return bySlug;
    }

    const { items } = await destinationModel.findAll(
        { destinationType: DestinationTypeEnum.CITY, deletedAt: null },
        { page: 1, pageSize: 1, sortBy: 'slug', sortOrder: 'asc' }
    );
    const fallback = items[0];
    if (!fallback) {
        throw new Error(
            `No CITY destination found in the database (tried slug "${DEFAULT_DESTINATION_SLUG}" and a generic CITY fallback). Run the required seed (pnpm --filter @repo/seed seed --required) before seedTestUsers.`
        );
    }
    return fallback;
}

/**
 * Fetches every non-deleted amenity/feature catalog id whose
 * `applicableVerticals` includes `'accommodation'` (SPEC-266). Used to attach
 * "every amenity/feature" to a fully-featured host seed accommodation.
 */
async function fetchAccommodationCatalogIds(db: DrizzleClient): Promise<{
    amenityIds: string[];
    featureIds: string[];
}> {
    const [amenityRows, featureRows] = await Promise.all([
        db
            .select({ id: amenities.id })
            .from(amenities)
            .where(
                and(
                    isNull(amenities.deletedAt),
                    sql`'accommodation' = ANY(${amenities.applicableVerticals})`
                )
            ),
        db
            .select({ id: features.id })
            .from(features)
            .where(
                and(
                    isNull(features.deletedAt),
                    sql`'accommodation' = ANY(${features.applicableVerticals})`
                )
            )
    ]);

    return {
        amenityIds: amenityRows.map((row) => row.id),
        featureIds: featureRows.map((row) => row.id)
    };
}

/**
 * Ensures the given HOST test user owns exactly one fully-featured
 * accommodation: every catalog amenity/feature applicable to the
 * `accommodation` vertical, a full image gallery, a rich Tier-3 price block,
 * and a handful of FAQs.
 *
 * Idempotent: if the user already owns at least one non-deleted
 * accommodation, this is a no-op (logs and returns `'skipped'`). Never
 * creates a second accommodation for the same test user on a re-run — this
 * seed re-runs against live staging.
 *
 * @param params - `{ userId, spec, db }` — the owner's real DB id, the
 *   narrow test-user spec, and a Drizzle client for the direct catalog
 *   lookups / junction inserts.
 * @returns `'created'` when a new accommodation was inserted, `'skipped'`
 *   when the user already had one.
 *
 * @throws {Error} When no CITY destination exists, or when
 *   `AccommodationService.create` fails validation/permissions.
 *
 * @example
 * ```ts
 * await ensureHostAccommodation({
 *   userId: 'uuid-host-pro',
 *   spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
 *   db: getDb()
 * });
 * ```
 */
export async function ensureHostAccommodation(params: {
    readonly userId: string;
    readonly spec: HostAccommodationSpec;
    readonly db: DrizzleClient;
}): Promise<'created' | 'skipped'> {
    const { userId, spec, db } = params;

    const accommodationModel = new AccommodationModel();
    const existing = await accommodationModel.findAll(
        { ownerId: userId, deletedAt: null },
        { page: 1, pageSize: 1 }
    );

    if (existing.total > 0) {
        logger.info(
            `${STATUS_ICONS.Skip}    Skipping host accommodation for ${spec.email} — already owns ${existing.total} accommodation(s)`
        );
        return 'skipped';
    }

    const destinationModel = new DestinationModel();
    const destination = await resolveHostAccommodationDestination(destinationModel);
    const coordinates = destination.location?.coordinates ?? DEFAULT_COORDINATES;

    const coreFields = buildHostAccommodationCoreFields({
        spec,
        ownerId: userId,
        destinationId: destination.id,
        coordinates
    });

    const actor: Actor = {
        id: userId,
        role: RoleEnum.SUPER_ADMIN,
        permissions: HOST_ACCOMMODATION_ACTOR_PERMISSIONS
    };

    const service = new AccommodationService({});
    const createResult = await service.create(actor, coreFields);
    if (!createResult.data) {
        throw new Error(
            `Failed to create host accommodation for ${spec.email}: ${createResult.error?.message ?? 'unknown error'}`
        );
    }
    const accommodationId = createResult.data.id;

    // ── Amenities + features: every catalog entry applicable to 'accommodation' ──
    const { amenityIds, featureIds } = await fetchAccommodationCatalogIds(db);

    if (amenityIds.length > 0) {
        await db.insert(rAccommodationAmenity).values(
            amenityIds.map((amenityId) => ({
                accommodationId,
                amenityId,
                isOptional: false
            }))
        );
    }
    if (featureIds.length > 0) {
        await db.insert(rAccommodationFeature).values(
            featureIds.map((featureId) => ({
                accommodationId,
                featureId
            }))
        );
    }

    // ── Media: full curated gallery for the accommodation's type ──
    const pool =
        IMAGE_POOL_BY_TYPE[coreFields.type as PooledAccommodationType] ??
        IMAGE_POOL_BY_TYPE[AccommodationTypeEnum.APARTMENT];
    const [featuredEntry, ...galleryEntries] = pool;
    const mediaRows = featuredEntry
        ? buildAccommodationMediaRows({
              accommodationId,
              media: { featuredImage: featuredEntry, gallery: galleryEntries }
          })
        : [];

    const mediaModel = new AccommodationMediaModel();
    for (const row of mediaRows) {
        await mediaModel.create(row);
    }

    // ── FAQs ──
    for (const faq of HOST_ACCOMMODATION_FAQS) {
        await service.addFaq(actor, { accommodationId, faq });
    }

    logger.success({
        msg: `${STATUS_ICONS.Success}  Created host accommodation "${coreFields.name}" for ${spec.email} (amenities=${amenityIds.length}, features=${featureIds.length}, media=${mediaRows.length}, faqs=${HOST_ACCOMMODATION_FAQS.length})`
    });

    return 'created';
}

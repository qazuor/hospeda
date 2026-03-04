/**
 * Example: Complex Data Seed with Faker.js
 *
 * This example demonstrates advanced seeding scenarios with:
 * - Realistic data generation using Faker.js
 * - Batch insertion for large datasets
 * - Many-to-many relationships (accommodation ↔ amenities, features)
 * - Transaction management with rollback on error
 * - Progress tracking with detailed summaries
 * - Complete accommodation setup with all relations
 *
 * This represents a production-ready seeding strategy for the Hospeda platform,
 * creating a fully populated database with realistic business data.
 *
 * Entities created:
 * - Destinations (with coordinates and images)
 * - Users (with auth provider IDs and profiles)
 * - Accommodations (with pricing and availability)
 * - Amenities (many-to-many with accommodations)
 * - Features (many-to-many with accommodations)
 * - Reviews (with ratings and comments)
 * - Accommodation Images (multiple per accommodation)
 * - Pricing Tiers (season-based pricing)
 *
 * @module examples/complex-data
 * @example
 * ```typescript
 * // Run this example directly
 * tsx packages/seed/docs/examples/complex-data.ts
 *
 * // Or import and use in your seeder
 * import { seedComplexData } from './examples/complex-data';
 * await seedComplexData({
 *   destinationCount: 5,
 *   accommodationsPerDestination: 20,
 *   verbose: true
 * });
 * ```
 */

import { faker } from '@faker-js/faker';
import { db } from '@repo/db';
import {
  destinations,
  users,
  accommodations,
  amenities,
  features,
  accommodationAmenities,
  accommodationFeatures,
  reviews,
  accommodationImages,
  pricingTiers,
} from '@repo/db/schemas';
import { logger } from '@repo/logger';

/**
 * Configuration options for complex data seeding
 */
interface SeedComplexDataOptions {
  /**
   * Number of destinations to create
   * @default 5
   */
  destinationCount?: number;

  /**
   * Number of users to create
   * @default 50
   */
  userCount?: number;

  /**
   * Number of accommodations per destination
   * @default 10
   */
  accommodationsPerDestination?: number;

  /**
   * Number of amenities to create
   * @default 20
   */
  amenityCount?: number;

  /**
   * Number of features to create
   * @default 15
   */
  featureCount?: number;

  /**
   * Number of reviews per accommodation
   * @default 15
   */
  reviewsPerAccommodation?: number;

  /**
   * Number of images per accommodation
   * @default 5
   */
  imagesPerAccommodation?: number;

  /**
   * Enable verbose logging for detailed progress
   * @default false
   */
  verbose?: boolean;

  /**
   * Use transactions for atomic operations
   * @default true
   */
  useTransaction?: boolean;

  /**
   * Batch size for bulk insertions
   * @default 100
   */
  batchSize?: number;
}

/**
 * Result summary from the seeding operation
 */
interface SeedResult {
  destinations: number;
  users: number;
  accommodations: number;
  amenities: number;
  features: number;
  reviews: number;
  images: number;
  pricingTiers: number;
  accommodationAmenities: number;
  accommodationFeatures: number;
  duration: number;
}

/**
 * Maps to track inserted entity IDs
 */
interface IdTracker {
  destinations: string[];
  users: string[];
  accommodations: string[];
  amenities: string[];
  features: string[];
}

/**
 * Configure Faker.js locale and seed for consistent data
 */
faker.locale = 'es';
faker.seed(12345); // Consistent data across runs

/**
 * Generates realistic destination data using Faker.js
 */
function generateDestination(index: number) {
  const cities = [
    'Concepción del Uruguay',
    'Colón',
    'Gualeguaychú',
    'Federación',
    'Paraná',
    'Concordia',
    'Victoria',
    'Gualeguay',
    'La Paz',
    'Diamante',
  ];

  const city = cities[index % cities.length] ?? faker.location.city();
  const slug = faker.helpers.slugify(city).toLowerCase();

  return {
    slug,
    name: city,
    description: faker.lorem.paragraphs(2),
    province: 'Entre Ríos',
    country: 'Argentina',
    // Coordinates for Entre Ríos province area
    latitude: faker.number.float({ min: -34.0, max: -30.0, precision: 0.0001 }),
    longitude: faker.number.float({
      min: -60.0,
      max: -57.0,
      precision: 0.0001,
    }),
    featured: index < 5, // First 5 are featured
    imageUrl: faker.image.urlLoremFlickr({
      category: 'city',
      width: 1200,
      height: 800,
    }),
  };
}

/**
 * Generates realistic user data with auth provider integration
 */
function generateUser(index: number) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet
    .email({ firstName, lastName, provider: 'example.com' })
    .toLowerCase();

  return {
    authProviderId: `user_seed_${String(index).padStart(6, '0')}`,
    email,
    firstName,
    lastName,
    avatarUrl: faker.image.avatar(),
    phoneNumber: faker.phone.number('+54 9 ### ### ####'),
    bio: faker.lorem.sentences(2),
  };
}

/**
 * Generates realistic accommodation data
 */
function generateAccommodation(destinationId: string, index: number) {
  const accommodationTypes = [
    'Casa',
    'Departamento',
    'Cabaña',
    'Villa',
    'Suite',
  ];
  const adjectives = [
    'Moderna',
    'Acogedora',
    'Espaciosa',
    'Luminosa',
    'Elegante',
  ];

  const type =
    accommodationTypes[index % accommodationTypes.length] ?? 'Casa';
  const adjective = adjectives[index % adjectives.length] ?? 'Hermosa';
  const title = `${adjective} ${type}`;
  const slug = `${faker.helpers.slugify(title).toLowerCase()}-${index}`;

  return {
    destinationId,
    slug,
    title,
    description: faker.lorem.paragraphs(3),
    address: faker.location.streetAddress(),
    pricePerNight: faker.number.int({ min: 3000, max: 20000 }),
    maxGuests: faker.number.int({ min: 2, max: 10 }),
    bedrooms: faker.number.int({ min: 1, max: 5 }),
    bathrooms: faker.number.int({ min: 1, max: 3 }),
    featured: faker.datatype.boolean({ probability: 0.2 }), // 20% featured
    verified: faker.datatype.boolean({ probability: 0.8 }), // 80% verified
    instantBook: faker.datatype.boolean({ probability: 0.6 }), // 60% instant book
    minimumNights: faker.number.int({ min: 1, max: 3 }),
    maximumNights: faker.number.int({ min: 30, max: 90 }),
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cancellationPolicy: faker.helpers.arrayElement([
      'flexible',
      'moderate',
      'strict',
    ]),
  };
}

/**
 * Generates amenity data
 */
function generateAmenity(index: number) {
  const amenityNames = [
    'Wi-Fi',
    'Aire Acondicionado',
    'Calefacción',
    'Cocina Equipada',
    'TV por Cable',
    'Netflix',
    'Piscina',
    'Parrilla',
    'Estacionamiento',
    'Lavadora',
    'Secadora',
    'Plancha',
    'Secador de Pelo',
    'Toallas',
    'Ropa de Cama',
    'Productos de Limpieza',
    'Detector de Humo',
    'Botiquín',
    'Extintor',
    'Jacuzzi',
  ];

  const name = amenityNames[index % amenityNames.length] ?? `Amenity ${index}`;
  const slug = faker.helpers.slugify(name).toLowerCase();

  return {
    slug,
    name,
    description: faker.lorem.sentence(),
    icon: faker.helpers.arrayElement([
      'wifi',
      'snowflake',
      'fire',
      'utensils',
      'tv',
      'swimming-pool',
    ]),
  };
}

/**
 * Generates feature data
 */
function generateFeature(index: number) {
  const featureNames = [
    'Pet Friendly',
    'Apto para Familias',
    'Apto para Eventos',
    'Cerca de la Playa',
    'Vista al Río',
    'Vista a la Montaña',
    'Zona Tranquila',
    'Céntrico',
    'Accesible',
    'Eco-Friendly',
    'Seguridad 24hs',
    'Servicio de Limpieza',
    'Check-in Flexible',
    'Long Stay Friendly',
    'Business Friendly',
  ];

  const name = featureNames[index % featureNames.length] ?? `Feature ${index}`;
  const slug = faker.helpers.slugify(name).toLowerCase();

  return {
    slug,
    name,
    description: faker.lorem.sentence(),
  };
}

/**
 * Generates review data with realistic ratings and comments
 */
function generateReview(accommodationId: string, userId: string) {
  const rating = faker.number.int({ min: 3, max: 5 });
  const comments = {
    5: [
      'Excelente lugar, superó todas nuestras expectativas. El host fue muy atento y amable.',
      'Hermoso lugar, muy limpio y ordenado. La ubicación es perfecta. ¡Volveríamos sin dudarlo!',
      'Increíble estadía. Todo impecable, tal cual las fotos. Muy recomendable.',
    ],
    4: [
      'Muy buen lugar, cómodo y bien ubicado. Solo algunos detalles menores por mejorar.',
      'Linda experiencia. El lugar es tal como se describe. Buena atención del host.',
      'Buena relación precio-calidad. Muy satisfechos con la estadía.',
    ],
    3: [
      'Lugar aceptable, cumple con lo básico. Podría mejorar en limpieza.',
      'Está bien para una estadía corta. La ubicación es buena pero faltan algunos detalles.',
      'Correcto. No destaca en nada pero tampoco decepciona.',
    ],
  };

  const commentList = comments[rating as keyof typeof comments] ?? comments[4];
  const comment =
    commentList[faker.number.int({ min: 0, max: commentList.length - 1 })] ??
    'Buena estadía.';

  return {
    accommodationId,
    userId,
    rating,
    comment,
    cleanliness: faker.number.int({ min: rating - 1, max: 5 }),
    accuracy: faker.number.int({ min: rating - 1, max: 5 }),
    communication: faker.number.int({ min: rating - 1, max: 5 }),
    location: faker.number.int({ min: rating - 1, max: 5 }),
    checkIn: faker.number.int({ min: rating - 1, max: 5 }),
    value: faker.number.int({ min: rating - 1, max: 5 }),
  };
}

/**
 * Generates accommodation image data
 */
function generateAccommodationImage(
  accommodationId: string,
  index: number,
  isPrimary: boolean
) {
  return {
    accommodationId,
    url: faker.image.urlLoremFlickr({
      category: 'house',
      width: 1200,
      height: 800,
    }),
    caption: faker.lorem.sentence(),
    displayOrder: index,
    isPrimary,
  };
}

/**
 * Generates pricing tier data for seasonal pricing
 */
function generatePricingTier(accommodationId: string, seasonIndex: number) {
  const seasons = [
    {
      name: 'Temporada Baja',
      multiplier: 1.0,
      startMonth: 3,
      startDay: 1,
      endMonth: 11,
      endDay: 30,
    },
    {
      name: 'Temporada Alta',
      multiplier: 1.5,
      startMonth: 12,
      startDay: 1,
      endMonth: 2,
      endDay: 28,
    },
    {
      name: 'Fin de Semana Largo',
      multiplier: 1.3,
      startMonth: 1,
      startDay: 1,
      endMonth: 12,
      endDay: 31,
    },
  ];

  const season = seasons[seasonIndex % seasons.length];
  if (!season) return null;

  return {
    accommodationId,
    name: season.name,
    description: `Precios para ${season.name.toLowerCase()}`,
    priceMultiplier: season.multiplier,
    startDate: new Date(2024, season.startMonth - 1, season.startDay),
    endDate: new Date(2024, season.endMonth - 1, season.endDay),
    minimumNights: seasonIndex === 1 ? 3 : 1, // High season requires 3 nights minimum
    active: true,
  };
}

/**
 * Batch insert helper function
 */
async function batchInsert<T>(
  table: any,
  data: T[],
  batchSize: number,
  verbose: boolean,
  entityName: string
): Promise<void> {
  const totalBatches = Math.ceil(data.length / batchSize);

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;

    await db.insert(table).values(batch);

    if (verbose && totalBatches > 1) {
      logger.info(
        `  Batch ${currentBatch}/${totalBatches}: Inserted ${batch.length} ${entityName}`
      );
    }
  }
}

/**
 * Seeds the complete database with realistic, complex data.
 *
 * This function demonstrates production-ready seeding strategies including:
 * - Faker.js for realistic data generation
 * - Batch insertion for performance with large datasets
 * - Many-to-many relationship handling
 * - Transaction management for data integrity
 * - Progress tracking and detailed logging
 * - Error recovery and rollback
 *
 * The seeding process follows this order:
 * 1. Core entities (destinations, users, amenities, features)
 * 2. Accommodations (main entities)
 * 3. Many-to-many relations (accommodation ↔ amenities/features)
 * 4. Child entities (reviews, images, pricing tiers)
 *
 * @param options - Configuration options
 * @returns Promise resolving to comprehensive seed results
 * @throws Error if seeding fails
 *
 * @example
 * ```typescript
 * // Small dataset for development
 * await seedComplexData({
 *   destinationCount: 3,
 *   accommodationsPerDestination: 10,
 *   verbose: true
 * });
 *
 * // Large dataset for staging
 * await seedComplexData({
 *   destinationCount: 10,
 *   userCount: 200,
 *   accommodationsPerDestination: 50,
 *   reviewsPerAccommodation: 30,
 *   verbose: true
 * });
 * ```
 */
export async function seedComplexData(
  options: SeedComplexDataOptions = {}
): Promise<SeedResult> {
  const {
    destinationCount = 5,
    userCount = 50,
    accommodationsPerDestination = 10,
    amenityCount = 20,
    featureCount = 15,
    reviewsPerAccommodation = 15,
    imagesPerAccommodation = 5,
    verbose = false,
    useTransaction = true,
    batchSize = 100,
  } = options;

  const startTime = Date.now();

  logger.info('🚀 Starting complex data seed with Faker.js', {
    destinations: destinationCount,
    users: userCount,
    accommodations: destinationCount * accommodationsPerDestination,
    amenities: amenityCount,
    features: featureCount,
    useTransaction,
    batchSize,
  });

  const tracker: IdTracker = {
    destinations: [],
    users: [],
    accommodations: [],
    amenities: [],
    features: [],
  };

  const counters = {
    reviews: 0,
    images: 0,
    pricingTiers: 0,
    accommodationAmenities: 0,
    accommodationFeatures: 0,
  };

  try {
    const seedOperation = async () => {
      // === STEP 1: Seed Destinations ===
      if (verbose) logger.info('Step 1: Seeding destinations...');

      const destinationsData = Array.from({ length: destinationCount }, (_, i) =>
        generateDestination(i)
      );

      const insertedDestinations = await db
        .insert(destinations)
        .values(destinationsData)
        .returning({ id: destinations.id });

      tracker.destinations = insertedDestinations.map((d) => d.id);

      if (verbose) {
        logger.info(`✓ Created ${tracker.destinations.length} destinations`);
      }

      // === STEP 2: Seed Users ===
      if (verbose) logger.info('Step 2: Seeding users...');

      const usersData = Array.from({ length: userCount }, (_, i) =>
        generateUser(i)
      );

      await batchInsert(users, usersData, batchSize, verbose, 'users');

      const insertedUsers = await db
        .select({ id: users.id })
        .from(users)
        .limit(userCount);

      tracker.users = insertedUsers.map((u) => u.id);

      if (verbose) logger.info(`✓ Created ${tracker.users.length} users`);

      // === STEP 3: Seed Amenities ===
      if (verbose) logger.info('Step 3: Seeding amenities...');

      const amenitiesData = Array.from({ length: amenityCount }, (_, i) =>
        generateAmenity(i)
      );

      const insertedAmenities = await db
        .insert(amenities)
        .values(amenitiesData)
        .returning({ id: amenities.id });

      tracker.amenities = insertedAmenities.map((a) => a.id);

      if (verbose) {
        logger.info(`✓ Created ${tracker.amenities.length} amenities`);
      }

      // === STEP 4: Seed Features ===
      if (verbose) logger.info('Step 4: Seeding features...');

      const featuresData = Array.from({ length: featureCount }, (_, i) =>
        generateFeature(i)
      );

      const insertedFeatures = await db
        .insert(features)
        .values(featuresData)
        .returning({ id: features.id });

      tracker.features = insertedFeatures.map((f) => f.id);

      if (verbose) logger.info(`✓ Created ${tracker.features.length} features`);

      // === STEP 5: Seed Accommodations ===
      if (verbose) {
        logger.info(
          `Step 5: Seeding accommodations (${accommodationsPerDestination} per destination)...`
        );
      }

      for (const destinationId of tracker.destinations) {
        const accommodationsData = Array.from(
          { length: accommodationsPerDestination },
          (_, i) => generateAccommodation(destinationId, i)
        );

        const insertedAccommodations = await db
          .insert(accommodations)
          .values(accommodationsData)
          .returning({ id: accommodations.id });

        tracker.accommodations.push(
          ...insertedAccommodations.map((a) => a.id)
        );
      }

      if (verbose) {
        logger.info(
          `✓ Created ${tracker.accommodations.length} accommodations`
        );
      }

      // === STEP 6: Link Accommodations to Amenities (M2M) ===
      if (verbose) {
        logger.info('Step 6: Linking accommodations to amenities...');
      }

      const accommodationAmenitiesData: Array<{
        accommodationId: string;
        amenityId: string;
      }> = [];

      for (const accommodationId of tracker.accommodations) {
        // Each accommodation gets 5-10 random amenities
        const amenityCount = faker.number.int({ min: 5, max: 10 });
        const selectedAmenities = faker.helpers.arrayElements(
          tracker.amenities,
          amenityCount
        );

        for (const amenityId of selectedAmenities) {
          accommodationAmenitiesData.push({ accommodationId, amenityId });
        }
      }

      await batchInsert(
        accommodationAmenities,
        accommodationAmenitiesData,
        batchSize,
        verbose,
        'accommodation-amenity links'
      );

      counters.accommodationAmenities = accommodationAmenitiesData.length;

      if (verbose) {
        logger.info(
          `✓ Created ${counters.accommodationAmenities} accommodation-amenity links`
        );
      }

      // === STEP 7: Link Accommodations to Features (M2M) ===
      if (verbose) {
        logger.info('Step 7: Linking accommodations to features...');
      }

      const accommodationFeaturesData: Array<{
        accommodationId: string;
        featureId: string;
      }> = [];

      for (const accommodationId of tracker.accommodations) {
        // Each accommodation gets 3-7 random features
        const featureCount = faker.number.int({ min: 3, max: 7 });
        const selectedFeatures = faker.helpers.arrayElements(
          tracker.features,
          featureCount
        );

        for (const featureId of selectedFeatures) {
          accommodationFeaturesData.push({ accommodationId, featureId });
        }
      }

      await batchInsert(
        accommodationFeatures,
        accommodationFeaturesData,
        batchSize,
        verbose,
        'accommodation-feature links'
      );

      counters.accommodationFeatures = accommodationFeaturesData.length;

      if (verbose) {
        logger.info(
          `✓ Created ${counters.accommodationFeatures} accommodation-feature links`
        );
      }

      // === STEP 8: Seed Reviews ===
      if (verbose) {
        logger.info(
          `Step 8: Seeding reviews (${reviewsPerAccommodation} per accommodation)...`
        );
      }

      const reviewsData: Array<ReturnType<typeof generateReview>> = [];

      for (const accommodationId of tracker.accommodations) {
        const reviewCount = faker.number.int({
          min: Math.floor(reviewsPerAccommodation * 0.7),
          max: reviewsPerAccommodation,
        });

        for (let i = 0; i < reviewCount; i++) {
          const userId =
            faker.helpers.arrayElement(tracker.users) ?? tracker.users[0];
          if (userId) {
            reviewsData.push(generateReview(accommodationId, userId));
          }
        }
      }

      await batchInsert(reviews, reviewsData, batchSize, verbose, 'reviews');

      counters.reviews = reviewsData.length;

      if (verbose) logger.info(`✓ Created ${counters.reviews} reviews`);

      // === STEP 9: Seed Accommodation Images ===
      if (verbose) {
        logger.info(
          `Step 9: Seeding images (${imagesPerAccommodation} per accommodation)...`
        );
      }

      const imagesData: Array<
        ReturnType<typeof generateAccommodationImage>
      > = [];

      for (const accommodationId of tracker.accommodations) {
        for (let i = 0; i < imagesPerAccommodation; i++) {
          imagesData.push(
            generateAccommodationImage(accommodationId, i, i === 0)
          );
        }
      }

      await batchInsert(
        accommodationImages,
        imagesData,
        batchSize,
        verbose,
        'images'
      );

      counters.images = imagesData.length;

      if (verbose) logger.info(`✓ Created ${counters.images} images`);

      // === STEP 10: Seed Pricing Tiers ===
      if (verbose) logger.info('Step 10: Seeding pricing tiers...');

      const pricingTiersData: Array<
        ReturnType<typeof generatePricingTier>
      > = [];

      for (const accommodationId of tracker.accommodations) {
        // Create 2-3 pricing tiers per accommodation
        for (let i = 0; i < 3; i++) {
          const tier = generatePricingTier(accommodationId, i);
          if (tier) pricingTiersData.push(tier);
        }
      }

      await batchInsert(
        pricingTiers,
        pricingTiersData,
        batchSize,
        verbose,
        'pricing tiers'
      );

      counters.pricingTiers = pricingTiersData.length;

      if (verbose) {
        logger.info(`✓ Created ${counters.pricingTiers} pricing tiers`);
      }
    };

    // Execute with or without transaction
    if (useTransaction) {
      await db.transaction(async () => {
        await seedOperation();
      });
    } else {
      await seedOperation();
    }

    const duration = Date.now() - startTime;

    const result: SeedResult = {
      destinations: tracker.destinations.length,
      users: tracker.users.length,
      accommodations: tracker.accommodations.length,
      amenities: tracker.amenities.length,
      features: tracker.features.length,
      reviews: counters.reviews,
      images: counters.images,
      pricingTiers: counters.pricingTiers,
      accommodationAmenities: counters.accommodationAmenities,
      accommodationFeatures: counters.accommodationFeatures,
      duration,
    };

    // Log comprehensive summary
    logger.info('✓ Complex data seed completed', {
      ...result,
      duration: `${result.duration}ms`,
    });

    return result;
  } catch (error) {
    logger.error('Failed to seed complex data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      progress: {
        destinations: tracker.destinations.length,
        users: tracker.users.length,
        accommodations: tracker.accommodations.length,
        amenities: tracker.amenities.length,
        features: tracker.features.length,
      },
    });
    throw error;
  }
}

/**
 * Main execution function demonstrating complex data seeding.
 *
 * @example
 * ```bash
 * # Run directly with tsx
 * tsx packages/seed/docs/examples/complex-data.ts
 * ```
 */
async function main(): Promise<void> {
  logger.info('=== Complex Data Seed Example ===');
  logger.info('This example demonstrates production-ready seeding with Faker.js');
  logger.info('Creating complete accommodation ecosystem with all relations');
  logger.info('');

  try {
    const result = await seedComplexData({
      destinationCount: 5,
      userCount: 50,
      accommodationsPerDestination: 10,
      amenityCount: 20,
      featureCount: 15,
      reviewsPerAccommodation: 15,
      imagesPerAccommodation: 5,
      verbose: true,
      useTransaction: true,
      batchSize: 100,
    });

    // Display comprehensive summary
    logger.info('');
    logger.info('=== Detailed Seed Summary ===');
    logger.info('');
    logger.info('Core Entities:');
    logger.info(`  🏙️  Destinations: ${result.destinations}`);
    logger.info(`  👥 Users: ${result.users}`);
    logger.info(`  🏠 Accommodations: ${result.accommodations}`);
    logger.info(`  ✨ Amenities: ${result.amenities}`);
    logger.info(`  🎯 Features: ${result.features}`);
    logger.info('');
    logger.info('Relations:');
    logger.info(
      `  🔗 Accommodation-Amenity Links: ${result.accommodationAmenities}`
    );
    logger.info(
      `  🔗 Accommodation-Feature Links: ${result.accommodationFeatures}`
    );
    logger.info('');
    logger.info('Additional Data:');
    logger.info(`  ⭐ Reviews: ${result.reviews}`);
    logger.info(`  📷 Images: ${result.images}`);
    logger.info(`  💰 Pricing Tiers: ${result.pricingTiers}`);
    logger.info('');
    logger.info(`⏱ Total Duration: ${result.duration}ms`);
    logger.info('');

    const totalRecords =
      result.destinations +
      result.users +
      result.accommodations +
      result.amenities +
      result.features +
      result.reviews +
      result.images +
      result.pricingTiers +
      result.accommodationAmenities +
      result.accommodationFeatures;

    logger.info(
      `✅ Successfully created ${totalRecords} total database records!`
    );
  } catch (error) {
    logger.error('Seed failed', error);
    process.exit(1);
  }
}

/**
 * Run the main function if this file is executed directly.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

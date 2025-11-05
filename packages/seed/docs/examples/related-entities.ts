/**
 * Example: Related Entities Seed
 *
 * This example demonstrates seeding multiple related entities with foreign key relationships.
 * It shows the complete workflow for creating a chain of related data:
 * Destination → Accommodation → Review
 *
 * Key concepts demonstrated:
 * - Foreign key management and dependency order
 * - Using idMapper to track inserted IDs
 * - Proper seed execution sequence
 * - Transaction management for data integrity
 * - Error handling with rollback
 * - Progress tracking and logging
 *
 * This example represents a realistic Hospeda seeding scenario where you need
 * to populate destinations, their accommodations, and reviews for those accommodations.
 *
 * @module examples/related-entities
 * @example
 * ```typescript
 * // Run this example directly
 * tsx packages/seed/docs/examples/related-entities.ts
 *
 * // Or import and use in your seeder
 * import { seedRelatedEntities } from './examples/related-entities';
 * await seedRelatedEntities({ destinationCount: 5, verbose: true });
 * ```
 */

import { db } from '@repo/db';
import { destinations, accommodations, reviews, users } from '@repo/db/schemas';
import { logger } from '@repo/logger';

/**
 * Options for configuring the related entities seeding process
 */
interface SeedRelatedEntitiesOptions {
  /**
   * Number of destinations to create
   * @default 3
   */
  destinationCount?: number;

  /**
   * Number of accommodations per destination
   * @default 5
   */
  accommodationsPerDestination?: number;

  /**
   * Number of reviews per accommodation
   * @default 10
   */
  reviewsPerAccommodation?: number;

  /**
   * Enable verbose logging for detailed progress information
   * @default false
   */
  verbose?: boolean;

  /**
   * Use transactions for atomic operations
   * @default true
   */
  useTransaction?: boolean;
}

/**
 * Represents a user account in the system
 */
interface UserData {
  /**
   * External user ID from Clerk authentication
   */
  clerkId: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * User's first name
   */
  firstName: string;

  /**
   * User's last name
   */
  lastName: string;
}

/**
 * Represents a tourism destination
 */
interface DestinationData {
  slug: string;
  name: string;
  description: string;
  province: string;
  country: string;
  latitude: number;
  longitude: number;
  featured: boolean;
  imageUrl: string | null;
}

/**
 * Represents an accommodation property
 */
interface AccommodationData {
  /**
   * Reference to the destination where this accommodation is located
   */
  destinationId: string;

  slug: string;
  title: string;
  description: string;
  address: string;
  pricePerNight: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  featured: boolean;
  imageUrl: string;
}

/**
 * Represents a review for an accommodation
 */
interface ReviewData {
  /**
   * Reference to the accommodation being reviewed
   */
  accommodationId: string;

  /**
   * Reference to the user who wrote the review
   */
  userId: string;

  rating: number;
  comment: string;
}

/**
 * Tracks the result of seeding operations
 */
interface SeedResult {
  destinations: number;
  accommodations: number;
  reviews: number;
  users: number;
  duration: number;
}

/**
 * Maps entity types to their inserted IDs for relationship tracking
 */
interface IdMapper {
  destinations: string[];
  accommodations: string[];
  users: string[];
}

/**
 * Sample user data for seeding.
 * In production, users would come from Clerk authentication.
 */
const SAMPLE_USERS: ReadonlyArray<UserData> = [
  {
    clerkId: 'user_seed_001',
    email: 'maria.garcia@example.com',
    firstName: 'María',
    lastName: 'García',
  },
  {
    clerkId: 'user_seed_002',
    email: 'juan.martinez@example.com',
    firstName: 'Juan',
    lastName: 'Martínez',
  },
  {
    clerkId: 'user_seed_003',
    email: 'ana.rodriguez@example.com',
    firstName: 'Ana',
    lastName: 'Rodríguez',
  },
  {
    clerkId: 'user_seed_004',
    email: 'carlos.lopez@example.com',
    firstName: 'Carlos',
    lastName: 'López',
  },
  {
    clerkId: 'user_seed_005',
    email: 'lucia.fernandez@example.com',
    firstName: 'Lucía',
    lastName: 'Fernández',
  },
] as const;

/**
 * Sample destinations in Entre Ríos for demonstration
 */
const SAMPLE_DESTINATIONS: ReadonlyArray<DestinationData> = [
  {
    slug: 'concepcion-del-uruguay',
    name: 'Concepción del Uruguay',
    description:
      'Capital histórica de Entre Ríos, conocida por su arquitectura colonial y el Palacio San José.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.4833,
    longitude: -58.2333,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1580837119756-563d608dd119',
  },
  {
    slug: 'colon',
    name: 'Colón',
    description:
      'Ciudad termal famosa por sus aguas termales y el Parque Nacional El Palmar.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.2167,
    longitude: -58.1333,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
  },
  {
    slug: 'federacion',
    name: 'Federación',
    description:
      'Ciudad sobre el lago de la represa de Salto Grande, famosa por sus termas y playas.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -30.9667,
    longitude: -57.8833,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19',
  },
] as const;

/**
 * Generates sample accommodation data for a given destination.
 *
 * @param destinationId - The destination where accommodations will be located
 * @param destinationSlug - The destination slug for generating unique accommodation slugs
 * @param count - Number of accommodations to generate
 * @returns Array of accommodation data objects
 */
function generateAccommodations(
  destinationId: string,
  destinationSlug: string,
  count: number
): AccommodationData[] {
  const accommodationTypes = [
    'Casa',
    'Departamento',
    'Cabaña',
    'Hotel',
    'Hostel',
  ];
  const features = [
    'con piscina',
    'con vista al río',
    'céntrico',
    'con jardín',
    'moderno',
  ];

  return Array.from({ length: count }, (_, index) => {
    const type =
      accommodationTypes[index % accommodationTypes.length] ?? 'Casa';
    const feature = features[index % features.length] ?? 'moderno';
    const title = `${type} ${feature} ${index + 1}`;

    return {
      destinationId,
      slug: `${destinationSlug}-${type.toLowerCase()}-${index + 1}`,
      title,
      description: `Hermoso ${type.toLowerCase()} ${feature} ideal para vacaciones en familia. Cuenta con todas las comodidades necesarias para una estadía confortable.`,
      address: `Calle Principal ${100 + index}, ${destinationSlug}`,
      pricePerNight: 5000 + index * 1000,
      maxGuests: 2 + (index % 4),
      bedrooms: 1 + (index % 3),
      bathrooms: 1 + (index % 2),
      featured: index % 3 === 0,
      imageUrl: `https://images.unsplash.com/photo-${1560184000000 + index}`,
    };
  });
}

/**
 * Generates sample review data for a given accommodation.
 *
 * @param accommodationId - The accommodation being reviewed
 * @param userIds - Array of available user IDs to assign as review authors
 * @param count - Number of reviews to generate
 * @returns Array of review data objects
 */
function generateReviews(
  accommodationId: string,
  userIds: string[],
  count: number
): ReviewData[] {
  const comments = [
    'Excelente estadía, el lugar es hermoso y muy cómodo. Totalmente recomendable.',
    'Muy buena atención y limpieza impecable. Volveríamos sin dudarlo.',
    'Lugar tranquilo y bien ubicado. Perfecto para descansar.',
    'Superó nuestras expectativas. Las fotos no le hacen justicia.',
    'Buena relación precio-calidad. El host muy atento y amable.',
    'Espectacular vista y excelentes instalaciones. Lo recomendamos ampliamente.',
    'Muy cómodo y acogedor. Ideal para ir en familia.',
    'Todo impecable, tal cual las fotos. Muy satisfechos con la estadía.',
    'Excelente lugar para relajarse. Muy buena ubicación.',
    'Hermoso lugar, limpio y ordenado. El host muy amable y servicial.',
  ];

  return Array.from({ length: count }, (_, index) => ({
    accommodationId,
    userId: userIds[index % userIds.length] ?? userIds[0] ?? '',
    rating: 3 + (index % 3), // Ratings from 3 to 5
    comment: comments[index % comments.length] ?? comments[0] ?? '',
  }));
}

/**
 * Seeds users required for creating reviews.
 * Users are the foundation of the review system.
 *
 * @param verbose - Enable detailed logging
 * @returns Array of inserted user IDs
 */
async function seedUsers(verbose: boolean): Promise<string[]> {
  if (verbose) {
    logger.info('Step 1: Seeding users...');
  }

  const insertedUsers = await db
    .insert(users)
    .values(SAMPLE_USERS)
    .returning({ id: users.id });

  const userIds = insertedUsers.map((u) => u.id);

  if (verbose) {
    logger.info(`✓ Created ${userIds.length} users`);
  }

  return userIds;
}

/**
 * Seeds destinations based on the requested count.
 *
 * @param count - Number of destinations to create
 * @param verbose - Enable detailed logging
 * @returns Array of inserted destination IDs
 */
async function seedDestinations(
  count: number,
  verbose: boolean
): Promise<string[]> {
  if (verbose) {
    logger.info(`Step 2: Seeding ${count} destinations...`);
  }

  const destinationsToInsert = SAMPLE_DESTINATIONS.slice(0, count);

  const insertedDestinations = await db
    .insert(destinations)
    .values(destinationsToInsert)
    .returning({ id: destinations.id });

  const destinationIds = insertedDestinations.map((d) => d.id);

  if (verbose) {
    logger.info(`✓ Created ${destinationIds.length} destinations`);
  }

  return destinationIds;
}

/**
 * Seeds accommodations for each destination.
 * Creates the specified number of accommodations per destination,
 * properly linking them via foreign keys.
 *
 * @param destinationIds - IDs of destinations to create accommodations for
 * @param perDestination - Number of accommodations per destination
 * @param verbose - Enable detailed logging
 * @returns Array of inserted accommodation IDs
 */
async function seedAccommodations(
  destinationIds: string[],
  perDestination: number,
  verbose: boolean
): Promise<string[]> {
  if (verbose) {
    logger.info(
      `Step 3: Seeding ${perDestination} accommodations per destination...`
    );
  }

  const allAccommodationIds: string[] = [];

  for (const [index, destinationId] of destinationIds.entries()) {
    const destinationSlug = SAMPLE_DESTINATIONS[index]?.slug ?? 'destination';

    const accommodationsData = generateAccommodations(
      destinationId,
      destinationSlug,
      perDestination
    );

    const insertedAccommodations = await db
      .insert(accommodations)
      .values(accommodationsData)
      .returning({ id: accommodations.id });

    const accommodationIds = insertedAccommodations.map((a) => a.id);
    allAccommodationIds.push(...accommodationIds);

    if (verbose) {
      logger.info(
        `✓ Created ${accommodationIds.length} accommodations for ${SAMPLE_DESTINATIONS[index]?.name}`
      );
    }
  }

  if (verbose) {
    logger.info(`✓ Total accommodations created: ${allAccommodationIds.length}`);
  }

  return allAccommodationIds;
}

/**
 * Seeds reviews for each accommodation.
 * Creates the specified number of reviews per accommodation,
 * distributing them among the available users.
 *
 * @param accommodationIds - IDs of accommodations to create reviews for
 * @param userIds - IDs of users who can author reviews
 * @param perAccommodation - Number of reviews per accommodation
 * @param verbose - Enable detailed logging
 * @returns Total number of reviews created
 */
async function seedReviews(
  accommodationIds: string[],
  userIds: string[],
  perAccommodation: number,
  verbose: boolean
): Promise<number> {
  if (verbose) {
    logger.info(
      `Step 4: Seeding ${perAccommodation} reviews per accommodation...`
    );
  }

  let totalReviews = 0;

  for (const accommodationId of accommodationIds) {
    const reviewsData = generateReviews(
      accommodationId,
      userIds,
      perAccommodation
    );

    await db.insert(reviews).values(reviewsData);

    totalReviews += reviewsData.length;
  }

  if (verbose) {
    logger.info(`✓ Total reviews created: ${totalReviews}`);
  }

  return totalReviews;
}

/**
 * Seeds related entities (destinations, accommodations, and reviews) in the correct order.
 *
 * This function demonstrates the complete workflow for seeding related data:
 * 1. Seed users (required for reviews)
 * 2. Seed destinations (parent entities)
 * 3. Seed accommodations (children of destinations)
 * 4. Seed reviews (children of accommodations, reference users)
 *
 * The function uses an idMapper to track inserted IDs and maintain relationships.
 * All operations can be wrapped in a transaction for atomicity.
 *
 * @param options - Configuration options for the seeding process
 * @returns Promise resolving to the seeding operation result
 * @throws Error if any seeding operation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * await seedRelatedEntities();
 *
 * // With custom counts
 * await seedRelatedEntities({
 *   destinationCount: 5,
 *   accommodationsPerDestination: 10,
 *   reviewsPerAccommodation: 15,
 *   verbose: true
 * });
 *
 * // Without transactions (not recommended)
 * await seedRelatedEntities({ useTransaction: false });
 * ```
 */
export async function seedRelatedEntities(
  options: SeedRelatedEntitiesOptions = {}
): Promise<SeedResult> {
  const {
    destinationCount = 3,
    accommodationsPerDestination = 5,
    reviewsPerAccommodation = 10,
    verbose = false,
    useTransaction = true,
  } = options;

  const startTime = Date.now();

  logger.info('🔗 Starting related entities seed', {
    destinations: destinationCount,
    accommodationsPerDestination,
    reviewsPerAccommodation,
    useTransaction,
  });

  try {
    let result: SeedResult;

    if (useTransaction) {
      // Use transaction for atomic operations
      result = await db.transaction(async (tx) => {
        // Temporarily replace db with tx for transaction context
        const originalDb = global.db;
        // @ts-expect-error - Temporarily replacing db for transaction
        global.db = tx;

        try {
          // Step 1: Seed users
          const userIds = await seedUsers(verbose);

          // Step 2: Seed destinations
          const destinationIds = await seedDestinations(
            destinationCount,
            verbose
          );

          // Step 3: Seed accommodations
          const accommodationIds = await seedAccommodations(
            destinationIds,
            accommodationsPerDestination,
            verbose
          );

          // Step 4: Seed reviews
          const reviewCount = await seedReviews(
            accommodationIds,
            userIds,
            reviewsPerAccommodation,
            verbose
          );

          return {
            destinations: destinationIds.length,
            accommodations: accommodationIds.length,
            reviews: reviewCount,
            users: userIds.length,
            duration: Date.now() - startTime,
          };
        } finally {
          // Restore original db
          // @ts-expect-error - Restoring db after transaction
          global.db = originalDb;
        }
      });
    } else {
      // Execute without transaction
      const userIds = await seedUsers(verbose);
      const destinationIds = await seedDestinations(destinationCount, verbose);
      const accommodationIds = await seedAccommodations(
        destinationIds,
        accommodationsPerDestination,
        verbose
      );
      const reviewCount = await seedReviews(
        accommodationIds,
        userIds,
        reviewsPerAccommodation,
        verbose
      );

      result = {
        destinations: destinationIds.length,
        accommodations: accommodationIds.length,
        reviews: reviewCount,
        users: userIds.length,
        duration: Date.now() - startTime,
      };
    }

    // Log final summary
    logger.info('✓ Related entities seed completed', {
      users: result.users,
      destinations: result.destinations,
      accommodations: result.accommodations,
      reviews: result.reviews,
      duration: `${result.duration}ms`,
    });

    return result;
  } catch (error) {
    logger.error('Failed to seed related entities', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Main execution function demonstrating the related entities seeding workflow.
 *
 * @example
 * ```bash
 * # Run directly with tsx
 * tsx packages/seed/docs/examples/related-entities.ts
 * ```
 */
async function main(): Promise<void> {
  logger.info('=== Related Entities Seed Example ===');
  logger.info('This example demonstrates seeding with foreign key relationships');
  logger.info('Order: Users → Destinations → Accommodations → Reviews');
  logger.info('');

  try {
    const result = await seedRelatedEntities({
      destinationCount: 3,
      accommodationsPerDestination: 5,
      reviewsPerAccommodation: 10,
      verbose: true,
      useTransaction: true,
    });

    // Display detailed summary
    logger.info('');
    logger.info('=== Seed Summary ===');
    logger.info(`👥 Users: ${result.users}`);
    logger.info(`🏙️  Destinations: ${result.destinations}`);
    logger.info(`🏠 Accommodations: ${result.accommodations}`);
    logger.info(`⭐ Reviews: ${result.reviews}`);
    logger.info(`⏱ Duration: ${result.duration}ms`);
    logger.info('');
    logger.info(
      `✅ Successfully created ${result.destinations + result.accommodations + result.reviews} total records!`
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

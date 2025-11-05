/**
 * Example: Basic Seed
 *
 * This example demonstrates a simple seeder for a single entity (Destination).
 * It shows the fundamental concepts of database seeding including:
 * - Database connection and table insertion
 * - Data structure preparation
 * - Progress logging with @repo/logger
 * - Basic error handling
 * - Exporting and running seeder functions
 *
 * This is the starting point for understanding the seeding system in Hospeda.
 *
 * @module examples/basic-seed
 * @example
 * ```typescript
 * // Run this example directly
 * tsx packages/seed/docs/examples/basic-seed.ts
 *
 * // Or import and use in your seeder
 * import { seedDestinations } from './examples/basic-seed';
 * await seedDestinations({ verbose: true });
 * ```
 */

import { db } from '@repo/db';
import { destinations } from '@repo/db/schemas';
import { logger } from '@repo/logger';

/**
 * Options for configuring the destination seeding process
 */
interface SeedDestinationsOptions {
  /**
   * Enable verbose logging for detailed progress information
   * @default false
   */
  verbose?: boolean;

  /**
   * Only insert a specific number of destinations (for testing)
   * @default undefined - insert all destinations
   */
  limit?: number;

  /**
   * Skip destinations that already exist (by slug)
   * @default false
   */
  skipExisting?: boolean;
}

/**
 * Represents a destination in Entre Ríos province for tourism
 */
interface DestinationData {
  /**
   * Unique slug identifier (URL-friendly)
   * @example 'concepcion-del-uruguay'
   */
  slug: string;

  /**
   * Display name of the destination
   * @example 'Concepción del Uruguay'
   */
  name: string;

  /**
   * Brief description of the destination
   */
  description: string;

  /**
   * Province where the destination is located
   * @example 'Entre Ríos'
   */
  province: string;

  /**
   * Country where the destination is located
   * @example 'Argentina'
   */
  country: string;

  /**
   * Latitude coordinate for map display
   * @example -32.4833
   */
  latitude: number;

  /**
   * Longitude coordinate for map display
   * @example -58.2333
   */
  longitude: number;

  /**
   * Indicates if this destination should be featured on the homepage
   * @default false
   */
  featured: boolean;

  /**
   * URL to the destination's cover/hero image
   * @example 'https://example.com/images/concepcion.jpg'
   */
  imageUrl: string | null;
}

/**
 * Result of the seeding operation
 */
interface SeedResult {
  /**
   * Number of destinations successfully inserted
   */
  inserted: number;

  /**
   * Number of destinations that were skipped (if skipExisting is enabled)
   */
  skipped: number;

  /**
   * Total time taken for the operation in milliseconds
   */
  duration: number;
}

/**
 * Comprehensive list of destinations in Entre Ríos province.
 * This data represents the main tourism destinations that will be available
 * in the Hospeda platform for the Litoral region of Argentina.
 */
const DESTINATIONS_DATA: ReadonlyArray<DestinationData> = [
  {
    slug: 'concepcion-del-uruguay',
    name: 'Concepción del Uruguay',
    description:
      'Capital histórica de Entre Ríos, conocida por su arquitectura colonial, el Palacio San José y sus playas sobre el río Uruguay. Centro cultural y turístico de la región.',
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
      'Ciudad termal famosa por sus aguas termales, el Parque Nacional El Palmar y sus playas sobre el río Uruguay. Destino ideal para descanso y turismo de salud.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.2167,
    longitude: -58.1333,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
  },
  {
    slug: 'gualeguaychu',
    name: 'Gualeguaychú',
    description:
      'Ciudad del carnaval más importante de Argentina, con el Corsódromo y sus playas sobre el río Gualeguaychú. Centro de turismo cultural y entretenimiento.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -33.0097,
    longitude: -58.5172,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1533669955142-6a73332af4db',
  },
  {
    slug: 'federacion',
    name: 'Federación',
    description:
      'Ciudad sobre el lago de la represa de Salto Grande, famosa por sus termas, playas de arena y deportes náuticos. Destino turístico en constante crecimiento.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -30.9667,
    longitude: -57.8833,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19',
  },
  {
    slug: 'parana',
    name: 'Paraná',
    description:
      'Capital de Entre Ríos, centro administrativo y cultural de la provincia. Ciudad con hermoso costanera sobre el río Paraná y rica historia federal.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -31.7333,
    longitude: -60.5289,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1601924357840-3c6c7e1b9e99',
  },
  {
    slug: 'concordia',
    name: 'Concordia',
    description:
      'Segunda ciudad más grande de Entre Ríos, puerto sobre el río Uruguay, conocida por sus cítricos, termas y el complejo Salto Grande.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -31.3931,
    longitude: -58.0208,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7',
  },
  {
    slug: 'victoria',
    name: 'Victoria',
    description:
      'Ciudad puerto sobre el río Paraná, conectada con Rosario por el túnel subfluvial. Importante centro comercial y turístico del sur de Entre Ríos.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.6189,
    longitude: -60.1558,
    featured: false,
    imageUrl: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716',
  },
  {
    slug: 'villa-elisa',
    name: 'Villa Elisa',
    description:
      'Pequeña localidad conocida por ser la "Capital Nacional de la Avicultura" y por sus festivales gastronómicos. Zona rural con encanto.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.1639,
    longitude: -58.4039,
    featured: false,
    imageUrl: null,
  },
  {
    slug: 'la-paz',
    name: 'La Paz',
    description:
      'Ciudad portuaria sobre el río Paraná, con amplia costanera y playas. Centro comercial y turístico del departamento homónimo.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -30.7417,
    longitude: -59.6450,
    featured: false,
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
  },
  {
    slug: 'villa-paranacito',
    name: 'Villa Paranacito',
    description:
      'Destino de turismo aventura en el delta del Paraná, ideal para pesca, kayak y ecoturismo. Naturaleza virgen y paisajes únicos.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -33.7167,
    longitude: -58.6500,
    featured: false,
    imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29',
  },
  {
    slug: 'san-jose',
    name: 'San José',
    description:
      'Localidad histórica, hogar del Palacio San José (residencia del Gral. Urquiza). Importante sitio histórico nacional y museo.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.3167,
    longitude: -58.1167,
    featured: false,
    imageUrl: null,
  },
  {
    slug: 'diamante',
    name: 'Diamante',
    description:
      'Ciudad sobre el río Paraná, conocida por su producción agrícola y sus playas. Centro comercial del departamento homónimo.',
    province: 'Entre Ríos',
    country: 'Argentina',
    latitude: -32.0667,
    longitude: -60.6333,
    featured: false,
    imageUrl: null,
  },
] as const;

/**
 * Seeds the destinations table with Entre Ríos tourism destinations.
 *
 * This is the main seeder function that demonstrates:
 * 1. How to prepare data for insertion
 * 2. How to use Drizzle ORM's insert method
 * 3. How to log progress effectively
 * 4. How to handle errors gracefully
 * 5. How to return operation results
 *
 * The function is idempotent when skipExisting is true, meaning it can be
 * run multiple times safely without creating duplicates.
 *
 * @param options - Configuration options for the seeding process
 * @returns Promise resolving to the seeding operation result
 * @throws Error if database insertion fails
 *
 * @example
 * ```typescript
 * // Basic usage - insert all destinations
 * await seedDestinations();
 *
 * // With verbose logging
 * await seedDestinations({ verbose: true });
 *
 * // Insert only 5 destinations (for testing)
 * await seedDestinations({ limit: 5, verbose: true });
 *
 * // Skip existing destinations
 * await seedDestinations({ skipExisting: true });
 * ```
 */
export async function seedDestinations(
  options: SeedDestinationsOptions = {}
): Promise<SeedResult> {
  const { verbose = false, limit, skipExisting = false } = options;
  const startTime = Date.now();

  logger.info('🏙️  Starting destinations seed', {
    totalDestinations: DESTINATIONS_DATA.length,
    limit: limit ?? 'none',
    skipExisting,
  });

  let inserted = 0;
  let skipped = 0;

  try {
    // Prepare data for insertion
    const dataToInsert = limit
      ? DESTINATIONS_DATA.slice(0, limit)
      : DESTINATIONS_DATA;

    if (verbose) {
      logger.info(`Preparing to insert ${dataToInsert.length} destinations`);
    }

    // Check for existing destinations if skipExisting is enabled
    if (skipExisting) {
      if (verbose) {
        logger.info('Checking for existing destinations...');
      }

      const existingSlugs = await db
        .select({ slug: destinations.slug })
        .from(destinations);

      const existingSlugSet = new Set(existingSlugs.map((d) => d.slug));

      const newDestinations = dataToInsert.filter(
        (dest) => !existingSlugSet.has(dest.slug)
      );

      skipped = dataToInsert.length - newDestinations.length;

      if (skipped > 0) {
        logger.info(`Skipping ${skipped} existing destinations`);
      }

      if (newDestinations.length === 0) {
        logger.info('No new destinations to insert');
        const duration = Date.now() - startTime;
        return { inserted: 0, skipped, duration };
      }

      // Insert only new destinations
      await db.insert(destinations).values(newDestinations);
      inserted = newDestinations.length;
    } else {
      // Insert all destinations
      await db.insert(destinations).values(dataToInsert);
      inserted = dataToInsert.length;
    }

    const duration = Date.now() - startTime;

    // Log results
    logger.info('✓ Destinations seed completed', {
      inserted,
      skipped,
      duration: `${duration}ms`,
    });

    if (verbose) {
      logger.info('Sample destinations inserted:', {
        featured: dataToInsert.filter((d) => d.featured).map((d) => d.name),
        total: dataToInsert.length,
      });
    }

    return { inserted, skipped, duration };
  } catch (error) {
    logger.error('Failed to seed destinations', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inserted,
      skipped,
    });
    throw error;
  }
}

/**
 * Main execution function that runs when this file is executed directly.
 *
 * This demonstrates how to use the seeder in standalone mode, which is useful for:
 * - Development and testing
 * - Manual database seeding
 * - CI/CD pipeline integration
 * - Quick data setup
 *
 * @example
 * ```bash
 * # Run directly with tsx
 * tsx packages/seed/docs/examples/basic-seed.ts
 *
 * # Or with ts-node
 * ts-node packages/seed/docs/examples/basic-seed.ts
 * ```
 */
async function main(): Promise<void> {
  logger.info('=== Basic Seed Example ===');
  logger.info('This example demonstrates simple destination seeding');
  logger.info('');

  try {
    // Run the seeder with verbose logging
    const result = await seedDestinations({
      verbose: true,
      skipExisting: true,
    });

    // Display summary
    logger.info('');
    logger.info('=== Seed Summary ===');
    logger.info(`✓ Inserted: ${result.inserted} destinations`);
    logger.info(`⊘ Skipped: ${result.skipped} destinations`);
    logger.info(`⏱ Duration: ${result.duration}ms`);
    logger.info('');
    logger.info('✅ Seed completed successfully!');
  } catch (error) {
    logger.error('Seed failed', error);
    process.exit(1);
  }
}

/**
 * Run the main function if this file is executed directly.
 * This check ensures the seeder only runs when explicitly called,
 * not when imported as a module.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

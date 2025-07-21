import path from 'node:path';
import exampleManifest from '../manifest-example.json';
import requiredManifest from '../manifest-required.json';
import { logger } from './logger.js';
import { validateManifestVsFolder } from './validateManifestVsFolder.js';

/**
 * Validates all manifests against their corresponding folders.
 * This function should be called once at the beginning of the seeding process.
 *
 * @param {boolean} continueOnError - Whether to continue on validation errors
 * @returns {Promise<void>}
 *
 * @example
 * ```ts
 * import { validateAllManifests } from './utils/validateAllManifests.js';
 *
 * // Validate all manifests before starting seeding
 * await validateAllManifests(false);
 * ```
 */
export async function validateAllManifests(continueOnError: boolean): Promise<void> {
    logger.info('🔍 Validando manifests contra archivos...\n');

    const validations = [
        // Required manifests
        {
            name: 'Users (Required)',
            folder: path.resolve('src/data/user/required'),
            files: requiredManifest.users,
            manifest: 'manifest-required.json'
        },
        {
            name: 'Destinations (Required)',
            folder: path.resolve('src/data/destination'),
            files: requiredManifest.destinations,
            manifest: 'manifest-required.json'
        },
        {
            name: 'Amenities (Required)',
            folder: path.resolve('src/data/amenity'),
            files: requiredManifest.amenities,
            manifest: 'manifest-required.json'
        },
        {
            name: 'Features (Required)',
            folder: path.resolve('src/data/feature'),
            files: requiredManifest.features,
            manifest: 'manifest-required.json'
        },
        // Example manifests
        {
            name: 'Users (Example)',
            folder: path.resolve('src/data/user/example'),
            files: exampleManifest.users,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Accommodations (Example)',
            folder: path.resolve('src/data/accommodation'),
            files: exampleManifest.accommodations,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Tags (Example)',
            folder: path.resolve('src/data/tag'),
            files: exampleManifest.tags,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Posts (Example)',
            folder: path.resolve('src/data/post'),
            files: exampleManifest.posts,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Events (Example)',
            folder: path.resolve('src/data/event'),
            files: exampleManifest.events,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Accommodation Reviews (Example)',
            folder: path.resolve('src/data/accommodationReview'),
            files: exampleManifest.accommodationReviews,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Destination Reviews (Example)',
            folder: path.resolve('src/data/destinationReview'),
            files: exampleManifest.destinationReviews,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Post Sponsorships (Example)',
            folder: path.resolve('src/data/postSponsorship'),
            files: exampleManifest.postSponsorships,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Post Sponsors (Example)',
            folder: path.resolve('src/data/postSponsor'),
            files: exampleManifest.postSponsors,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Event Organizers (Example)',
            folder: path.resolve('src/data/eventOrganizer'),
            files: exampleManifest.eventOrganizers,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Event Locations (Example)',
            folder: path.resolve('src/data/eventLocation'),
            files: exampleManifest.eventLocations,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Attractions (Example)',
            folder: path.resolve('src/data/attraction'),
            files: exampleManifest.attractions,
            manifest: 'manifest-example.json'
        },
        {
            name: 'Bookmarks (Example)',
            folder: path.resolve('src/data/bookmark'),
            files: exampleManifest.bookmarks,
            manifest: 'manifest-example.json'
        }
    ];

    let hasErrors = false;

    for (const validation of validations) {
        try {
            // Determinar si usar búsqueda recursiva basado en el tipo de entidad
            const useRecursive =
                validation.name.includes('Accommodations') ||
                validation.name.includes('Attractions') ||
                validation.name.includes('Events') ||
                validation.name.includes('Posts');

            await validateManifestVsFolder(
                validation.folder,
                validation.files,
                validation.name,
                continueOnError,
                useRecursive
            );
        } catch (error) {
            hasErrors = true;
            if (!continueOnError) {
                throw error;
            }
        }
    }

    if (hasErrors && continueOnError) {
        logger.warn('⚠️ Se encontraron errores de validación, pero continuando...\n');
    } else if (!hasErrors) {
        logger.success('✅ Todos los manifests validados correctamente.\n');
    }
}

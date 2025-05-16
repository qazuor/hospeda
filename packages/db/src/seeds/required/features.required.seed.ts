import { logger } from '@repo/logger';
import { StateEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../client';
import { features } from '../../schema';

/**
 * Seeds required features into the system
 */
export async function seedRequiredFeatures() {
    logger.info('Starting to seed required features', 'seedRequiredFeatures');

    try {
        // Define common features by category
        const requiredFeatures = [
            // Location features
            {
                name: 'mountain_view',
                displayName: 'Mountain View',
                description: 'Property offers views of mountains or hills',
                icon: 'mountain',
                isBuiltin: true
            },
            {
                name: 'river_view',
                displayName: 'River View',
                description: 'Property offers views of a river',
                icon: 'river',
                isBuiltin: true
            },
            {
                name: 'beach_front',
                displayName: 'Beachfront',
                description: 'Property is located directly on the beach',
                icon: 'beach',
                isBuiltin: true
            },
            {
                name: 'forest_view',
                displayName: 'Forest View',
                description: 'Property offers views of forests or woods',
                icon: 'forest',
                isBuiltin: true
            },
            {
                name: 'city_view',
                displayName: 'City View',
                description: 'Property offers views of the city',
                icon: 'city',
                isBuiltin: true
            },
            {
                name: 'lakefront',
                displayName: 'Lakefront',
                description: 'Property is located directly on a lake',
                icon: 'lake',
                isBuiltin: true
            },

            // Property type features
            {
                name: 'private_entrance',
                displayName: 'Private Entrance',
                description: 'Property has a private entrance for guests',
                icon: 'door',
                isBuiltin: true
            },
            {
                name: 'private_bathroom',
                displayName: 'Private Bathroom',
                description: 'Property has a private bathroom for guests',
                icon: 'bathroom',
                isBuiltin: true
            },
            {
                name: 'private_pool',
                displayName: 'Private Pool',
                description: 'Property has a private pool for guests',
                icon: 'pool',
                isBuiltin: true
            },
            {
                name: 'private_garden',
                displayName: 'Private Garden',
                description: 'Property has a private garden for guests',
                icon: 'garden',
                isBuiltin: true
            },
            {
                name: 'pet_friendly',
                displayName: 'Pet Friendly',
                description: 'Property allows pets',
                icon: 'pet',
                isBuiltin: true
            },
            {
                name: 'smoking_allowed',
                displayName: 'Smoking Allowed',
                description: 'Property allows smoking',
                icon: 'smoking',
                isBuiltin: true
            },

            // Special features
            {
                name: 'eco_friendly',
                displayName: 'Eco-Friendly',
                description: 'Property uses sustainable practices',
                icon: 'eco',
                isBuiltin: true
            },
            {
                name: 'historic_property',
                displayName: 'Historic Property',
                description: 'Property with historical significance',
                icon: 'history',
                isBuiltin: true
            },
            {
                name: 'unique_design',
                displayName: 'Unique Design',
                description: 'Property with unique architectural features',
                icon: 'design',
                isBuiltin: true
            },
            {
                name: 'luxury',
                displayName: 'Luxury',
                description: 'Property with luxury amenities and finishes',
                icon: 'luxury',
                isBuiltin: true
            }
        ];

        // For each feature, check if it exists and create if not
        for (const featureData of requiredFeatures) {
            const existing = await db
                .select()
                .from(features)
                .where(eq(features.name, featureData.name));

            if (existing.length === 0) {
                await db.insert(features).values({
                    ...featureData,
                    state: StateEnum.ACTIVE,
                    adminInfo: {
                        notes: 'Built-in feature created during system seeding',
                        favorite: true
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                logger.info(`Created feature: ${featureData.displayName}`, 'seedRequiredFeatures');
            } else {
                logger.info(
                    `Feature ${featureData.displayName} already exists, skipping`,
                    'seedRequiredFeatures'
                );
            }
        }

        logger.info('Successfully seeded required features', 'seedRequiredFeatures');
    } catch (error) {
        logger.error('Failed to seed required features', 'seedRequiredFeatures', error);
        throw error;
    }
}

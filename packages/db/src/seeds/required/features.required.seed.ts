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
                displayName: 'Vista a Montañas',
                description: 'Propiedad con vistas a montañas o colinas',
                icon: 'mountain',
                isBuiltin: true
            },
            {
                name: 'river_view',
                displayName: 'Vista al Río',
                description: 'Propiedad con vistas a un río',
                icon: 'river',
                isBuiltin: true
            },
            {
                name: 'beach_front',
                displayName: 'Frente a la Playa',
                description: 'Propiedad ubicada directamente en la playa',
                icon: 'beach',
                isBuiltin: true
            },
            {
                name: 'forest_view',
                displayName: 'Vista al Bosque',
                description: 'Propiedad con vistas a bosques o zonas arboladas',
                icon: 'forest',
                isBuiltin: true
            },
            {
                name: 'city_view',
                displayName: 'Vista a la Ciudad',
                description: 'Propiedad con vistas a la ciudad',
                icon: 'city',
                isBuiltin: true
            },
            {
                name: 'lakefront',
                displayName: 'Frente al Lago',
                description: 'Propiedad ubicada directamente en un lago',
                icon: 'lake',
                isBuiltin: true
            },

            // Property type features
            {
                name: 'private_entrance',
                displayName: 'Entrada Privada',
                description: 'Propiedad con entrada privada para huéspedes',
                icon: 'door',
                isBuiltin: true
            },
            {
                name: 'private_bathroom',
                displayName: 'Baño Privado',
                description: 'Propiedad con baño privado para huéspedes',
                icon: 'bathroom',
                isBuiltin: true
            },
            {
                name: 'private_pool',
                displayName: 'Piscina Privada',
                description: 'Propiedad con piscina privada para huéspedes',
                icon: 'pool',
                isBuiltin: true
            },
            {
                name: 'private_garden',
                displayName: 'Jardín Privado',
                description: 'Propiedad con jardín privado para huéspedes',
                icon: 'garden',
                isBuiltin: true
            },
            {
                name: 'pet_friendly',
                displayName: 'Admite Mascotas',
                description: 'Propiedad que permite mascotas',
                icon: 'pet',
                isBuiltin: true
            },
            {
                name: 'smoking_allowed',
                displayName: 'Se Permite Fumar',
                description: 'Propiedad donde se permite fumar',
                icon: 'smoking',
                isBuiltin: true
            },

            // Special features
            {
                name: 'eco_friendly',
                displayName: 'Ecológico',
                description: 'Propiedad que utiliza prácticas sostenibles',
                icon: 'eco',
                isBuiltin: true
            },
            {
                name: 'historic_property',
                displayName: 'Propiedad Histórica',
                description: 'Propiedad con significado histórico',
                icon: 'history',
                isBuiltin: true
            },
            {
                name: 'unique_design',
                displayName: 'Diseño Único',
                description: 'Propiedad con características arquitectónicas únicas',
                icon: 'design',
                isBuiltin: true
            },
            {
                name: 'luxury',
                displayName: 'Lujo',
                description: 'Propiedad con comodidades y acabados de lujo',
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
                        notes: 'Característica incorporada durante la inicialización del sistema',
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

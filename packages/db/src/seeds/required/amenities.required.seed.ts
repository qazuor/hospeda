import { logger } from '@repo/logger';
import { AmenitiesTypeEnum, StateEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { amenities } from '../../schema';

/**
 * Seeds required amenities into the system
 */
export async function seedRequiredAmenities() {
    logger.info('Starting to seed required amenities', 'seedRequiredAmenities');

    try {
        const db = getDb();

        // Define common amenities by category
        const requiredAmenities = [
            // Climate control amenities
            {
                name: 'air_conditioning',
                displayName: 'Aire Acondicionado',
                description: 'Sistema de aire frío para días calurosos',
                icon: 'air_conditioning',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },
            {
                name: 'heating',
                displayName: 'Calefacción',
                description: 'Sistema de calefacción para días fríos',
                icon: 'heating',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },
            {
                name: 'ceiling_fan',
                displayName: 'Ventilador de Techo',
                description: 'Ventilador de techo para circulación de aire',
                icon: 'fan',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },

            // Connectivity amenities
            {
                name: 'wifi',
                displayName: 'WiFi',
                description: 'Conexión inalámbrica a internet',
                icon: 'wifi',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },
            {
                name: 'ethernet',
                displayName: 'Internet por Cable',
                description: 'Conexión de internet por cable ethernet',
                icon: 'ethernet',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },
            {
                name: 'usb_outlets',
                displayName: 'Enchufes con USB',
                description: 'Enchufes con puertos de carga USB',
                icon: 'usb',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },

            // Entertainment amenities
            {
                name: 'tv',
                displayName: 'Televisión',
                description: 'Televisor en la propiedad',
                icon: 'tv',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },
            {
                name: 'streaming_service',
                displayName: 'Servicios de Streaming',
                description: 'Acceso a Netflix, Disney+ u otros similares',
                icon: 'streaming',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },
            {
                name: 'board_games',
                displayName: 'Juegos de Mesa',
                description: 'Colección de juegos de mesa para entretenimiento',
                icon: 'games',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },

            // Kitchen amenities
            {
                name: 'kitchen',
                displayName: 'Cocina Completa',
                description: 'Cocina completa con instalaciones para cocinar',
                icon: 'kitchen',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'refrigerator',
                displayName: 'Heladera',
                description: 'Heladera para almacenar alimentos',
                icon: 'fridge',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'microwave',
                displayName: 'Microondas',
                description: 'Horno microondas',
                icon: 'microwave',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'coffee_maker',
                displayName: 'Cafetera',
                description: 'Dispositivo para preparar café',
                icon: 'coffee',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },

            // Bed and bath amenities
            {
                name: 'washer',
                displayName: 'Lavarropas',
                description: 'Máquina para lavar ropa',
                icon: 'washer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'dryer',
                displayName: 'Secarropas',
                description: 'Máquina para secar ropa',
                icon: 'dryer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'iron',
                displayName: 'Plancha',
                description: 'Plancha para ropa con tabla de planchar',
                icon: 'iron',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'hair_dryer',
                displayName: 'Secador de Pelo',
                description: 'Dispositivo para secar el cabello',
                icon: 'hair_dryer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },

            // Outdoors amenities
            {
                name: 'pool',
                displayName: 'Piscina',
                description: 'Piscina para los huéspedes',
                icon: 'pool',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'hot_tub',
                displayName: 'Jacuzzi',
                description: 'Jacuzzi o hidromasaje',
                icon: 'hot_tub',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'bbq_grill',
                displayName: 'Parrilla',
                description: 'Parrilla para cocinar al aire libre',
                icon: 'grill',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'private_patio',
                displayName: 'Patio/Balcón Privado',
                description: 'Espacio exterior privado',
                icon: 'balcony',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },

            // Accessibility amenities
            {
                name: 'wheelchair_accessible',
                displayName: 'Accesible para Sillas de Ruedas',
                description: 'Adaptado para usuarios de sillas de ruedas',
                icon: 'wheelchair',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ACCESSIBILITY
            },
            {
                name: 'elevator',
                displayName: 'Ascensor',
                description: 'El edificio cuenta con ascensor',
                icon: 'elevator',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ACCESSIBILITY
            },

            // Safety amenities
            {
                name: 'smoke_detector',
                displayName: 'Detector de Humo',
                description: 'Sistema de detección de fuego y humo',
                icon: 'smoke_detector',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },
            {
                name: 'fire_extinguisher',
                displayName: 'Extintor de Incendios',
                description: 'Dispositivo para apagar pequeños incendios',
                icon: 'fire_extinguisher',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },
            {
                name: 'first_aid_kit',
                displayName: 'Botiquín de Primeros Auxilios',
                description: 'Suministros médicos básicos',
                icon: 'first_aid',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },

            // Family-friendly amenities
            {
                name: 'crib',
                displayName: 'Cuna para Bebés',
                description: 'Cuna para infantes',
                icon: 'crib',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },
            {
                name: 'high_chair',
                displayName: 'Silla Alta para Niños',
                description: 'Silla para alimentar a niños pequeños',
                icon: 'high_chair',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },
            {
                name: 'childproofing',
                displayName: 'Protecciones para Niños',
                description: 'Características de seguridad para niños pequeños',
                icon: 'childproof',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },

            // Work-friendly amenities
            {
                name: 'workspace',
                displayName: 'Espacio de Trabajo',
                description: 'Área adecuada para trabajar',
                icon: 'desk',
                isBuiltin: true,
                type: AmenitiesTypeEnum.WORK_FRIENDLY
            },
            {
                name: 'printer',
                displayName: 'Impresora',
                description: 'Impresora disponible para uso',
                icon: 'printer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.WORK_FRIENDLY
            }
        ];

        // For each amenity, check if it exists and create if not
        for (const amenityData of requiredAmenities) {
            const existing = await db
                .select()
                .from(amenities)
                .where(eq(amenities.name, amenityData.name));

            if (existing.length === 0) {
                await db.insert(amenities).values({
                    ...amenityData,
                    state: StateEnum.ACTIVE,
                    adminInfo: {
                        notes: 'Comodidad incorporada durante la inicialización del sistema',
                        favorite: true
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                logger.info(`Created amenity: ${amenityData.displayName}`, 'seedRequiredAmenities');
            } else {
                logger.info(
                    `Amenity ${amenityData.displayName} already exists, skipping`,
                    'seedRequiredAmenities'
                );
            }
        }

        logger.info('Successfully seeded required amenities', 'seedRequiredAmenities');
    } catch (error) {
        logger.error('Failed to seed required amenities', 'seedRequiredAmenities', error);
        throw error;
    }
}

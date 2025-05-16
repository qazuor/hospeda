import { logger } from '@repo/logger';
import { AmenitiesTypeEnum, StateEnum } from '@repo/types';
import { eq } from 'drizzle-orm';
import { db } from '../../client';
import { amenities } from '../../schema';

/**
 * Seeds required amenities into the system
 */
export async function seedRequiredAmenities() {
    logger.info('Starting to seed required amenities', 'seedRequiredAmenities');

    try {
        // Define common amenities by category
        const requiredAmenities = [
            // Climate control amenities
            {
                name: 'air_conditioning',
                displayName: 'Air Conditioning',
                description: 'Cool air system for hot days',
                icon: 'air_conditioning',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },
            {
                name: 'heating',
                displayName: 'Heating',
                description: 'Heating system for cold days',
                icon: 'heating',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },
            {
                name: 'ceiling_fan',
                displayName: 'Ceiling Fan',
                description: 'Ceiling fan for air circulation',
                icon: 'fan',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CLIMATE_CONTROL
            },

            // Connectivity amenities
            {
                name: 'wifi',
                displayName: 'WiFi',
                description: 'Wireless internet connection',
                icon: 'wifi',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },
            {
                name: 'ethernet',
                displayName: 'Wired Internet',
                description: 'Wired ethernet connection',
                icon: 'ethernet',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },
            {
                name: 'usb_outlets',
                displayName: 'USB Charging Outlets',
                description: 'Outlets with USB charging ports',
                icon: 'usb',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY
            },

            // Entertainment amenities
            {
                name: 'tv',
                displayName: 'TV',
                description: 'Television set',
                icon: 'tv',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },
            {
                name: 'streaming_service',
                displayName: 'Streaming Services',
                description: 'Access to Netflix, Disney+, or similar',
                icon: 'streaming',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },
            {
                name: 'board_games',
                displayName: 'Board Games',
                description: 'Collection of board games for entertainment',
                icon: 'games',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ENTERTAINMENT
            },

            // Kitchen amenities
            {
                name: 'kitchen',
                displayName: 'Full Kitchen',
                description: 'Complete kitchen with cooking facilities',
                icon: 'kitchen',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'refrigerator',
                displayName: 'Refrigerator',
                description: 'Refrigerator for food storage',
                icon: 'fridge',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'microwave',
                displayName: 'Microwave',
                description: 'Microwave oven',
                icon: 'microwave',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },
            {
                name: 'coffee_maker',
                displayName: 'Coffee Maker',
                description: 'Device for brewing coffee',
                icon: 'coffee',
                isBuiltin: true,
                type: AmenitiesTypeEnum.KITCHEN
            },

            // Bed and bath amenities
            {
                name: 'washer',
                displayName: 'Washing Machine',
                description: 'Clothes washing machine',
                icon: 'washer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'dryer',
                displayName: 'Clothes Dryer',
                description: 'Machine for drying clothes',
                icon: 'dryer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'iron',
                displayName: 'Iron',
                description: 'Clothes iron and ironing board',
                icon: 'iron',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },
            {
                name: 'hair_dryer',
                displayName: 'Hair Dryer',
                description: 'Device for drying hair',
                icon: 'hair_dryer',
                isBuiltin: true,
                type: AmenitiesTypeEnum.BED_AND_BATH
            },

            // Outdoors amenities
            {
                name: 'pool',
                displayName: 'Swimming Pool',
                description: 'Swimming pool for guests',
                icon: 'pool',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'hot_tub',
                displayName: 'Hot Tub',
                description: 'Hot tub or jacuzzi',
                icon: 'hot_tub',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'bbq_grill',
                displayName: 'BBQ Grill',
                description: 'Barbecue grill for outdoor cooking',
                icon: 'grill',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },
            {
                name: 'private_patio',
                displayName: 'Private Patio/Balcony',
                description: 'Private outdoor space',
                icon: 'balcony',
                isBuiltin: true,
                type: AmenitiesTypeEnum.OUTDOORS
            },

            // Accessibility amenities
            {
                name: 'wheelchair_accessible',
                displayName: 'Wheelchair Accessible',
                description: 'Suitable for wheelchair users',
                icon: 'wheelchair',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ACCESSIBILITY
            },
            {
                name: 'elevator',
                displayName: 'Elevator',
                description: 'Building has an elevator',
                icon: 'elevator',
                isBuiltin: true,
                type: AmenitiesTypeEnum.ACCESSIBILITY
            },

            // Safety amenities
            {
                name: 'smoke_detector',
                displayName: 'Smoke Detector',
                description: 'Fire and smoke detection system',
                icon: 'smoke_detector',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },
            {
                name: 'fire_extinguisher',
                displayName: 'Fire Extinguisher',
                description: 'Device for putting out small fires',
                icon: 'fire_extinguisher',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },
            {
                name: 'first_aid_kit',
                displayName: 'First Aid Kit',
                description: 'Basic medical supplies',
                icon: 'first_aid',
                isBuiltin: true,
                type: AmenitiesTypeEnum.SAFETY
            },

            // Family-friendly amenities
            {
                name: 'crib',
                displayName: 'Baby Crib',
                description: 'Crib for infants',
                icon: 'crib',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },
            {
                name: 'high_chair',
                displayName: 'High Chair',
                description: 'Chair for feeding young children',
                icon: 'high_chair',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },
            {
                name: 'childproofing',
                displayName: 'Childproofing Features',
                description: 'Safety features for young children',
                icon: 'childproof',
                isBuiltin: true,
                type: AmenitiesTypeEnum.FAMILY_FRIENDLY
            },

            // Work-friendly amenities
            {
                name: 'workspace',
                displayName: 'Dedicated Workspace',
                description: 'Area suitable for working',
                icon: 'desk',
                isBuiltin: true,
                type: AmenitiesTypeEnum.WORK_FRIENDLY
            },
            {
                name: 'printer',
                displayName: 'Printer',
                description: 'Printer available for use',
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
                        notes: 'Built-in amenity created during system seeding',
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

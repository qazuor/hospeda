import { logger } from '@repo/logger';
import { type AccommodationTypeEnum, EntityTypeEnum, StateEnum, TagColorEnum } from '@repo/types';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../../client';
import {
    accommodationAmenities,
    accommodationFaqs,
    accommodationFeatures,
    accommodationIaData,
    accommodations,
    amenities,
    destinations,
    entityTagRelations,
    features,
    tags,
    users
} from '../../../schema';

import retiroSoleadoCabanaChajari from './retiro-soleado-cabana-chajari.json';
// Import accommodation data
import senderoNaturalCountryHouseChajari from './sendero-natural-country-house-chajari.json';

// Define interfaces for seed data
interface AccommodationSeedData {
    slug: string;
    name: string;
    displayName: string;
    type: string;
    description: string;
    isFeatured?: boolean;
    contactInfo?: Record<string, unknown>;
    socialNetworks?: Record<string, unknown>;
    price?: Record<string, unknown>;
    location: Record<string, unknown>;
    media: Record<string, unknown>;
    schedule?: Record<string, unknown>;
    extraInfo?: Record<string, unknown>;
    seo?: Record<string, unknown>;
    adminInfo?: Record<string, unknown>;
    tags?: string[];
    features?: Array<{
        name: string;
        hostReWriteName?: string | null;
        comments?: string | null;
    }>;
    amenities?: Array<{
        name: string;
        isOptional: boolean;
        additionalCost?: Record<string, unknown> | null;
        additionalCostPercent?: number | null;
    }>;
    faqs?: Array<{
        question: string;
        answer: string;
        category?: string | null;
    }>;
    iaData?: Array<{
        title: string;
        content: string;
        category?: string | null;
    }>;
}

/**
 * Seeds example accommodations
 */
export async function seedExampleAccommodations() {
    logger.info('Starting to seed example accommodations', 'seedExampleAccommodations');

    try {
        // Get admin user for ownership
        const [adminUser] = await db.select().from(users).where(eq(users.name, 'admin'));

        if (!adminUser) {
            throw new Error('Admin user not found. Please seed users first.');
        }

        // Array of all accommodation data objects
        const allAccommodations = [
            senderoNaturalCountryHouseChajari,
            retiroSoleadoCabanaChajari
            // We'll add more as we create them
        ];

        // Process each accommodation
        for (const accommodationData of allAccommodations) {
            await processAccommodation(accommodationData as AccommodationSeedData, adminUser.id);
        }

        logger.info('Successfully seeded example accommodations', 'seedExampleAccommodations');
    } catch (error) {
        logger.error('Failed to seed example accommodations', 'seedExampleAccommodations', error);
        throw error;
    }
}

/**
 * Process a single accommodation entry
 * @param data The accommodation data
 * @param ownerId The ID of the owner (usually admin)
 */
async function processAccommodation(data: AccommodationSeedData, ownerId: string) {
    logger.info(`Processing accommodation: ${data.slug}`, 'processAccommodation');

    try {
        // Check if accommodation already exists
        const existingAccommodation = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.slug, data.slug));

        if (existingAccommodation.length > 0) {
            logger.info(
                `Accommodation ${data.slug} already exists, skipping`,
                'processAccommodation'
            );
            return;
        }

        // Extract destination from slug
        const slugParts = data.slug.split('-');
        const destinationName = slugParts[slugParts.length - 1]; // Last part is the destination

        // Get destination ID from name
        const [destinationRecord] = await db
            .select()
            .from(destinations)
            .where(eq(destinations.name, destinationName));

        if (!destinationRecord) {
            logger.warn(
                `Destination "${destinationName}" not found, using default destination`,
                'processAccommodation'
            );
            throw new Error(
                `Destination "${destinationName}" not found. Please seed destinations first.`
            );
        }

        const destinationId = destinationRecord.id;

        // Create the initial accommodation
        logger.info(`Creating base accommodation record: ${data.slug}`, 'processAccommodation');
        const accommodationResult = await db
            .insert(accommodations)
            .values({
                id: crypto.randomUUID(),
                name: data.name,
                displayName: data.displayName,
                slug: data.slug,
                type: data.type as AccommodationTypeEnum,
                description: data.description,
                ownerId,
                destinationId,
                state: StateEnum.ACTIVE,
                isFeatured: data.isFeatured || false,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        if (!accommodationResult || accommodationResult.length === 0) {
            throw new Error(`Failed to create accommodation: ${data.slug}`);
        }

        const accommodationId = accommodationResult[0]?.id;
        if (!accommodationId) {
            throw new Error(`No ID returned for created accommodation: ${data.slug}`);
        }

        logger.query('insert', 'accommodations', { slug: data.slug }, { id: accommodationId });

        // Update with additional data using sql to correctly handle JSONB types
        logger.info(
            `Updating accommodation with additional data: ${data.slug}`,
            'processAccommodation'
        );
        await db
            .update(accommodations)
            .set({
                contactInfo: data.contactInfo ? sql`${data.contactInfo}` : null,
                socialNetworks: data.socialNetworks ? sql`${data.socialNetworks}` : null,
                price: data.price ? sql`${data.price}` : null,
                location: sql`${data.location}`,
                media: sql`${data.media}`,
                rating: sql`${JSON.stringify({
                    cleanliness: 0,
                    hospitality: 0,
                    services: 0,
                    accuracy: 0,
                    communication: 0,
                    location: 0
                })}`,
                schedule: data.schedule ? sql`${data.schedule}` : null,
                extraInfo: data.extraInfo ? sql`${data.extraInfo}` : null,
                seo: data.seo ? sql`${data.seo}` : null,
                adminInfo: data.adminInfo ? sql`${data.adminInfo}` : null,
                updatedAt: new Date()
            })
            .where(eq(accommodations.id, accommodationId));

        logger.query('update', 'accommodations', { slug: data.slug }, { updated: true });

        // Add tags
        if (data.tags && data.tags.length > 0) {
            logger.info(
                `Adding ${data.tags.length} tags to accommodation: ${data.slug}`,
                'processAccommodation'
            );

            for (const tagName of data.tags) {
                // Find tag by name
                let [tag] = await db.select().from(tags).where(eq(tags.name, tagName));

                if (!tag) {
                    // Create the tag if it doesn't exist
                    const [newTag] = await db
                        .insert(tags)
                        .values({
                            id: crypto.randomUUID(),
                            name: tagName,
                            displayName: tagName
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase()),
                            ownerId,
                            color: TagColorEnum.BLUE, // Default color
                            state: StateEnum.ACTIVE,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        })
                        .returning();

                    tag = newTag;
                }

                // Add tag to accommodation if tag exists
                if (tag?.id) {
                    await db.insert(entityTagRelations).values({
                        entityType: EntityTypeEnum.ACCOMMODATION,
                        entityId: accommodationId,
                        tagId: tag.id
                    });

                    logger.query(
                        'insert',
                        'r_entity_tag',
                        {
                            entityId: accommodationId,
                            tagId: tag.id
                        },
                        { created: true }
                    );
                }
            }
        }

        // Add features
        if (data.features && data.features.length > 0) {
            logger.info(
                `Adding ${data.features.length} features to accommodation: ${data.slug}`,
                'processAccommodation'
            );

            for (const featureData of data.features) {
                // Find feature by name
                const [feature] = await db
                    .select()
                    .from(features)
                    .where(eq(features.name, featureData.name));

                if (!feature) {
                    logger.warn(
                        `Feature "${featureData.name}" not found, skipping`,
                        'processAccommodation'
                    );
                    continue;
                }

                // Add feature to accommodation if feature exists
                if (feature?.id) {
                    await db.insert(accommodationFeatures).values({
                        accommodationId,
                        featureId: feature.id,
                        hostReWriteName: featureData.hostReWriteName || null,
                        comments: featureData.comments || null,
                        state: StateEnum.ACTIVE,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    logger.query(
                        'insert',
                        'accommodation_features',
                        {
                            accommodationId,
                            featureId: feature.id
                        },
                        { created: true }
                    );
                }
            }
        }

        // Add amenities
        if (data.amenities && data.amenities.length > 0) {
            logger.info(
                `Adding ${data.amenities.length} amenities to accommodation: ${data.slug}`,
                'processAccommodation'
            );

            for (const amenityData of data.amenities) {
                // Find amenity by name
                const [amenity] = await db
                    .select()
                    .from(amenities)
                    .where(eq(amenities.name, amenityData.name));

                if (!amenity) {
                    logger.warn(
                        `Amenity "${amenityData.name}" not found, skipping`,
                        'processAccommodation'
                    );
                    continue;
                }

                // Add amenity to accommodation if amenity exists
                if (amenity?.id) {
                    await db.insert(accommodationAmenities).values({
                        accommodationId,
                        amenityId: amenity.id,
                        isOptional: amenityData.isOptional,
                        additionalCost: amenityData.additionalCost
                            ? sql`${amenityData.additionalCost}`
                            : null,
                        additionalCostPercent: amenityData.additionalCostPercent || null,
                        state: StateEnum.ACTIVE,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    logger.query(
                        'insert',
                        'accommodation_amenities',
                        {
                            accommodationId,
                            amenityId: amenity.id
                        },
                        { created: true }
                    );
                }
            }
        }

        // Add FAQs
        if (data.faqs && data.faqs.length > 0) {
            logger.info(
                `Adding ${data.faqs.length} FAQs to accommodation: ${data.slug}`,
                'processAccommodation'
            );

            for (const faqData of data.faqs) {
                // Create a unique name for the FAQ
                const faqId = crypto.randomUUID();
                const faqName = `faq-${Math.random().toString(36).substring(2, 7)}`;

                await db.insert(accommodationFaqs).values({
                    id: faqId,
                    name: faqName,
                    displayName: faqData.question.substring(0, 20),
                    accommodationId,
                    question: faqData.question,
                    answer: faqData.answer,
                    category: faqData.category || null,
                    state: StateEnum.ACTIVE,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                logger.query(
                    'insert',
                    'accommodation_faqs',
                    {
                        accommodationId,
                        question: faqData.question
                    },
                    { created: true }
                );
            }
        }

        // Add IA data
        if (data.iaData && data.iaData.length > 0) {
            logger.info(
                `Adding ${data.iaData.length} IA data entries to accommodation: ${data.slug}`,
                'processAccommodation'
            );

            for (const iaDataEntry of data.iaData) {
                // Create a unique name for the IA data
                const iaDataId = crypto.randomUUID();
                const iaDataName = `ia-data-${Math.random().toString(36).substring(2, 7)}`;

                await db.insert(accommodationIaData).values({
                    id: iaDataId,
                    name: iaDataName,
                    displayName: iaDataEntry.title.substring(0, 20),
                    accommodationId,
                    title: iaDataEntry.title,
                    content: iaDataEntry.content,
                    category: iaDataEntry.category || null,
                    state: StateEnum.ACTIVE,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                logger.query(
                    'insert',
                    'accommodation_ia_data',
                    {
                        accommodationId,
                        title: iaDataEntry.title
                    },
                    { created: true }
                );
            }
        }

        logger.info(`Completed processing accommodation: ${data.slug}`, 'processAccommodation');
    } catch (error) {
        logger.error(
            `Failed to process accommodation: ${data.slug}`,
            'processAccommodation',
            error
        );
        throw error;
    }
}

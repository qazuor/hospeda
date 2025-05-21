import { logger } from '@repo/logger';
import { type AccommodationTypeEnum, EntityTypeEnum, StateEnum, TagColorEnum } from '@repo/types';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../../client.js';
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

import retiroSoleadoCabanaChajari from './chajari/retiro-soleado-cabana-chajari.json';
import rioSoleadoCabanaChajari from './chajari/rio-soleado-cabana-chajari.json';
import senderoNaturalCountryHouseChajari from './chajari/sendero-natural-country-house-chajari.json';
import cabanaDelRioColon from './colon/cabana-del-rio-colon.json';
import horizonteAgradableCampingColon from './colon/horizonte-agradable-camping-colon.json';
import miradorSoleadoHotelColon from './colon/mirador-soleado-hotel-colon.json';
import nidoTranquiloHouseColon from './colon/nido-tranquilo-house-colon.json';
import paraisoCalidoCountryHouseColon from './colon/paraiso-calido-country-house-colon.json';
import refugioMaravillosoCabanaColon from './colon/refugio-maravilloso-cabana-colon.json';
import refugioSilvestreHotelColon from './colon/refugio-silvestre-hotel-colon.json';
import retiroAgradableCabanaColon from './colon/retiro-agradable-cabana-colon.json';
import retiroEncantadoCampingColon from './colon/retiro-encantado-camping-colon.json';
import rinconNaturalRoomColon from './colon/rincon-natural-room-colon.json';
import suenoAgradableApartmentColon from './colon/sueno-agradable-apartment-colon.json';
import suenoCalidoApartmentColon from './colon/sueno-calido-apartment-colon.json';
import suenoSoleadoHouseColon from './colon/sueno-soleado-house-colon.json';
import loftUrbanoConcordia from './concordia/loft-urbano-concordia.json';
import nidoCalmadoRoomConcordia from './concordia/nido-calmado-room-concordia.json';
import paraisoApacibleCampingConcordia from './concordia/paraiso-apacible-camping-concordia.json';
import refugioRelajanteHotelConcordia from './concordia/refugio-relajante-hotel-concordia.json';
import retiroAgradableHouseConcordia from './concordia/retiro-agradable-house-concordia.json';
import senderoRelajanteApartmentConcordia from './concordia/sendero-relajante-apartment-concordia.json';
import suenoAcogedorRoomConcordia from './concordia/sueno-acogedor-room-concordia.json';
import suenoCalidoApartmentConcordia from './concordia/sueno-calido-apartment-concordia.json';
import casaTermasFederacion from './federacion/casa-termas-federacion.json';
import nidoSoleadoCabanaFederacion from './federacion/nido-soleado-cabana-federacion.json';
import nidoTranquiloHostelFederacion from './federacion/nido-tranquilo-hostel-federacion.json';
import refugioApacibleHotelFederacion from './federacion/refugio-apacible-hotel-federacion.json';
import retiroNaturalCampingFederacion from './federacion/retiro-natural-camping-federacion.json';
import rinconSilvestreHostelFederacion from './federacion/rincon-silvestre-hostel-federacion.json';
import rioRelajanteApartmentFederacion from './federacion/rio-relajante-apartment-federacion.json';
import suenoNaturalApartmentFederacion from './federacion/sueno-natural-apartment-federacion.json';
import hotelPlazaGualeguaychu from './gualeguaychu/hotel-plaza-gualeguaychu.json';
import miradorTranquiloApartmentGualeguaychu from './gualeguaychu/mirador-tranquilo-apartment-gualeguaychu.json';
import nidoNaturalRoomGualeguaychu from './gualeguaychu/nido-natural-room-gualeguaychu.json';
import nidoSilvestreHotelGualeguaychu from './gualeguaychu/nido-silvestre-hotel-gualeguaychu.json';
import paraisoAcogedorCabanaGualeguaychu from './gualeguaychu/paraiso-acogedor-cabana-gualeguaychu.json';
import paraisoEncantadoRoomGualeguaychu from './gualeguaychu/paraiso-encantado-room-gualeguaychu.json';
import refugioCalmadoApartmentGualeguaychu from './gualeguaychu/refugio-calmado-apartment-gualeguaychu.json';
import refugioNaturalCountryHouseGualeguaychu from './gualeguaychu/refugio-natural-country-house-gualeguaychu.json';
import refugioSoleadoRoomGualeguaychu from './gualeguaychu/refugio-soleado-room-gualeguaychu.json';
import senderoTranquiloCountryHouseGualeguaychu from './gualeguaychu/sendero-tranquilo-country-house-gualeguaychu.json';
import suenoCalmadoHostelGualeguaychu from './gualeguaychu/sueno-calmado-hostel-gualeguaychu.json';
import rioEncantadoCampingIbicuy from './ibicuy/rio-encantado-camping-ibicuy.json';
import paraisoApacibleCampingLiebig from './liebig/paraiso-apacible-camping-liebig.json';
import retiroRelajanteCabanaLiebig from './liebig/retiro-relajante-cabana-liebig.json';
import campingRioVidaVillaParanacito from './paranacito/camping-rio-vida-villa-paranacito.json';
import miradorMaravillosoHotelParanacito from './paranacito/mirador-maravilloso-hotel-paranacito.json';
import nidoSoleadoCampingParanacito from './paranacito/nido-soleado-camping-paranacito.json';
import paraisoRelajanteCountryHouseParanacito from './paranacito/paraiso-relajante-country-house-paranacito.json';
import refugioAgradableHostelParanacito from './paranacito/refugio-agradable-hostel-paranacito.json';
import refugioApacibleCampingParanacito from './paranacito/refugio-apacible-camping-paranacito.json';
import retiroApacibleCabanaParanacito from './paranacito/retiro-apacible-cabana-paranacito.json';
import rinconCalmadoRoomParanacito from './paranacito/rincon-calmado-room-paranacito.json';
import rioSilvestreHotelParanacito from './paranacito/rio-silvestre-hotel-paranacito.json';
import senderoEncantadoHouseParanacito from './paranacito/sendero-encantado-house-paranacito.json';
import suenoNaturalApartmentParanacito from './paranacito/sueno-natural-apartment-paranacito.json';
import miradorAgradableApartmentSanJose from './sanjose/mirador-agradable-apartment-san-jose.json';
import nidoTranquiloApartmentSanJose from './sanjose/nido-tranquilo-apartment-san-jose.json';
import paraisoCalidoCabanaSanJose from './sanjose/paraiso-calido-cabana-san-jose.json';
import refugioEncantadoRoomSanJose from './sanjose/refugio-encantado-room-san-jose.json';
import retiroNaturalCountryHouseSanJose from './sanjose/retiro-natural-country-house-san-jose.json';
import rinconRelajanteHotelSanJose from './sanjose/rincon-relajante-hotel-san-jose.json';
import rioSoleadoHostelSanJose from './sanjose/rio-soleado-hostel-san-jose.json';
import senderoCalmadoHouseSanJose from './sanjose/sendero-calmado-house-san-jose.json';
import suenoApacibleCampingSanJose from './sanjose/sueno-apacible-camping-san-jose.json';
import miradorApacibleCabanaUbajay from './ubajay/mirador-apacible-cabana-ubajay.json';
import nidoSilvestreHostelUbajay from './ubajay/nido-silvestre-hostel-ubajay.json';
import paraisoNaturalHotelUbajay from './ubajay/paraiso-natural-hotel-ubajay.json';
import refugioTranquiloHouseUbajay from './ubajay/refugio-tranquilo-house-ubajay.json';
import retiroEncantadoCountryHouseUbajay from './ubajay/retiro-encantado-country-house-ubajay.json';
import rinconAgradableCampingUbajay from './ubajay/rincon-agradable-camping-ubajay.json';
import rioCalmadoCampingUbajay from './ubajay/rio-calmado-camping-ubajay.json';
import senderoCalidoApartmentUbajay from './ubajay/sendero-calido-apartment-ubajay.json';
import suenoRelajanteRoomUbajay from './ubajay/sueno-relajante-room-ubajay.json';
import hostelDelViajeroConcepcionDelUruguay from './uruguay/hostel-del-viajero-concepcion-del-uruguay.json';
import miradorCalmadoApartmentConcepcionDelUruguay from './uruguay/mirador-calmado-apartment-concepcion-del-uruguay.json';
import miradorNaturalHotelConcepcionDelUruguay from './uruguay/mirador-natural-hotel-concepcion-del-uruguay.json';
import miradorRelajanteHostelConcepcionDelUruguay from './uruguay/mirador-relajante-hostel-concepcion-del-uruguay.json';
import nidoMaravillosoCountryHouseConcepcionDelUruguay from './uruguay/nido-maravilloso-country-house-concepcion-del-uruguay.json';
import nidoSilvestreCountryHouseConcepcionDelUruguay from './uruguay/nido-silvestre-country-house-concepcion-del-uruguay.json';
import paraisoAgradableHotelConcepcionDelUruguay from './uruguay/paraiso-agradable-hotel-concepcion-del-uruguay.json';
import paraisoTranquiloCountryHouseConcepcionDelUruguay from './uruguay/paraiso-tranquilo-country-house-concepcion-del-uruguay.json';
import paraisoTranquiloRoomConcepcionDelUruguay from './uruguay/paraiso-tranquilo-room-concepcion-del-uruguay.json';
import refugioAcogedorRoomConcepcionDelUruguay from './uruguay/refugio-acogedor-room-concepcion-del-uruguay.json';
import refugioSoleadoApartmentConcepcionDelUruguay from './uruguay/refugio-soleado-apartment-concepcion-del-uruguay.json';
import retiroCalidoHostelConcepcionDelUruguay from './uruguay/retiro-calido-hostel-concepcion-del-uruguay.json';
import retiroEncantadoApartmentConcepcionDelUruguay from './uruguay/retiro-encantado-apartment-concepcion-del-uruguay.json';
import rinconMaravillosoRoomConcepcionDelUruguay from './uruguay/rincon-maravilloso-room-concepcion-del-uruguay.json';
import rinconSoleadoHostelConcepcionDelUruguay from './uruguay/rincon-soleado-hostel-concepcion-del-uruguay.json';
import rinconTranquiloCampingConcepcionDelUruguay from './uruguay/rincon-tranquilo-camping-concepcion-del-uruguay.json';
import rioApacibleHouseConcepcionDelUruguay from './uruguay/rio-apacible-house-concepcion-del-uruguay.json';
import rioNaturalApartmentConcepcionDelUruguay from './uruguay/rio-natural-apartment-concepcion-del-uruguay.json';
import rioSoleadoHotelConcepcionDelUruguay from './uruguay/rio-soleado-hotel-concepcion-del-uruguay.json';
import senderoMaravillosoCampingConcepcionDelUruguay from './uruguay/sendero-maravilloso-camping-concepcion-del-uruguay.json';
import suenoSoleadoCabanaConcepcionDelUruguay from './uruguay/sueno-soleado-cabana-concepcion-del-uruguay.json';
import suenoTranquiloApartmentConcepcionDelUruguay from './uruguay/sueno-tranquilo-apartment-concepcion-del-uruguay.json';

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
        const db = getDb();

        // Get admin user for ownership
        const [adminUser] = await db.select().from(users).where(eq(users.name, 'admin'));

        if (!adminUser) {
            throw new Error('Admin user not found. Please seed users first.');
        }

        // Array of all accommodation data objects
        const allAccommodations = [
            senderoNaturalCountryHouseChajari,
            retiroSoleadoCabanaChajari,
            cabanaDelRioColon,
            loftUrbanoConcordia,
            hotelPlazaGualeguaychu,
            casaTermasFederacion,
            hostelDelViajeroConcepcionDelUruguay,
            campingRioVidaVillaParanacito,
            rioSoleadoCabanaChajari,
            suenoAgradableApartmentColon,
            suenoCalidoApartmentColon,
            nidoTranquiloHouseColon,
            refugioSilvestreHotelColon,
            horizonteAgradableCampingColon,
            miradorSoleadoHotelColon,
            retiroEncantadoCampingColon,
            refugioMaravillosoCabanaColon,
            suenoSoleadoHouseColon,
            retiroAgradableCabanaColon,
            paraisoCalidoCountryHouseColon,
            rinconNaturalRoomColon,
            retiroEncantadoApartmentConcepcionDelUruguay,
            rinconMaravillosoRoomConcepcionDelUruguay,
            miradorNaturalHotelConcepcionDelUruguay,
            nidoMaravillosoCountryHouseConcepcionDelUruguay,
            refugioSoleadoApartmentConcepcionDelUruguay,
            paraisoTranquiloCountryHouseConcepcionDelUruguay,
            rioSoleadoHotelConcepcionDelUruguay,
            rioApacibleHouseConcepcionDelUruguay,
            miradorRelajanteHostelConcepcionDelUruguay,
            retiroCalidoHostelConcepcionDelUruguay,
            rinconSoleadoHostelConcepcionDelUruguay,
            senderoMaravillosoCampingConcepcionDelUruguay,
            suenoTranquiloApartmentConcepcionDelUruguay,
            rioNaturalApartmentConcepcionDelUruguay,
            paraisoTranquiloRoomConcepcionDelUruguay,
            miradorCalmadoApartmentConcepcionDelUruguay,
            nidoSilvestreCountryHouseConcepcionDelUruguay,
            refugioAcogedorRoomConcepcionDelUruguay,
            suenoSoleadoCabanaConcepcionDelUruguay,
            paraisoAgradableHotelConcepcionDelUruguay,
            rinconTranquiloCampingConcepcionDelUruguay,
            suenoAcogedorRoomConcordia,
            retiroAgradableHouseConcordia,
            senderoRelajanteApartmentConcordia,
            suenoCalidoApartmentConcordia,
            refugioRelajanteHotelConcordia,
            paraisoApacibleCampingConcordia,
            nidoCalmadoRoomConcordia,
            nidoSoleadoCabanaFederacion,
            suenoNaturalApartmentFederacion,
            rioRelajanteApartmentFederacion,
            retiroNaturalCampingFederacion,
            refugioApacibleHotelFederacion,
            nidoTranquiloHostelFederacion,
            rinconSilvestreHostelFederacion,
            refugioSoleadoRoomGualeguaychu,
            senderoTranquiloCountryHouseGualeguaychu,
            nidoNaturalRoomGualeguaychu,
            miradorTranquiloApartmentGualeguaychu,
            paraisoAcogedorCabanaGualeguaychu,
            refugioCalmadoApartmentGualeguaychu,
            suenoCalmadoHostelGualeguaychu,
            paraisoEncantadoRoomGualeguaychu,
            nidoSilvestreHotelGualeguaychu,
            refugioNaturalCountryHouseGualeguaychu,
            rioEncantadoCampingIbicuy,
            paraisoApacibleCampingLiebig,
            retiroRelajanteCabanaLiebig,
            refugioApacibleCampingParanacito,
            miradorMaravillosoHotelParanacito,
            paraisoRelajanteCountryHouseParanacito,
            retiroApacibleCabanaParanacito,
            rinconCalmadoRoomParanacito,
            suenoNaturalApartmentParanacito,
            senderoEncantadoHouseParanacito,
            refugioAgradableHostelParanacito,
            nidoSoleadoCampingParanacito,
            rioSilvestreHotelParanacito,
            miradorAgradableApartmentSanJose,
            paraisoCalidoCabanaSanJose,
            retiroNaturalCountryHouseSanJose,
            rinconRelajanteHotelSanJose,
            suenoApacibleCampingSanJose,
            senderoCalmadoHouseSanJose,
            refugioEncantadoRoomSanJose,
            nidoTranquiloApartmentSanJose,
            rioSoleadoHostelSanJose,
            miradorApacibleCabanaUbajay,
            paraisoNaturalHotelUbajay,
            retiroEncantadoCountryHouseUbajay,
            rinconAgradableCampingUbajay,
            suenoRelajanteRoomUbajay,
            senderoCalidoApartmentUbajay,
            refugioTranquiloHouseUbajay,
            nidoSilvestreHostelUbajay,
            rioCalmadoCampingUbajay
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
        const db = getDb();

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
        const destinationName = slugParts[slugParts.length - 1]?.replace(/_/g, '-'); // Last part is the destination

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

import { logger } from '@repo/logger';
import { StateEnum } from '@repo/types';
import { eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { destinationReviews, destinations, users } from '../../schema';

/**
 * Seeds example destination reviews
 */
export async function seedDestinationReviews() {
    logger.info('Starting to seed example destination reviews', 'seedDestinationReviews');

    try {
        const db = getDb();

        // Check if reviews already exist
        const existingReviews = await db
            .select()
            .from(destinationReviews)
            .where(ilike(destinationReviews.name, 'example_review%'));

        if (existingReviews.length > 0) {
            logger.info(
                `${existingReviews.length} example destination reviews already exist, skipping`,
                'seedDestinationReviews'
            );
            return;
        }

        // Get users to be review authors
        const authors = await db.select().from(users).where(eq(users.state, StateEnum.ACTIVE));

        if (authors.length === 0) {
            throw new Error('No active users found for creating reviews. Please seed users first.');
        }

        // Get destinations to review
        const destinationsToReview = await db
            .select()
            .from(destinations)
            .where(eq(destinations.state, StateEnum.ACTIVE));

        if (destinationsToReview.length === 0) {
            throw new Error(
                'No active destinations found for creating reviews. Please seed destinations first.'
            );
        }

        // Create example reviews data
        const reviewsData = [];

        // For each destination, create 3-5 reviews
        for (const destination of destinationsToReview) {
            const numReviews = Math.floor(Math.random() * 3) + 3; // 3-5 reviews

            for (let i = 0; i < numReviews; i++) {
                // Ensure authors array is not empty (already checked above, but for type safety)
                if (authors.length === 0) {
                    throw new Error('No authors available to assign as review creator.');
                }
                // biome-ignore lint/style/noNonNullAssertion: <explanation>
                const randomAuthor = authors[Math.floor(Math.random() * authors.length)]!;

                // Generate random ratings between 3.5 and 5.0
                const generateRating = () => Math.round((3.5 + Math.random() * 1.5) * 10) / 10;

                const review = {
                    id: crypto.randomUUID(),
                    name: `example_review_${destination.name}_${i + 1}`,
                    displayName: `Reseña para ${destination.displayName}`,
                    title: getTitleForDestination(destination.displayName, i),
                    content: getContentForDestination(destination.displayName, i),
                    rating: {
                        landscape: generateRating(),
                        attractions: generateRating(),
                        accessibility: generateRating(),
                        safety: generateRating(),
                        cleanliness: generateRating(),
                        hospitality: generateRating(),
                        culturalOffer: generateRating(),
                        gastronomy: generateRating(),
                        affordability: generateRating(),
                        nightlife: generateRating(),
                        infrastructure: generateRating(),
                        environmentalCare: generateRating(),
                        wifiAvailability: generateRating(),
                        shopping: generateRating(),
                        beaches: generateRating(),
                        greenSpaces: generateRating(),
                        localEvents: generateRating(),
                        weatherSatisfaction: generateRating()
                    },
                    state: StateEnum.ACTIVE,
                    adminInfo: {
                        notes: 'Reseña creada por el seed script',
                        favorite: false
                    },
                    createdById: randomAuthor.id,
                    updatedById: randomAuthor.id,
                    createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Random date within last 180 days
                    updatedAt: new Date()
                };

                reviewsData.push(review);
            }
        }

        // Insert reviews
        const insertedReviews = await db.insert(destinationReviews).values(reviewsData).returning();

        logger.info(
            `Created ${reviewsData.length} example destination reviews successfully`,
            'seedDestinationReviews'
        );
        logger.query(
            'insert',
            'destination_reviews',
            { count: reviewsData.length },
            insertedReviews
        );
    } catch (error) {
        logger.error('Failed to seed example destination reviews', 'seedDestinationReviews', error);
        throw error;
    }
}

/**
 * Get a review title based on destination name and index
 */
function getTitleForDestination(destinationName: string, index: number): string {
    // Generic titles that can work for any destination
    const genericTitles = [
        `Una visita inolvidable a ${destinationName}`,
        `${destinationName} superó mis expectativas`,
        `Experiencia maravillosa en ${destinationName}`,
        `${destinationName}, un destino imperdible`,
        `Lo mejor de ${destinationName}`,
        `Escapada perfecta a ${destinationName}`,
        `${destinationName}, un tesoro por descubrir`,
        `Vacaciones ideales en ${destinationName}`,
        `${destinationName} tiene todo para ofrecer`,
        `Enamorados de ${destinationName}`
    ];

    // Return a title based on index or fallback to random
    return (
        genericTitles[index % genericTitles.length] ??
        genericTitles[Math.floor(Math.random() * genericTitles.length)] ??
        ''
    );
}

/**
 * Get review content based on destination name and index
 */
function getContentForDestination(destinationName: string, index: number): string {
    // Base content templates for destination reviews
    const contentTemplates = [
        `Nuestra visita a ${destinationName} fue realmente increíble. El paisaje natural es impresionante, con vistas que quitan el aliento, especialmente cerca del río. Las playas son limpias y bien mantenidas, aunque en temporada alta se llenan bastante. La gastronomía local es exquisita, probamos platos típicos a base de pescado de río que eran deliciosos. La gente local es muy amable y hospitalaria, siempre dispuesta a ayudar a los turistas. Las opciones de alojamiento son variadas y para todos los presupuestos. Lo mejor fue la tranquilidad del lugar, ideal para desconectar del estrés de la ciudad. Como consejo, recomiendo visitar fuera de temporada alta para disfrutar mejor de las atracciones sin multitudes.`,

        `${destinationName} es un destino que combina naturaleza, cultura e historia de manera perfecta. Quedamos encantados con los paseos por el centro histórico, sus edificios bien conservados cuentan la historia del lugar. Las opciones de actividades al aire libre son numerosas, desde navegación por el río hasta senderismo en áreas naturales. La infraestructura turística está bien desarrollada, con buena señalización y servicios. Los precios son razonables comparados con otros destinos similares. El transporte público es limitado, por lo que recomendaría alquilar un auto para moverse con libertad. Un destino muy completo que vale la pena visitar al menos una vez.`,

        `Visitamos ${destinationName} en familia y fue una experiencia fantástica. Es un destino muy amigable para niños, con muchas actividades pensadas para ellos. Las playas son seguras, con aguas tranquilas ideales para que los pequeños se bañen. La oferta gastronómica es variada, aunque un poco cara en los lugares más turísticos. La ciudad está muy limpia y es segura para caminar incluso de noche. Lo único negativo fue el WiFi, que no funcionaba bien en algunos puntos de la ciudad. Las termas son impresionantes y vale la pena dedicarles al menos un día completo. Definitivamente volveremos, es un destino que tiene algo para todas las edades.`,

        `Mi experiencia en ${destinationName} fue muy positiva. Es un destino que sorprende por la belleza de sus paisajes naturales y la calidez de su gente. Disfrutamos especialmente de las actividades acuáticas y los paseos por la costanera. La oferta cultural es interesante, con museos pequeños pero bien organizados y eventos culturales regulares. Las opciones de alojamiento son variadas, desde campings hasta hoteles boutique. En cuanto a la gastronomía, los pescados de río son la estrella local y hay buenos restaurantes donde probarlos. Los precios en general son accesibles comparados con otros destinos turísticos. Como sugerencia, sería bueno que mejoraran el transporte público para facilitar la movilidad sin vehículo propio.`,

        `Pasamos una semana en ${destinationName} y quedamos enamorados del lugar. Es un destino con el equilibrio perfecto entre naturaleza y servicios urbanos. Las playas son extensas y de arena fina, ideales para pasar el día. La limpieza es notable tanto en espacios públicos como en las playas. La oferta gastronómica es excelente, con opciones para todos los gustos y presupuestos. Los lugareños son extremadamente amables y hospitalarios, siempre dispuestos a recomendar lugares poco conocidos. La relación calidad-precio es muy buena en casi todos los servicios. Lo único mejorable serían algunas calles secundarias que están en mal estado. Un destino altamente recomendable que seguramente seguirá creciendo en popularidad.`
    ];

    // Return content based on index or fallback to random
    return (
        contentTemplates[index % contentTemplates.length] ??
        contentTemplates[Math.floor(Math.random() * contentTemplates.length)] ??
        ''
    );
}

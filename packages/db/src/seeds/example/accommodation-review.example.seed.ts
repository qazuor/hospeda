import { StateEnum } from '@repo/types';
import { eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { accommodationReviews, accommodations, users } from '../../schema';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds example accommodation reviews
 */
export async function seedAccommodationReviews() {
    dbLogger.info(
        { location: 'seedAccommodationReviews' },
        'Starting to seed example accommodation reviews'
    );

    try {
        const db = getDb();

        // Check if reviews already exist
        const existingReviews = await db
            .select()
            .from(accommodationReviews)
            .where(ilike(accommodationReviews.name, 'example_review%'));

        if (existingReviews.length > 0) {
            dbLogger.info(
                { location: 'seedAccommodationReviews' },
                `${existingReviews.length} example accommodation reviews already exist, skipping`
            );
            return;
        }

        // Get users to be review authors
        const authors = await db.select().from(users).where(eq(users.state, StateEnum.ACTIVE));

        if (authors.length === 0) {
            throw new Error('No active users found for creating reviews. Please seed users first.');
        }

        // Get accommodations to review
        const accommodationsToReview = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.state, StateEnum.ACTIVE));

        if (accommodationsToReview.length === 0) {
            throw new Error(
                'No active accommodations found for creating reviews. Please seed accommodations first.'
            );
        }

        // Create example reviews data
        const reviewsData = [];

        // For each accommodation, create 2-4 reviews
        for (const accommodation of accommodationsToReview) {
            const numReviews = Math.floor(Math.random() * 3) + 2; // 2-4 reviews

            for (let i = 0; i < numReviews; i++) {
                const randomAuthor =
                    authors.length > 0
                        ? authors[Math.floor(Math.random() * authors.length)]
                        : undefined;

                // Generate random ratings between 3.5 and 5.0
                const generateRating = () => Math.round((3.5 + Math.random() * 1.5) * 10) / 10;

                if (!randomAuthor) {
                    throw new Error('No author found to assign to review.');
                }

                const review = {
                    id: crypto.randomUUID(),
                    name: `example_review_${accommodation.name}_${i + 1}`,
                    displayName: `Reseña para ${accommodation.displayName}`,
                    accommodationId: accommodation.id,
                    title: getTitleForAccommodation(accommodation.type, i),
                    content: getContentForAccommodation(
                        accommodation.type,
                        accommodation.displayName,
                        i
                    ),
                    rating: {
                        cleanliness: generateRating(),
                        hospitality: generateRating(),
                        services: generateRating(),
                        accuracy: generateRating(),
                        communication: generateRating(),
                        location: generateRating()
                    },
                    state: StateEnum.ACTIVE,
                    adminInfo: {
                        notes: 'Reseña creada por el seed script',
                        favorite: false
                    },
                    createdById: randomAuthor.id,
                    updatedById: randomAuthor.id,
                    createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
                    updatedAt: new Date()
                };

                reviewsData.push(review);
            }
        }

        // Insert reviews
        const insertedReviews = await db
            .insert(accommodationReviews)
            .values(reviewsData)
            .returning();

        dbLogger.info(
            { location: 'seedAccommodationReviews' },
            `Created ${reviewsData.length} example accommodation reviews successfully`
        );
        dbLogger.query(
            'insert',
            'accommodation_reviews',
            { count: reviewsData.length },
            insertedReviews
        );
    } catch (error) {
        dbLogger.error(
            error as Error,
            'Failed to seed example accommodation reviews in seedAccommodationReviews'
        );
        throw error;
    }
}

/**
 * Get a review title based on accommodation type and index
 */
function getTitleForAccommodation(accommodationType: string, index: number): string {
    const titles = {
        APARTMENT: [
            'Excelente apartamento en el centro',
            'Un oasis urbano para relajarse',
            'La ubicación perfecta para recorrer la ciudad',
            'Moderno y cómodo, como estar en casa'
        ],
        CABIN: [
            'Escapada perfecta en la naturaleza',
            'Cabaña acogedora con todo lo necesario',
            'Un lugar tranquilo para desconectar',
            'Experiencia inolvidable en esta cabaña'
        ],
        COUNTRY_HOUSE: [
            'Una casa rural con mucho encanto',
            'Experiencia auténtica en el campo',
            'El lugar ideal para familias numerosas',
            'Descanso perfecto rodeado de naturaleza'
        ],
        HOUSE: [
            'Casa espaciosa y bien equipada',
            'Perfecta para familias con niños',
            'Excelente opción cerca de las atracciones',
            'Como un hogar lejos de casa'
        ],
        HOTEL: [
            'Servicio impecable y habitaciones confortables',
            'Experiencia hotelera de primera clase',
            'Relación calidad-precio inmejorable',
            'Atención al cliente excepcional'
        ],
        HOSTEL: [
            'Ambiente social y gran ubicación',
            'Hostel limpio y con buena onda',
            'Perfecta opción para mochileros',
            'Instalaciones básicas pero cómodas'
        ],
        CAMPING: [
            'Contacto puro con la naturaleza',
            'Experiencia de camping auténtica',
            'Instalaciones limpias y bien mantenidas',
            'El camping ideal para aventureros'
        ],
        ROOM: [
            'Habitación cómoda y anfitriones amables',
            'Espacio acogedor con buena privacidad',
            'Ideal para estancias cortas',
            'Habitación con todas las comodidades'
        ]
    };

    // Default to HOUSE if the type doesn't match any of the above
    const typeKey = accommodationType in titles ? accommodationType : 'HOUSE';
    const typeSpecificTitles = titles[typeKey as keyof typeof titles];

    // Use index to pick a title or fallback to random
    return (
        typeSpecificTitles[index % typeSpecificTitles.length] ??
        typeSpecificTitles[Math.floor(Math.random() * typeSpecificTitles.length)] ??
        'Título de reseña'
    );
}

/**
 * Get review content based on accommodation type and name
 */
function getContentForAccommodation(
    accommodationType: string,
    accommodationName: string,
    index: number
): string {
    const baseContents = {
        APARTMENT: [
            `¡Quedamos encantados con nuestra estadía en ${accommodationName}! El apartamento está perfectamente ubicado en el centro de la ciudad, a poca distancia de restaurantes, tiendas y atracciones. El espacio estaba impecablemente limpio y tenía todo lo que necesitábamos para sentirnos como en casa. La cocina está bien equipada para preparar comidas, y la cama era muy cómoda. La comunicación con el anfitrión fue rápida y eficiente. Definitivamente volveremos en nuestra próxima visita.`,

            `Nuestra experiencia en ${accommodationName} fue excelente. El apartamento es moderno, luminoso y tiene todas las comodidades necesarias para una estancia agradable. La ubicación céntrica nos permitió movernos caminando a muchos lugares de interés. El WiFi funcionó perfecto, lo que fue importante para nosotros. Lo único que podría mejorar es que el baño es un poco pequeño, pero eso no afectó nuestra experiencia general. Recomendaría este lugar sin dudarlo.`,

            `${accommodationName} superó nuestras expectativas. El apartamento es más amplio de lo que parece en las fotos, está decorado con muy buen gusto y tiene detalles que hacen la estadía más placentera. La vista desde el balcón es hermosa, especialmente al atardecer. El anfitrión fue muy atento y nos dio excelentes recomendaciones sobre lugares para visitar y restaurantes. Lo único negativo fue un poco de ruido de la calle durante la noche, pero es comprensible por la ubicación céntrica.`,

            `Pasamos una semana en ${accommodationName} y fue una experiencia muy buena. El apartamento tiene una excelente relación calidad-precio, está bien ubicado y es cómodo para dos personas. La zona es segura y hay muchas opciones para comer y comprar cerca. El aire acondicionado funcionó perfectamente, lo cual fue crucial dado el calor de la temporada. El anfitrión fue amable y respondió rápidamente a nuestras consultas. Lo recomendaría para parejas o viajeros solitarios.`
        ],
        CABIN: [
            `¡Qué hermosa experiencia en ${accommodationName}! La cabaña está rodeada de naturaleza, con un paisaje increíble y mucha tranquilidad. El interior es acogedor y rústico, pero con todas las comodidades modernas necesarias. La estufa a leña le da un toque especial en las noches frescas. Disfrutamos mucho de la galería con parrilla, donde hicimos asados mientras contemplábamos el atardecer. Los anfitriones fueron muy amables y nos recibieron con productos caseros de la zona. ¡Una experiencia para repetir!`,

            `Nuestra estadía en ${accommodationName} fue maravillosa. La cabaña está estratégicamente ubicada, lo suficientemente aislada para sentir la conexión con la naturaleza pero a pocos minutos en auto de comercios y atracciones. El diseño interior es encantador, con detalles en madera y una distribución que aprovecha bien el espacio. La cocina está bien equipada y pudimos cocinar sin problemas. Los alrededores son perfectos para caminatas y observación de aves. Volveríamos sin dudarlo.`,

            `${accommodationName} es el lugar perfecto para desconectar de la rutina. La cabaña es más amplia de lo que esperábamos, muy limpia y bien mantenida. El jardín es precioso, con hamacas para relajarse y espacio para que los niños jueguen. Lo mejor fue poder despertar con el sonido de los pájaros y tomar el café de la mañana en el deck mirando la naturaleza. El único detalle a mejorar sería la presión del agua caliente, que a veces variaba un poco. Aun así, una experiencia cinco estrellas.`,

            `Estuvimos tres noches en ${accommodationName} y fue exactamente lo que buscábamos: paz, naturaleza y comodidad. La cabaña está muy bien equipada, con electrodomésticos nuevos y una cama súper confortable. El entorno natural es espectacular, con senderos para caminar y un arroyo cercano. Los anfitriones fueron muy atentos, nos recibieron con todo preparado y nos dieron buenas recomendaciones sobre actividades en la zona. Una escapada perfecta para parejas que buscan romance y tranquilidad.`
        ],
        COUNTRY_HOUSE: [
            `${accommodationName} es una verdadera joya en el campo entrerriano. La casa es espaciosa, bien decorada y combina a la perfección el estilo rural con comodidades modernas. Los espacios exteriores son impresionantes, con jardines cuidados, una piscina fantástica y zonas de sombra para relajarse. Fuimos un grupo grande de amigos y la distribución de la casa nos permitió tener privacidad cuando la necesitábamos y espacios comunes amplios para compartir. Los anfitriones nos recibieron con productos de su huerta y estuvieron siempre disponibles para cualquier consulta. ¡Una experiencia rural de lujo!`,

            `Nuestra familia pasó unas vacaciones inolvidables en ${accommodationName}. La casa es amplia, fresca y muy confortable, ideal para grupos numerosos. La cocina está súper equipada, lo que nos permitió preparar comidas para todos sin problemas. El parque es hermoso, con árboles centenarios que dan sombra y un quincho con parrilla donde disfrutamos de varios asados. Los niños amaron la piscina y el espacio para jugar al aire libre. Es un lugar perfecto para desconectar del ruido urbano y conectar con la naturaleza sin renunciar a las comodidades.`,

            `${accommodationName} superó todas nuestras expectativas. Esta casa de campo combina la autenticidad de lo rural con un toque de elegancia que la hace especial. Las habitaciones son amplias y luminosas, con vistas hermosas al campo. La galería techada es perfecta para disfrutar del atardecer con un mate. La propiedad está rodeada de campos con animales, lo que le da ese ambiente bucólico único. Los anfitriones nos permitieron cosechar frutas de los árboles y nos mostraron la vida en el campo. Una experiencia argentina auténtica que recomendaría a cualquier viajero.`,

            `Elegimos ${accommodationName} para reunir a toda la familia y fue la decisión perfecta. La casa es enorme y muy bien mantenida, con habitaciones confortables y espacios comunes donde pudimos compartir momentos inolvidables. El entorno rural es hermoso, con amaneceres y atardeceres espectaculares. La tranquilidad del lugar es absoluta, solo interrumpida por el canto de los pájaros. Disfrutamos mucho de la piscina, que estaba impecable, y del asador donde preparamos comidas típicas. Si buscas una experiencia auténtica de campo argentino, este es el lugar.`
        ],
        HOUSE: [
            `Nos encantó nuestra estadía en ${accommodationName}. La casa es amplia, luminosa y está perfectamente equipada para una familia. La ubicación es excelente, en un barrio tranquilo pero cerca de todas las atracciones principales. Las camas son muy cómodas y la cocina tiene todo lo necesario para preparar comidas completas. El patio trasero con parrilla fue nuestro lugar favorito para relajarnos después de un día de actividades. Los anfitriones fueron muy amables y nos dieron excelentes recomendaciones locales. ¡Totalmente recomendable!`,

            `${accommodationName} fue el lugar perfecto para nuestra estadía. La casa está impecablemente limpia y muy bien decorada, con espacios amplios y cómodos. La distribución es ideal, con un living acogedor y dormitorios que permiten un buen descanso. La cocina está completamente equipada y pudimos preparar todas nuestras comidas sin problema. Lo mejor fue la ubicación, en un barrio tranquilo pero a poca distancia de comercios y lugares de interés. El anfitrión fue muy atento y estuvo pendiente de que no nos faltara nada. ¡Volveríamos sin dudarlo!`,

            `Nos alojamos en ${accommodationName} durante una semana y la experiencia fue excelente. La casa es exactamente como se muestra en las fotos: espaciosa, moderna y con todo lo necesario para una estadía confortable. El jardín es hermoso y bien cuidado, ideal para que los niños jueguen. La ubicación es perfecta, en una zona residencial tranquila pero cerca de todo lo necesario. El anfitrión fue muy atento, respondió rápidamente a nuestras consultas y nos dio buenas recomendaciones sobre qué hacer en la zona. Un detalle que valoramos mucho fue encontrar agua fresca y algunas provisiones básicas al llegar. Definitivamente recomendaría esta propiedad.`,

            `Nuestra experiencia en ${accommodationName} fue muy buena. La casa está bien mantenida, es acogedora y tiene todas las comodidades necesarias. Las habitaciones son amplias con armarios suficientes para guardar la ropa. El baño estaba impecablemente limpio y la ducha funcionaba perfectamente. La zona es tranquila, lo que permite descansar bien por la noche. Como sugerencia, sería útil tener más utensilios de cocina para quienes se quedan varios días. El anfitrión fue muy amable y nos ayudó con información sobre actividades y lugares para comer en la zona. Una buena relación calidad-precio.`
        ],
        HOTEL: [
            `Nuestra estadía en el ${accommodationName} fue excelente. El hotel tiene una ubicación privilegiada en el centro de la ciudad, lo que nos permitió movernos caminando a muchas atracciones. La habitación era espaciosa, con una cama muy cómoda y un baño moderno y limpio. El desayuno buffet tenía mucha variedad y calidad, destacando los productos locales. El personal fue extremadamente amable y servicial, siempre dispuesto a ayudar con recomendaciones y reservas. Las áreas comunes están muy bien mantenidas y la piscina es perfecta para relajarse después de un día de turismo. Definitivamente volveríamos a alojarnos aquí.`,

            `El ${accommodationName} superó nuestras expectativas. Desde el momento del check-in, el personal nos hizo sentir bienvenidos y valorados. La habitación era elegante y confortable, con una vista espectacular. El baño estaba equipado con amenities de calidad y la ducha tenía excelente presión. El restaurante del hotel ofrece una gastronomía de primer nivel, con platos regionales e internacionales muy bien ejecutados. El servicio de habitaciones fue rápido y eficiente. La relación calidad-precio es muy buena considerando el nivel de servicio y las instalaciones. Un hotel muy recomendable para quienes visitan la zona.`,

            `Pasamos un fin de semana en el ${accommodationName} y fue una experiencia muy agradable. El hotel tiene un encanto especial, combinando elementos históricos del edificio con comodidades modernas. La cama king size era excepcionalmente cómoda y la habitación estaba insonorizada, lo que permitió un descanso perfecto. El desayuno es abundante y de buena calidad. Utilizamos el servicio de spa del hotel y los masajes fueron realmente profesionales y relajantes. La única pequeña crítica sería que el aire acondicionado era un poco ruidoso durante la noche. El personal de recepción nos ayudó a organizar excursiones en la zona. Muy recomendable.`,

            `Nuestra experiencia en el ${accommodationName} fue buena en general. La ubicación es perfecta, en pleno centro y cerca de todo. Las habitaciones son confortables y limpias, aunque un poco más pequeñas de lo que esperábamos. El desayuno está bien, con opciones variadas aunque sin destacar especialmente. Lo mejor del hotel es definitivamente su personal, siempre atento y dispuesto a ayudar con cualquier necesidad. La relación calidad-precio es correcta para lo que ofrece. Es una buena opción para viajes de negocios o turísticos cortos en la ciudad.`
        ],
        HOSTEL: [
            `El ${accommodationName} es uno de los mejores hostels en los que me he alojado. Las instalaciones están muy limpias y bien mantenidas. Los dormitorios compartidos tienen camas cómodas con enchufes individuales y luces de lectura, además de lockers seguros para guardar pertenencias. Las áreas comunes son espaciosas y favorecen la interacción entre viajeros. La cocina está completamente equipada y el desayuno incluido es sencillo pero satisfactorio. El personal es súper amigable y conocen bien la zona, ofreciendo excelentes recomendaciones. La ubicación céntrica permite explorar la ciudad caminando. Excelente relación calidad-precio para mochileros y viajeros con presupuesto ajustado.`,

            `Pasé tres noches en el ${accommodationName} y fue una experiencia fantástica. Lo que más me gustó fue el ambiente social y la facilidad para conocer otros viajeros. Las instalaciones están limpias, los baños se asean varias veces al día y las duchas tienen buena presión y agua caliente constante. Los colchones son cómodos y cada cama tiene su cortina para mayor privacidad. El área común tiene juegos de mesa y una pequeña biblioteca de intercambio. La ubicación es perfecta, cerca del transporte público y principales atracciones. El personal organiza actividades como caminatas por la ciudad y noches de asado, lo que añade valor a la experiencia. Muy recomendable para viajeros solos.`,

            `El ${accommodationName} es un lugar con mucha onda y buen ambiente. Me alojé en un dormitorio mixto de 6 camas y quedé satisfecho con la limpieza y comodidad. Los baños compartidos estaban siempre limpios y nunca tuve que esperar para ducharme. La cocina comunitaria es amplia y está bien equipada, aunque a veces se forma un poco de cola en horas pico. El WiFi funciona bien en todas las áreas del hostel. Lo mejor fue el patio interior, un oasis de tranquilidad con hamacas y plantas. El personal es joven y muy amable, siempre dispuesto a echar una mano o compartir un mate. Buena relación calidad-precio y ubicación estratégica.`,

            `Mi experiencia en el ${accommodationName} fue positiva en general. Es un hostel básico pero que cumple con lo necesario para un alojamiento económico. Las camas son cómodas aunque las habitaciones compartidas son algo pequeñas. Los baños estaban limpios pero son pocos para la cantidad de huéspedes. El desayuno es simple (café, té, tostadas y mermelada) pero suficiente. Lo mejor es la ubicación, muy céntrica y cercana a los principales atractivos turísticos. El personal es amable y servicial. Recomendable para viajeros con presupuesto limitado que priorizan ubicación sobre comodidades.`
        ],
        CAMPING: [
            `¡${accommodationName} es un camping excepcional! El área de acampe está muy bien organizada, con parcelas amplias y delimitadas que ofrecen buena privacidad. Los baños y duchas estaban sorprendentemente limpios y el agua caliente funcionaba perfectamente. Las instalaciones incluyen una cocina comunitaria bien equipada y un salón techado para días lluviosos. La ubicación es espectacular, rodeada de naturaleza y con acceso directo a senderos para caminatas. El personal es muy amable y conocedor del área, ofrecen mapas e información útil sobre actividades. El ambiente es familiar y tranquilo. Perfecto para quienes buscan una experiencia de camping con buenas comodidades.`,

            `Pasamos un fin de semana en ${accommodationName} y quedamos muy satisfechos. El camping está muy bien ubicado, cerca de lugares de interés pero lo suficientemente aislado para disfrutar de la tranquilidad. Las parcelas son espaciosas y hay buenas zonas de sombra. Los sanitarios estaban limpios, aunque en horas pico había que esperar un poco para las duchas. La zona de fogones está bien diseñada y segura. Hay un pequeño almacén en el camping con lo básico, lo cual fue muy útil. El río está a pocos metros y es perfecto para refrescarse. Recomendable para familias y grupos de amigos que buscan contacto con la naturaleza sin renunciar a ciertas comodidades.`,

            `${accommodationName} ofrece una experiencia de camping auténtica en un entorno natural privilegiado. El terreno está bien mantenido, con áreas designadas para carpas y vehículos. Los sanitarios son básicos pero funcionales y limpios. La zona de parrillas comunitarias está bien equipada, aunque en temporada alta puede haber que esperar turno. Lo mejor es la ubicación junto al río, ideal para pescar o simplemente relajarse. Por la noche el cielo estrellado es espectacular gracias a la poca contaminación lumínica. El personal es amable aunque en temporada alta parecen un poco desbordados. Recomendable para amantes de la naturaleza que buscan una experiencia de camping tradicional.`,

            `Nuestra experiencia en ${accommodationName} fue mejor de lo esperado. Es un camping familiar, tranquilo y bien organizado. Las instalaciones sanitarias son sencillas pero estaban limpias y bien mantenidas. Hay buenas zonas de sombra y las parcelas son lo suficientemente grandes. La zona de lavado de vajilla es práctica y siempre tenía agua caliente. El punto fuerte es definitivamente su ubicación, en un entorno natural hermoso con muchas posibilidades para actividades al aire libre. Los encargados son muy serviciales y conocen bien la zona. La relación calidad-precio es excelente. Ideal para quienes buscan una experiencia de camping sin pretensiones pero con lo necesario.`
        ],
        ROOM: [
            `La habitación en ${accommodationName} fue una excelente elección para nuestra breve estadía. El espacio es acogedor y está decorado con buen gusto. La cama es muy cómoda, con ropa de cama de calidad que aseguró un buen descanso. El baño privado estaba impecable y bien equipado con toallas y artículos de aseo básicos. Los anfitriones son extremadamente amables y nos hicieron sentir bienvenidos desde el primer momento. La ubicación es perfecta, en una zona tranquila pero cerca de restaurantes y atracciones. El desayuno incluido era sencillo pero delicioso, con productos caseros. Una opción perfecta para viajeros que buscan una alternativa más personal que un hotel.`,

            `Mi estadía en la habitación de ${accommodationName} fue muy agradable. El espacio es tal cual se muestra en las fotos: limpio, luminoso y con una decoración cálida. La cama es confortable y hay suficiente espacio de almacenamiento. El baño, aunque pequeño, está bien diseñado y la ducha tiene buena presión de agua. Los anfitriones respetan la privacidad pero están disponibles si se necesita algo. La ubicación es conveniente, en un barrio tranquilo pero bien conectado. El WiFi funciona muy bien, lo cual fue importante para mí. Una excelente relación calidad-precio para viajeros solos o parejas.`,

            `La habitación en ${accommodationName} fue perfecta para mis necesidades. El espacio está bien aprovechado, con una cama cómoda, un pequeño escritorio y un armario suficiente. El baño privado es un plus importante y estaba muy limpio. La entrada independiente me dio libertad para entrar y salir sin molestar a los anfitriones. La zona es tranquila, lo que permite un buen descanso. Los anfitriones son muy amables y serviciales, me dieron excelentes consejos sobre lugares para visitar en la zona. El desayuno supera lo esperado, con opciones caseras y frescas. Recomendable para viajeros que buscan un ambiente hogareño y cálido.`,

            `Me alojé en una habitación de ${accommodationName} durante una semana y la experiencia fue satisfactoria. El espacio es básico pero cómodo y limpio, con todo lo necesario para una buena estadía. El baño compartido estaba siempre limpio, aunque a veces había que esperar un poco para usarlo. La ubicación es buena, en un barrio residencial tranquilo pero con fácil acceso al transporte. Los anfitriones son respetuosos y amables, aunque con poca interacción. El WiFi funcionaba correctamente la mayor parte del tiempo. La relación calidad-precio es correcta para lo que ofrece. Recomendable para viajeros con presupuesto ajustado que priorizan limpieza y ubicación sobre lujos.`
        ]
    };

    // Default to HOUSE if the type doesn't match any of the above
    const typeKey = accommodationType in baseContents ? accommodationType : 'HOUSE';
    const typeSpecificContents = baseContents[typeKey as keyof typeof baseContents];

    // Use index to pick content or fallback to random
    const baseContent =
        typeSpecificContents[index % typeSpecificContents.length] ||
        typeSpecificContents[Math.floor(Math.random() * typeSpecificContents.length)];

    // Add some personalization based on the accommodation name if needed
    return baseContent ?? '';
}

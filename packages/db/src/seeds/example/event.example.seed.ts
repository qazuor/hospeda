import {
    EventCategoryEnum,
    PreferedContactEnum,
    PriceCurrencyEnum,
    StateEnum,
    VisibilityEnum
} from '@repo/types';
import { ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { destinations } from '../../schema/destination.dbschema.js';
import { events } from '../../schema/event.dbschema.js';
import { eventLocations } from '../../schema/event_location.dbschema.js';
import { eventOrganizers } from '../../schema/event_organizer.dbschema.js';
import { users } from '../../schema/user.dbschema.js';
import { dbLogger } from '../../utils/logger.js';

/**
 * Seeds example events
 */
export async function seedEvents(): Promise<void> {
    dbLogger.info({ location: 'seedEvents' }, 'Starting example events seed...');

    try {
        const db = getDb();

        // Check if example events already exist
        const existingEvents = await db.select().from(events).where(ilike(events.name, 'example%'));

        if (existingEvents.length >= 5) {
            dbLogger.info({ location: 'seedEvents' }, 'Example events already exist, skipping...');
            return;
        }

        // Get some users to be authors
        const authors = await db
            .select()
            .from(users)
            .where(or(ilike(users.name, 'editor%'), ilike(users.name, 'client%')));

        if (authors.length === 0) {
            throw new Error('No authors found for events. Make sure users exist.');
        }

        // First create some example organizers
        const existingOrganizers = await db
            .select()
            .from(eventOrganizers)
            .where(ilike(eventOrganizers.name, 'example%'));

        const organizersToCreate = 3 - existingOrganizers.length;

        let allOrganizers = [...existingOrganizers];

        if (organizersToCreate > 0) {
            dbLogger.info(
                { location: 'seedEvents' },
                `Creating ${organizersToCreate} new event organizers...`
            );

            const organizersData = Array.from({ length: organizersToCreate }, (_, i) => {
                const index = i + existingOrganizers.length + 1;
                return {
                    name: `example_organizer_${index}`,
                    displayName: `Organizador Ejemplo ${index}`,
                    logo: 'https://images.pexels.com/photos/3814234/pexels-photo-3814234.jpeg',
                    contactInfo: {
                        personalEmail: `organizador${index}@example.com`,
                        mobilePhone: `54934456781${index}`,
                        preferredEmail: PreferedContactEnum.HOME,
                        preferredPhone: PreferedContactEnum.MOBILE
                    },
                    social: {
                        facebook: `https://www.facebook.com/organizador${index}`,
                        instagram: `https://www.instagram.com/organizador${index}`
                    },
                    state: StateEnum.ACTIVE,
                    adminInfo: {
                        notes: 'Created by seed script',
                        favorite: false,
                        tags: ['example', 'seed', 'organizer']
                    },
                    createdById: authors[0]?.id,
                    updatedById: authors[0]?.id
                };
            });

            const createdOrganizers = await db
                .insert(eventOrganizers)
                .values(organizersData)
                .returning();

            const createdOrganizersArray = Array.isArray(createdOrganizers)
                ? createdOrganizers
                : (createdOrganizers?.rows ?? []);

            dbLogger.query(
                'insert',
                'event_organizers',
                { count: organizersData.length },
                { count: createdOrganizersArray.length }
            );
            dbLogger.info(
                { location: 'seedEvents' },
                `Created ${createdOrganizersArray.length} event organizers successfully`
            );

            allOrganizers = [...allOrganizers, ...createdOrganizersArray];
        }

        // Then create some example locations
        const existingLocations = await db
            .select()
            .from(eventLocations)
            .where(ilike(eventLocations.name, 'example%'));

        const locationsToCreate = 3 - existingLocations.length;

        let allLocations = [...existingLocations];

        // Get destinations for location references
        const allDestinations = await db.select().from(destinations);

        if (locationsToCreate > 0 && allDestinations.length > 0) {
            dbLogger.info(
                { location: 'seedEvents' },
                `Creating ${locationsToCreate} new event locations...`
            );

            const locationsData = Array.from({ length: locationsToCreate }, (_, i) => {
                const index = i + existingLocations.length + 1;
                const randomDestination =
                    allDestinations[Math.floor(Math.random() * allDestinations.length)];

                return {
                    name: `example_location_${index}`,
                    displayName: `Ubicación Ejemplo ${index}`,
                    state: randomDestination?.location?.state || 'Entre Ríos',
                    country: 'Argentina',
                    zipCode: randomDestination?.location?.zipCode || '3000',
                    coordinates: randomDestination?.location?.coordinates || {
                        lat: '-32.5',
                        long: '-58.5'
                    },
                    street: `Calle Ejemplo ${index}`,
                    number: `${index * 100}`,
                    city: randomDestination?.displayName || 'Paraná',
                    placeName: `Lugar de Eventos ${index}`,
                    adminInfo: {
                        notes: 'Created by seed script',
                        favorite: false,
                        tags: ['example', 'seed', 'location']
                    },
                    createdById: authors[0]?.id,
                    updatedById: authors[0]?.id
                };
            });

            const createdLocations = await db
                .insert(eventLocations)
                .values(locationsData)
                .returning();

            const createdLocationsArray = Array.isArray(createdLocations)
                ? createdLocations
                : (createdLocations?.rows ?? []);

            dbLogger.query(
                'insert',
                'event_locations',
                { count: locationsData.length },
                { count: createdLocationsArray.length }
            );
            dbLogger.info(
                { location: 'seedEvents' },
                `Created ${createdLocationsArray.length} event locations successfully`
            );

            allLocations = [...allLocations, ...createdLocationsArray];
        }

        // Create example events
        if (allLocations.length === 0 || allOrganizers.length === 0) {
            dbLogger.warn(
                { location: 'seedEvents' },
                'No locations or organizers available for events'
            );
            return;
        }

        // Set base date for event scheduling
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;

        // Create example events data
        const exampleEvents = [
            {
                name: 'example_event_1',
                displayName: 'Festival de la Playa',
                slug: 'festival-playa-colon',
                summary:
                    'Gran festival de música en las playas de Colón, con artistas locales y nacionales en un escenario frente al río Uruguay.',
                description: `El Festival de la Playa es el evento más esperado del verano en Colón. Durante tres días consecutivos, las hermosas playas de arena blanca se transforman en un gran escenario cultural con música en vivo, danza, gastronomía y actividades para toda la familia.

Los asistentes podrán disfrutar de conciertos de artistas nacionales y bandas locales con el río Uruguay como telón de fondo. El lineup de este año incluye artistas de diversos géneros musicales, desde folclore y cumbia hasta rock nacional e internacional.

Además de la música, el festival ofrece una feria gastronómica con los mejores platos regionales, actividades recreativas para niños y adultos, exposición de artesanías y un área de food trucks con propuestas culinarias innovadoras.

Una oportunidad perfecta para disfrutar del verano entrerriano con buena música, excelente comida y el ambiente único de las playas de Colón.`,
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date(now.getTime() + 2 * oneWeek),
                    end: new Date(now.getTime() + 2 * oneWeek + 3 * oneDay),
                    isAllDay: true
                },
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg',
                        caption: 'Festival de música en la playa',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg',
                            caption: 'Público disfrutando del festival',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
                            caption: 'Escenario principal',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                authorId: authors[Math.floor(Math.random() * authors.length)]?.id,
                locationId: allLocations[0]?.id,
                organizerId: allOrganizers[0]?.id,
                contact: {
                    personalEmail: 'festival@example.com',
                    mobilePhone: '5493442123456',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: true,
                pricing: {
                    isFree: false,
                    price: 1500,
                    currency: PriceCurrencyEnum.ARS
                },
                seo: {
                    seoTitle: 'Festival de la Playa Colón 2024 - Música en vivo y gastronomía',
                    seoDescription:
                        'El festival de música más esperado del verano en las playas de Colón, Entre Ríos. Tres días de música en vivo, gastronomía y actividades para toda la familia.',
                    seoKeywords: [
                        'festival playa',
                        'música Colón',
                        'eventos Entre Ríos',
                        'verano',
                        'conciertos playa'
                    ]
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example upcoming event',
                    favorite: true,
                    tags: ['example', 'seed', 'featured', 'upcoming']
                }
            },
            {
                name: 'example_event_2',
                displayName: 'Feria de Artesanías del Litoral',
                slug: 'feria-artesanias-litoral',
                summary:
                    'Tradicional feria que reúne a los mejores artesanos de la región, exhibiendo sus creaciones en madera, cerámica, textiles y mucho más.',
                description: `La Feria de Artesanías del Litoral es un evento que celebra el talento y la creatividad de los artesanos de Entre Ríos y provincias vecinas. Durante cuatro días, el centro de la ciudad se llenará de color con más de 100 stands donde los artesanos mostrarán su trabajo en diversas disciplinas.

Los visitantes podrán apreciar y adquirir piezas únicas de:
- Talla en madera típica de la región
- Cerámica artística y utilitaria
- Textiles confeccionados con técnicas ancestrales
- Marroquinería y trabajo en cuero
- Joyería artesanal
- Cestería y tejidos en mimbre
- Arte en papel y cartapesta
- Instrumentos musicales tradicionales

Además de las exposiciones, la feria incluye talleres demostrativos donde los artesanos compartirán sus técnicas, charlas sobre el valor cultural de la artesanía regional y un patio gastronómico con comidas típicas.

La feria busca no solo comercializar artesanías, sino también preservar y difundir el patrimonio cultural inmaterial de la región, conectando a nuevas generaciones con técnicas y diseños tradicionales que forman parte de la identidad entrerriana.`,
                category: EventCategoryEnum.CULTURE,
                date: {
                    start: new Date(now.getTime() + oneDay),
                    end: new Date(now.getTime() + 5 * oneDay),
                    isAllDay: true
                },
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/2831040/pexels-photo-2831040.jpeg',
                        caption: 'Feria de artesanías',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/2957801/pexels-photo-2957801.jpeg',
                            caption: 'Artesanías en madera',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/3541925/pexels-photo-3541925.jpeg',
                            caption: 'Cerámica artesanal',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                authorId: authors[Math.floor(Math.random() * authors.length)]?.id,
                locationId: allLocations[1]?.id,
                organizerId: allOrganizers[1]?.id,
                contact: {
                    personalEmail: 'artesanias@example.com',
                    mobilePhone: '5493446789012',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: true,
                pricing: {
                    isFree: true
                },
                seo: {
                    seoTitle:
                        'Feria de Artesanías del Litoral 2024 - Encuentro de artesanos en Entre Ríos',
                    seoDescription:
                        'La mejor feria artesanal de Entre Ríos con más de 100 expositores. Artesanías en madera, cerámica, textiles y más en un evento cultural imperdible.',
                    seoKeywords: [
                        'feria artesanías',
                        'artesanos Entre Ríos',
                        'cultura entrerriana',
                        'artesanía regional',
                        'madera',
                        'cerámica'
                    ]
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example imminent event',
                    favorite: true,
                    tags: ['example', 'seed', 'featured', 'imminent']
                }
            },
            {
                name: 'example_event_3',
                displayName: 'Festival Nacional de la Citricultura',
                slug: 'festival-nacional-citricultura',
                summary:
                    'Celebración anual que rinde homenaje a la producción citrícola de Concordia, con exposiciones, degustaciones y shows musicales.',
                description: `El Festival Nacional de la Citricultura es el evento más importante relacionado con la producción de cítricos en Argentina. Celebrado anualmente en Concordia, la "Capital Nacional del Citrus", este festival combina aspectos productivos, culturales y recreativos en una propuesta única.

Durante cinco días, productores, empresarios, técnicos y público general pueden disfrutar de:

## Exposición citrícola:
- Stands de empresas productoras y exportadoras
- Maquinaria agrícola especializada
- Insumos y servicios para el sector
- Charlas técnicas y capacitaciones

## Muestra gastronómica:
- Degustaciones de platos elaborados con cítricos
- Concurso de cocina con naranjas, mandarinas y limones
- Exhibiciones de coctelería con jugos naturales
- Elaboración de dulces y conservas artesanales

## Actividades culturales:
- Elección de la Reina Nacional de la Citricultura
- Desfile de carrozas temáticas
- Espectáculos de danza y música
- Shows nocturnos con artistas nacionales

## Actividades para la familia:
- Visitas guiadas a quintas y plantas empacadoras
- Talleres infantiles de plantación y cuidado de cítricos
- Juegos y entretenimiento para niños
- Feria de artesanos y productos regionales

El festival no solo es una celebración de la producción citrícola, sino también un reconocimiento al trabajo de miles de familias entrerrianas que sostienen esta actividad económica fundamental para la región. Una oportunidad perfecta para conocer más sobre esta industria y disfrutar de la hospitalidad concordiense.`,
                category: EventCategoryEnum.FESTIVAL,
                date: {
                    start: new Date(now.getTime() + 3 * oneMonth),
                    end: new Date(now.getTime() + 3 * oneMonth + 5 * oneDay),
                    isAllDay: true
                },
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg',
                        caption: 'Plantación de cítricos',
                        state: StateEnum.ACTIVE
                    }
                },
                authorId: authors[Math.floor(Math.random() * authors.length)]?.id,
                locationId: allLocations[Math.floor(Math.random() * allLocations.length)]?.id,
                organizerId: allOrganizers[Math.floor(Math.random() * allOrganizers.length)]?.id,
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: false,
                pricing: {
                    isFree: true
                },
                seo: {
                    seoTitle: 'Festival Nacional de la Citricultura - Concordia, Entre Ríos',
                    seoDescription:
                        'El festival más importante de la producción citrícola argentina en Concordia. Exposiciones, gastronomía, cultura y entretenimiento para toda la familia.',
                    seoKeywords: [
                        'festival citricultura',
                        'cítricos Concordia',
                        'naranjas',
                        'mandarinas',
                        'Entre Ríos',
                        'producción agrícola'
                    ]
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example future event',
                    favorite: false,
                    tags: ['example', 'seed', 'future']
                }
            },
            {
                name: 'example_event_4',
                displayName: 'Maratón Termal "Corre por la Salud"',
                slug: 'maraton-termal-corre-salud',
                summary:
                    'Carrera pedestre con circuitos de 5K, 10K y 21K que recorre las calles de Federación, terminando en el complejo termal.',
                description: `La Maratón Termal "Corre por la Salud" es un evento deportivo y recreativo que combina el running con los beneficios de las termas. Esta competencia, que se realiza anualmente en la ciudad de Federación, ofrece a los participantes la experiencia única de finalizar su carrera con un relajante baño en las famosas aguas termales de la ciudad.

## Categorías y circuitos:

- **Family Run (2K)**: Un recorrido accesible para familias y principiantes que deseen participar de la fiesta deportiva.
- **Short Run (5K)**: Ideal para corredores recreativos o quienes están comenzando en el mundo de las carreras pedestres.
- **Classic Run (10K)**: La distancia clásica para corredores habituales, con un recorrido que incluye la costanera y el centro de la ciudad.
- **Half Marathon (21K)**: El desafío mayor, para corredores experimentados, con un circuito que conecta los puntos más emblemáticos de Federación.

## Beneficios para los participantes:

- Kit de corredor que incluye remera técnica, número y chip para cronometraje.
- Medalla finisher para todos los que completen el recorrido.
- Acceso gratuito al Parque Termal después de la carrera.
- Hidratación durante el recorrido y en la llegada.
- Frutas y refrigerio saludable al finalizar.
- Seguro de corredor.

## Premios:

- Trofeos para los tres primeros de cada categoría (por edad y sexo).
- Premios especiales para categoría local.
- Sorteos entre todos los participantes.

## Inscripción:

Las inscripciones se realizan a través del sitio web oficial o en puntos habilitados en Federación, Concordia, Chajarí y otras ciudades cercanas. Los cupos son limitados, por lo que se recomienda inscribirse con anticipación.

Más que una competencia deportiva, la Maratón Termal es una celebración de la vida saludable y una oportunidad perfecta para conocer Federación desde una perspectiva diferente, culminando con la experiencia relajante de sus aguas termales medicinales. ¡No te la pierdas!`,
                category: EventCategoryEnum.SPORTS,
                date: {
                    start: new Date(now.getTime() + oneWeek),
                    isAllDay: true
                },
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/6077907/pexels-photo-6077907.jpeg',
                        caption: 'Maratón en Federación',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/3042862/pexels-photo-3042862.jpeg',
                            caption: 'Parque termal de Federación',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg',
                            caption: 'Participantes de la carrera',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                authorId: authors[Math.floor(Math.random() * authors.length)]?.id,
                locationId: allLocations[Math.floor(Math.random() * allLocations.length)]?.id,
                organizerId: allOrganizers[Math.floor(Math.random() * allOrganizers.length)]?.id,
                contact: {
                    personalEmail: 'maraton@example.com',
                    mobilePhone: '5493456123456',
                    website: 'https://www.maratontermal.com',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: true,
                pricing: {
                    isFree: false,
                    priceFrom: 2000,
                    priceTo: 4500,
                    currency: PriceCurrencyEnum.ARS
                },
                seo: {
                    seoTitle: 'Maratón Termal "Corre por la Salud" - Federación, Entre Ríos',
                    seoDescription:
                        'Participa en la única maratón de Argentina que termina en aguas termales. Circuitos de 2K, 5K, 10K y 21K en Federación, Entre Ríos.',
                    seoKeywords: [
                        'maratón',
                        'carrera',
                        'termas',
                        'running',
                        'Federación',
                        'Entre Ríos',
                        'deporte',
                        'salud'
                    ]
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example upcoming sports event',
                    favorite: true,
                    tags: ['example', 'seed', 'sports', 'upcoming', 'featured']
                }
            },
            {
                name: 'example_event_5',
                displayName: 'Exposición "Fauna del Litoral"',
                slug: 'exposicion-fauna-litoral',
                summary:
                    'Muestra fotográfica que documenta la rica biodiversidad de los ecosistemas de Entre Ríos, con un enfoque en especies nativas y en peligro.',
                description: `La exposición "Fauna del Litoral" es una ventana a la increíble biodiversidad que albergan los ecosistemas de Entre Ríos y la región litoral argentina. A través de más de 50 fotografías de gran formato, esta muestra documenta la vida silvestre local con un enfoque en la conservación y el conocimiento.

## Secciones de la exposición:

### Ambientes acuáticos
Fotografías de especies que habitan los ríos Paraná y Uruguay, como el dorado, el surubí, la nutria gigante y el lobito de río. También se incluyen aves acuáticas como garzas, biguás y gaviotas.

### Selvas en galería
Imágenes de la rica biodiversidad que se desarrolla a orillas de los cursos de agua, incluyendo el mono carayá, tucanes, loros y una variedad de mariposas e insectos.

### Palmares y pastizales
Registro fotográfico de especies adaptadas a estos ambientes característicos, como ñandúes, carpinchos, zorros y diversas aves de pastizal.

### Especies amenazadas
Una sección especial dedicada a especies en peligro de extinción como el aguará guazú, el ciervo de los pantanos y el yacaré overo, con información sobre su situación y los esfuerzos de conservación.

## Actividades complementarias:

- **Visitas guiadas**: Con especialistas en biodiversidad local.
- **Charlas y conferencias**: A cargo de fotógrafos naturalistas y biólogos.
- **Talleres para niños**: Actividades educativas para conocer y valorar la fauna entrerriana.
- **Proyección de documentales**: Sobre conservación de especies nativas.

La exposición no solo busca maravillar con la belleza de nuestra fauna, sino también concientizar sobre la importancia de su conservación y el impacto de las actividades humanas en estos frágiles ecosistemas. Una oportunidad única para conocer mejor las especies con las que compartimos nuestro territorio y reflexionar sobre nuestra responsabilidad hacia ellas.`,
                category: EventCategoryEnum.CULTURE,
                date: {
                    start: new Date(now.getTime() - 2 * oneWeek),
                    end: new Date(now.getTime() + 2 * oneWeek),
                    isAllDay: true
                },
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/1770706/pexels-photo-1770706.jpeg',
                        caption: 'Fauna del litoral argentino',
                        state: StateEnum.ACTIVE
                    }
                },
                authorId: authors[Math.floor(Math.random() * authors.length)]?.id,
                locationId: allLocations[Math.floor(Math.random() * allLocations.length)]?.id,
                organizerId: allOrganizers[Math.floor(Math.random() * allOrganizers.length)]?.id,
                contact: {
                    personalEmail: 'exposicion@example.com',
                    mobilePhone: '5493444567890',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: false,
                pricing: {
                    isFree: false,
                    price: 500,
                    currency: PriceCurrencyEnum.ARS
                },
                seo: {
                    seoTitle:
                        'Exposición Fauna del Litoral - Fotografía de naturaleza en Entre Ríos',
                    seoDescription:
                        'Muestra fotográfica sobre la biodiversidad de Entre Ríos y el litoral argentino. Especies nativas, ecosistemas y fotografía de naturaleza.',
                    seoKeywords: [
                        'fauna',
                        'Entre Ríos',
                        'litoral argentino',
                        'fotografía',
                        'naturaleza',
                        'exposición',
                        'biodiversidad'
                    ]
                },
                state: StateEnum.ACTIVE,
                adminInfo: {
                    notes: 'Example ongoing cultural event',
                    favorite: false,
                    tags: ['example', 'seed', 'culture', 'ongoing']
                }
            }
        ];

        // Insert example events
        const insertedEvents = await db.insert(events).values(exampleEvents).returning();

        const insertedCount = Array.isArray(insertedEvents)
            ? insertedEvents.length
            : typeof insertedEvents?.rowCount === 'number'
              ? insertedEvents.rowCount
              : Array.isArray(insertedEvents?.rows)
                ? insertedEvents.rows.length
                : 0;

        dbLogger.query(
            'insert',
            'events',
            { count: exampleEvents.length },
            { count: insertedCount }
        );
        dbLogger.info(
            { location: 'seedEvents' },
            `Created ${insertedCount} example events successfully`
        );
    } catch (error) {
        dbLogger.error(error as Error, 'Failed to seed example events in seedEvents');
        throw error;
    }
}

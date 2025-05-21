import { logger } from '@repo/logger';
import { PostCategoryEnum, PriceCurrencyEnum, StateEnum, VisibilityEnum } from '@repo/types';
import { eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { posts } from '../../schema/post.dbschema.js';
import { postSponsors } from '../../schema/post_sponsor.dbschema.js';
import { postSponsorships } from '../../schema/post_sponsorship.dbschema.js';
import { users } from '../../schema/user.dbschema.js';

/**
 * Seeds example posts, some with sponsorships
 */
export async function seedPosts(): Promise<void> {
    logger.info('Starting example posts seed...', 'seedPosts');

    try {
        const db = getDb();

        // Check if example posts already exist
        const existingPosts = await db.select().from(posts).where(ilike(posts.name, 'example%'));

        if (existingPosts.length >= 5) {
            logger.info('Example posts already exist, skipping...', 'seedPosts');
            return;
        }

        // Get some users to be authors (editors and admin)
        const authors = await db
            .select()
            .from(users)
            .where(or(ilike(users.name, 'admin'), ilike(users.name, 'example_editor%')));

        if (authors.length === 0) {
            throw new Error('No authors found for posts. Make sure admin and editor users exist.');
        }

        // Get sponsors for sponsorships
        const sponsors = await db.select().from(postSponsors);

        // Create sample post data
        const examplePosts = [
            {
                name: 'example_post_1',
                displayName: 'Las mejores playas de Entre Ríos',
                slug: 'mejores-playas-entre-rios',
                category: PostCategoryEnum.TOURISM,
                title: 'Descubre las mejores playas de Entre Ríos para este verano',
                summary:
                    'Una guía completa de las playas más hermosas y menos conocidas a lo largo del río Uruguay, perfectas para disfrutar durante la temporada de verano.',
                content: `Entre Ríos, con su privilegiada ubicación entre los ríos Paraná y Uruguay, ofrece algunas de las playas fluviales más hermosas de Argentina. A diferencia de las playas marítimas, estas playas de río se caracterizan por sus aguas más cálidas, arenas blancas y finas, y un entorno natural incomparable.

En este artículo te presentamos una selección de las mejores playas para visitar este verano, desde las más populares y equipadas hasta algunas joyas escondidas que vale la pena descubrir.

## Playa Banco Pelay (Colón)

Considerada una de las mejores playas fluviales de Argentina, Banco Pelay ofrece una extensa franja de arena blanca y fina que se extiende por más de 2 km. Sus aguas transparentes y su suave pendiente la hacen ideal para familias con niños. Cuenta con servicios de baños, duchas, bares y restaurantes.

## Playa Los Médanos (Gualeguaychú)

Esta hermosa playa sobre el río Uruguay destaca por sus amplias dunas de arena y aguas cristalinas. Se encuentra a solo 12 km del centro de Gualeguaychú y es perfecta para quienes buscan un ambiente más relajado pero con todos los servicios necesarios.

## Playa Valle (Concordia)

Ubicada en el Parque San Carlos, esta playa es la preferida de los concordienses y turistas por su facilidad de acceso y excelentes instalaciones. Es ideal para combinar un día de playa con visitas a las termas de la ciudad.

## Playas del Lago Salto Grande (Federación)

Las playas artificiales creadas en las orillas del lago de la represa Salto Grande ofrecen paisajes impresionantes y aguas tranquilas perfectas para la natación y deportes acuáticos. Un complemento ideal para quienes visitan las termas de Federación.

## Playa Thompson (Concepción del Uruguay)

Menos conocida pero no menos hermosa, esta playa seduce por su tranquilidad y belleza natural. Es perfecta para quienes buscan escapar de las multitudes y disfrutar de un entorno más virgen.

Cada una de estas playas tiene su encanto particular, pero todas comparten la calidez del sol entrerriano y la hospitalidad de su gente. ¡No esperes más para descubrirlas!`,
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/1054391/pexels-photo-1054391.jpeg',
                        caption: 'Playa sobre el río Uruguay',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg',
                            caption: 'Atardecer en la playa',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/1268869/pexels-photo-1268869.jpeg',
                            caption: 'Deportes acuáticos',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: true,
                isNews: false,
                isFeaturedInWebsite: true,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
                seo: {
                    seoTitle: 'Las 5 mejores playas de Entre Ríos para visitar este verano',
                    seoDescription:
                        'Guía completa de las playas fluviales más hermosas de Entre Ríos: ubicación, características y servicios para disfrutar al máximo.',
                    seoKeywords: [
                        'playas Entre Ríos',
                        'río Uruguay',
                        'turismo fluvial',
                        'verano Argentina',
                        'Colón',
                        'Gualeguaychú'
                    ]
                },
                state: StateEnum.ACTIVE,
                createdById: authors[0]?.id,
                updatedById: authors[0]?.id,
                adminInfo: {
                    notes: 'Example featured post',
                    favorite: true,
                    tags: ['example', 'seed', 'featured']
                }
            },
            {
                name: 'example_post_2',
                displayName: 'Termas de Entre Ríos',
                slug: 'termas-entre-rios-guia-completa',
                category: PostCategoryEnum.TOURISM,
                title: 'Guía completa de las termas en Entre Ríos: salud, relax y bienestar',
                summary:
                    'Descubre los mejores complejos termales de la provincia, sus propiedades curativas y los servicios que ofrecen para una escapada de relax.',
                content: `Entre Ríos se ha consolidado como el principal destino termal de Argentina, con más de 10 complejos distribuidos a lo largo de la provincia. Sus aguas brotan desde las profundidades de la tierra con temperaturas que varían entre los 33°C y 48°C y poseen valiosas propiedades mineromedicinales que benefician la salud física y mental.

## Termas de Federación

Pioneras en el turismo termal argentino, las Termas de Federación fueron inauguradas en 1997 y desde entonces se han convertido en el modelo a seguir para otros destinos. Sus aguas emergen a una temperatura de 42°C y están especialmente indicadas para el tratamiento de reumatismos y afecciones respiratorias.

## Termas de Concordia

El Complejo Termal de Concordia sorprende por sus aguas de tonalidades rojizas, debido a su alto contenido en hierro. Sus propiedades son ideales para tratamientos dermatológicos y reumatológicos.

## Termas de Colón

Con aguas que brotan a unos 34°C, las Termas de Colón destacan por su diseño integrado con el entorno natural y sus instalaciones modernas. Son perfectas para combinar con visitas a las playas del río Uruguay y el Parque Nacional El Palmar.

## Termas de Gualeguaychú

Ubicadas a solo 5 km del centro urbano, estas termas ofrecen aguas menos mineralizadas pero igualmente beneficiosas, especialmente para quienes buscan relajación y tratamientos estéticos.

## Termas de Villa Elisa

Con un concepto más exclusivo, las Termas de Villa Elisa ofrecen un complejo termal que simula un bosque, con cascadas, puentes colgantes y vegetación exuberante. Sus aguas saladas son especialmente recomendadas para problemas de osteoporosis.

Cada complejo termal ofrece una experiencia única, pero todos tienen un denominador común: la posibilidad de disfrutar de aguas curativas en un entorno natural privilegiado y con servicios de calidad. ¡Una escapada a las termas de Entre Ríos es siempre una buena idea!`,
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/3042861/pexels-photo-3042861.jpeg',
                        caption: 'Complejo termal en Entre Ríos',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/3042862/pexels-photo-3042862.jpeg',
                            caption: 'Piscinas termales',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/3042872/pexels-photo-3042872.jpeg',
                            caption: 'Tratamientos con aguas termales',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: true,
                isNews: false,
                isFeaturedInWebsite: true,
                expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
                seo: {
                    seoTitle:
                        'Guía completa de termas en Entre Ríos: beneficios, complejos y servicios',
                    seoDescription:
                        'Todo sobre las aguas termales de Entre Ríos: propiedades curativas, mejores complejos termales, servicios y consejos para tu visita.',
                    seoKeywords: [
                        'termas Entre Ríos',
                        'turismo termal',
                        'aguas termales',
                        'Federación',
                        'Concordia',
                        'salud',
                        'spa'
                    ]
                },
                state: StateEnum.ACTIVE,
                createdById: authors[1]?.id || authors[0]?.id,
                updatedById: authors[1]?.id || authors[0]?.id,
                adminInfo: {
                    notes: 'Example featured post',
                    favorite: true,
                    tags: ['example', 'seed', 'featured', 'sponsored']
                }
            },
            {
                name: 'example_post_3',
                displayName: 'Aventura en El Palmar',
                slug: 'aventura-parque-nacional-el-palmar',
                category: PostCategoryEnum.NATURE,
                title: 'Aventura en el Parque Nacional El Palmar: guía para visitantes',
                summary:
                    'Todo lo que necesitas saber para disfrutar al máximo de este tesoro natural único en Argentina, hogar de la palmera Yatay.',
                content: `El Parque Nacional El Palmar, ubicado en el departamento de Colón, es una de las joyas naturales más valiosas de Entre Ríos y de Argentina. Creado en 1966 para proteger los últimos palmares de Yatay (Butia yatay), este parque de 8.500 hectáreas ofrece un paisaje único donde la biodiversidad y la historia se entrelazan.

## ¿Cómo llegar?

El parque está ubicado en el km 198 de la Ruta Nacional 14, a unos 30 km de la ciudad de Colón. Se puede llegar fácilmente en auto o mediante excursiones organizadas desde las principales ciudades de la zona.

## Qué ver y hacer

### Senderos interpretativos

El parque cuenta con varios senderos que permiten apreciar los diferentes ambientes:

- **Sendero Los Loros**: Un recorrido de 1,5 km ideal para observar aves, especialmente loros barranqueros.
- **Sendero La Selva en Galería**: Un paseo de 400 metros que muestra la vegetación típica de las orillas de los arroyos.
- **Sendero El Palmar**: El más representativo, con 650 metros a través del palmar.

### Playas y arroyos

Los arroyos Los Loros y El Palmar ofrecen pequeñas playas donde está permitido bañarse, siempre respetando las áreas habilitadas.

### Observación de fauna

Es posible avistar más de 200 especies de aves, carpinchos, zorros, ñandúes y, con suerte, algún aguará guazú (lobo de crin).

### Ruinas históricas

Las ruinas de la Calera Barquín, que datan del siglo XIX, ofrecen un interesante recorrido histórico.

## Recomendaciones para la visita

- La mejor época es entre septiembre y marzo.
- Llevar repelente, protector solar, agua y calzado cómodo.
- Respetar siempre las indicaciones de los guardaparques.
- No alimentar a la fauna silvestre.
- Está prohibido ingresar con mascotas.

El Parque Nacional El Palmar es mucho más que un simple espacio verde: es un ecosistema único que permite conectar con la naturaleza en estado puro y entender la importancia de la conservación. ¡Una visita imprescindible para cualquier amante de la naturaleza y el ecoturismo!`,
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/462024/pexels-photo-462024.jpeg',
                        caption: 'Palmeras Yatay en El Palmar',
                        state: StateEnum.ACTIVE
                    }
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: false,
                isNews: false,
                isFeaturedInWebsite: false,
                seo: {
                    seoTitle: 'Guía completa del Parque Nacional El Palmar: actividades y consejos',
                    seoDescription:
                        'Todo lo que necesitas saber para visitar el Parque Nacional El Palmar en Entre Ríos: senderos, fauna, historia y consejos prácticos.',
                    seoKeywords: [
                        'El Palmar',
                        'Parque Nacional',
                        'palmera Yatay',
                        'Entre Ríos',
                        'ecoturismo',
                        'naturaleza Argentina'
                    ]
                },
                state: StateEnum.ACTIVE,
                createdById: authors[0]?.id,
                updatedById: authors[0]?.id,
                adminInfo: {
                    notes: 'Example non-featured post about nature',
                    favorite: false,
                    tags: ['example', 'seed', 'nature']
                }
            },
            {
                name: 'example_post_4',
                displayName: 'Carnaval de Gualeguaychú',
                slug: 'carnaval-gualeguaychu-fiesta-color',
                category: PostCategoryEnum.CULTURE,
                title: 'Carnaval de Gualeguaychú: La fiesta del color, el ritmo y la alegría',
                summary:
                    'Una mirada en profundidad al carnaval más importante de Argentina, sus comparsas, su historia y cómo disfrutarlo al máximo.',
                content: `El Carnaval de Gualeguaychú, conocido oficialmente como "Carnaval del País", es el más grande y espectacular de Argentina. Cada año, entre enero y marzo, el corsódromo de la ciudad se transforma en un escenario de color, música, danza y alegría que atrae a visitantes de todo el mundo.

## Historia

Aunque el carnaval tiene raíces que se remontan más de 100 años atrás, fue en 1979 cuando se construyó el corsódromo actual, dando inicio a una nueva era para esta celebración. Desde entonces, las comparsas han evolucionado hasta convertirse en verdaderas obras de arte vivientes, comparables con las del famoso carnaval de Río de Janeiro.

## Las comparsas

Tres grandes comparsas son las protagonistas del espectáculo:

- **Marí Marí**: Con su característica temática indígena y colores terracota.
- **Kamarr**: Reconocible por sus tonos azules y plateados.
- **O'Bahía**: Que destaca por sus colores verdes y dorados.

Cada comparsa presenta un espectáculo único, con carrozas impresionantes, cientos de bailarines y bailarinas, percusionistas y cantantes que ofrecen un show de aproximadamente una hora.

## Cómo disfrutar del carnaval

### Entradas y horarios

El carnaval se realiza los sábados de enero, febrero y principios de marzo. Las entradas pueden comprarse anticipadamente a través de la web oficial o en el día en las boleterías del corsódromo.

### Dónde alojarse

Se recomienda reservar con mucha anticipación, ya que Gualeguaychú recibe miles de turistas durante la temporada. Existen opciones para todos los presupuestos: desde campings hasta hoteles boutique.

### Otras actividades

Además del carnaval nocturno, durante el día se puede disfrutar de las playas sobre el río, visitar el Parque Unzué, recorrer la ciudad o degustar la gastronomía local.

## Consejos prácticos

- Llevar ropa cómoda y fresca.
- Usar protector solar si se participa de actividades diurnas.
- Llevar algún abrigo ligero para la noche.
- Llegar con tiempo al corsódromo para conseguir buenos lugares.
- Hidratarse constantemente, especialmente si se consume alcohol.

El Carnaval de Gualeguaychú no solo es un espectáculo para la vista y el oído, sino también una experiencia cultural que permite entender el espíritu festivo y creativo de los entrerrianos. ¡Una fiesta que hay que vivir al menos una vez en la vida!`,
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/13232489/pexels-photo-13232489.jpeg',
                        caption: 'Bailarinas del Carnaval de Gualeguaychú',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/13232490/pexels-photo-13232490.jpeg',
                            caption: 'Carrozas del carnaval',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/13232483/pexels-photo-13232483.jpeg',
                            caption: 'Comparsas del carnaval',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                visibility: VisibilityEnum.PUBLIC,
                isFeatured: false,
                isNews: true,
                isFeaturedInWebsite: true,
                seo: {
                    seoTitle:
                        'Carnaval de Gualeguaychú: La mayor fiesta de Argentina | Guía Completa',
                    seoDescription:
                        'Todo sobre el Carnaval de Gualeguaychú: fechas, comparsas, entradas, alojamiento y consejos para disfrutar del carnaval más grande de Argentina.',
                    seoKeywords: [
                        'Carnaval Gualeguaychú',
                        'Carnaval del País',
                        'comparsas',
                        'Entre Ríos',
                        'corsódromo',
                        'Marí Marí',
                        'Kamarr',
                        "O'Bahía"
                    ]
                },
                state: StateEnum.ACTIVE,
                createdById: authors[1]?.id || authors[0]?.id,
                updatedById: authors[1]?.id || authors[0]?.id,
                adminInfo: {
                    notes: 'Example news post about culture',
                    favorite: true,
                    tags: ['example', 'seed', 'news', 'culture', 'sponsored']
                }
            },
            {
                name: 'example_post_5',
                displayName: 'Gastronomía entrerriana',
                slug: 'gastronomia-entrerriana-sabores-rio',
                category: PostCategoryEnum.GASTRONOMY,
                title: 'Gastronomía entrerriana: los sabores del río y la tierra',
                summary:
                    'Un recorrido por los platos típicos de Entre Ríos, donde los pescados de río, las carnes y los cítricos crean una identidad culinaria única.',
                content: `La gastronomía de Entre Ríos es un reflejo de su geografía privilegiada, rodeada por los grandes ríos Paraná y Uruguay, y de su rica historia de inmigración. Esta fusión de elementos da como resultado una cocina diversa y sabrosa que merece ser explorada.

## Pescados de río: protagonistas indiscutidos

El dorado, el surubí, el pacú y la boga son los reyes de la mesa entrerriana. Preparados a la parrilla, fritos o en guisos, estos pescados de agua dulce ofrecen sabores únicos y delicados. Algunos platos emblemáticos son:

- **Pacú a la parrilla con limón**: Un clásico que permite apreciar el sabor natural del pescado.
- **Surubí al horno con hierbas**: Una preparación aromática y sabrosa.
- **Dorado a la mostaza**: Una variante gourmet cada vez más popular.

## Carnes y embutidos

La tradición ganadera de la provincia se refleja en sus excelentes cortes de carne y embutidos artesanales:

- **Asado entrerriano**: Con cortes típicos como el vacío y la tira de asado.
- **Chorizos y morcillas caseras**: Elaborados según recetas transmitidas de generación en generación.
- **Lechón a la estaca**: Particularmente popular en celebraciones y festividades.

## Cítricos y producción frutícola

La región de Concordia, conocida como la "Capital Nacional del Citrus", aporta sabores frescos y ácidos a la cocina local:

- **Dulces caseros** de naranja, mandarina y limón.
- **Salsas cítricas** para acompañar pescados y carnes.
- **Licores artesanales** elaborados con cítricos locales.

## Influencia de la inmigración

Las colonias de inmigrantes, principalmente italianas, suizas y alemanas, han dejado su huella en platos como:

- **Chucrut entrerriano**: Una adaptación local del plato alemán.
- **Chacinados** de influencia italiana y española.
- **Repostería de influencia centroeuropea**, como el strudel de manzana.

## Dónde probar la gastronomía entrerriana

Cada ciudad de la provincia tiene sus restaurantes y paradores emblemáticos:

- En Gualeguaychú, los restaurantes del centro y la costanera.
- En Colón, los paradores de playa que sirven pescados frescos.
- En Concordia, los restaurantes familiares donde probar platos con cítricos.
- En Federación, la gastronomía que acompaña la experiencia termal.

## Eventos gastronómicos

A lo largo del año se realizan diversas ferias y festivales gastronómicos:

- **Fiesta Nacional del Pescador** en Paraná.
- **Fiesta de la Citricultura** en Concordia.
- **Fiesta Provincial del Chocolate** en Colón.

La gastronomía entrerriana es una expresión viva de la cultura e identidad de la provincia. Explorarla es una forma deliciosa de conocer más profundamente este hermoso rincón de Argentina.`,
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/3655916/pexels-photo-3655916.jpeg',
                        caption: 'Gastronomía de Entre Ríos',
                        state: StateEnum.ACTIVE
                    },
                    gallery: [
                        {
                            url: 'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg',
                            caption: 'Pescado a la parrilla',
                            state: StateEnum.ACTIVE
                        },
                        {
                            url: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg',
                            caption: 'Cítricos de la región',
                            state: StateEnum.ACTIVE
                        }
                    ]
                },
                visibility: VisibilityEnum.DRAFT,
                isFeatured: false,
                isNews: false,
                isFeaturedInWebsite: false,
                seo: {
                    seoTitle: 'Gastronomía de Entre Ríos: tradición, río y sabores locales',
                    seoDescription:
                        'Descubre la variada gastronomía de Entre Ríos, desde los pescados de río hasta los cítricos y platos de influencia inmigrante.',
                    seoKeywords: [
                        'gastronomía Entre Ríos',
                        'comida entrerriana',
                        'pescados de río',
                        'cítricos',
                        'asado entrerriano'
                    ]
                },
                state: StateEnum.ACTIVE,
                createdById: authors[Math.floor(Math.random() * authors.length)]?.id,
                updatedById: authors[Math.floor(Math.random() * authors.length)]?.id,
                adminInfo: {
                    notes: 'Example draft post about gastronomy',
                    favorite: false,
                    tags: ['example', 'seed', 'draft', 'gastronomy']
                }
            }
        ];

        // Insert example posts and return all columns (including 'id')
        const insertedPostsResult = await db.insert(posts).values(examplePosts).returning();

        // Normalize to array of posts with 'id'
        type InsertedPost = (typeof examplePosts)[number] & { id: string };
        const insertedPostsArray: InsertedPost[] = Array.isArray(insertedPostsResult)
            ? insertedPostsResult
            : (insertedPostsResult?.rows ?? []);

        // For backward compatibility, alias insertedPosts to insertedPostsArray
        const insertedPosts = insertedPostsArray;

        logger.query(
            'insert',
            'posts',
            { count: examplePosts.length },
            { count: insertedPostsArray.length }
        );
        logger.info(`Created ${insertedPostsArray.length} example posts successfully`, 'seedPosts');

        // Create sponsorships for some posts if sponsors exist
        if (sponsors.length > 0 && insertedPostsArray.length > 0) {
            // Map example posts by name for easier lookup
            const postsById = Object.fromEntries(
                insertedPostsArray.map((post) => [post.name, post])
            );

            // Create sponsorships data
            const sponsorshipsData = [
                {
                    sponsorId:
                        sponsors.find((s) => s.name === 'example_termas_federation')?.id ||
                        (sponsors[0]?.id ?? null),
                    postId: postsById.example_post_2?.id ?? insertedPosts[0]?.id,
                    message: 'Visita las mejores termas de Entre Ríos',
                    description:
                        'Promoción especial para lectores de este artículo: 15% de descuento en entradas al complejo termal mencionando este sitio.',
                    paid: {
                        price: 5000,
                        currency: PriceCurrencyEnum.ARS
                    },
                    paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    toDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
                    isHighlighted: true,
                    createdById: authors[0]?.id,
                    updatedById: authors[0]?.id,
                    state: StateEnum.ACTIVE
                },
                {
                    sponsorId:
                        sponsors.find((s) => s.name === 'example_carnaval_gualeguaychu')?.id ||
                        (sponsors[0]?.id ?? null),
                    postId: postsById.example_post_4?.id ?? insertedPosts[0]?.id ?? null,
                    message: '¡No te pierdas el mejor carnaval de Argentina!',
                    description:
                        'Compra tus entradas anticipadas para el Carnaval de Gualeguaychú con un 10% de descuento usando el código HOSPEDAR.',
                    paid: {
                        price: 7500,
                        currency: PriceCurrencyEnum.ARS
                    },
                    paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                    fromDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                    toDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000), // 75 days from now
                    isHighlighted: true,
                    createdById: authors[0]?.id,
                    updatedById: authors[0]?.id,
                    state: StateEnum.ACTIVE
                }
            ];

            // Insert sponsorships
            const insertedSponsorshipsResult = await db
                .insert(postSponsorships)
                .values(sponsorshipsData)
                .returning();

            // Normalize to array
            type InsertedSponsorship = (typeof sponsorshipsData)[number] & {
                id: string;
                postId: string;
            };
            const insertedSponsorships: InsertedSponsorship[] = Array.isArray(
                insertedSponsorshipsResult
            )
                ? insertedSponsorshipsResult
                : (insertedSponsorshipsResult?.rows ?? []);

            logger.query('insert', 'post_sponsorships', sponsorshipsData, insertedSponsorships);
            logger.info(
                `Created ${insertedSponsorships.length} post sponsorships successfully`,
                'seedPosts'
            );

            // Update posts with sponsorship IDs
            for (const sponsorship of insertedSponsorships) {
                await db
                    .update(posts)
                    .set({ sponsorshipId: sponsorship.id })
                    .where(eq(posts.id, sponsorship.postId));

                logger.query(
                    'update',
                    'posts',
                    { sponsorshipId: sponsorship.id },
                    { postId: sponsorship.postId }
                );
            }

            logger.info('Updated posts with sponsorship IDs successfully', 'seedPosts');
        }
    } catch (error) {
        logger.error('Failed to seed example posts', 'seedPosts', error);
        throw error;
    }
}

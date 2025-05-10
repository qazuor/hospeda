import { db } from '../../client';
import { accommodations } from '../../schema/accommodations';
import { destinations } from '../../schema/destinations';

const now = new Date().toISOString();

// IDs estáticos (destinos y usuarios conocidos)
const ownerId = '10000000-0000-0000-0000-000000000003'; // host1

const imagePool = (count: number) =>
    Array.from({ length: count }, () => ({
        url: `https://picsum.photos/seed/${Math.floor(Math.random() * 10000)}/800/600`,
        state: 'ACTIVE'
    }));

const sampleDescriptions = [
    'Casa de campo nueva que se parece más a casa. Ideal para parejas que estén buscando relajarse en la naturaleza...',
    'Departamento moderno con excelente ubicación en pleno centro, ideal para viajes de negocios o turismo.',
    'Cabaña frente al río con todos los servicios, parrilla, WiFi y excelente vista al amanecer.',
    'Habitación privada con acceso independiente en casa familiar, ideal para estadías cortas.',
    'Quinta con pileta y jardín, espacio verde ideal para grupos o familias con niños pequeños.',
    'Hostel juvenil con ambiente distendido, cocina compartida y actividades culturales nocturnas.',
    'Alojamiento tipo glamping para disfrutar del contacto con la naturaleza sin perder comodidad.'
];

const sampleFeatures = [
    ['WiFi', 'Aire acondicionado', 'Pileta', 'Cocina equipada'],
    ['Parrilla', 'Jardín', 'Vista panorámica'],
    ['Desayuno incluido', 'Estacionamiento gratuito', 'Pet friendly'],
    ['Cercano al centro', 'Vista al río']
];

const socialExamples = [
    { instagram: 'https://instagram.com/eco.alojamiento' },
    { facebook: 'https://facebook.com/hotelrioverde' },
    { website: 'https://glampingparaiso.com' },
    {}
];

const randomCoords = () => ({
    lat: (-32 + Math.random()).toFixed(5),
    long: (-58 + Math.random()).toFixed(5)
});

export async function getDestinationMap() {
    const all = await db.select().from(destinations);
    const map = new Map<string, string>();
    for (const d of all) {
        map.set(d.name.toLowerCase(), d.id);
    }
    return map;
}

export async function seedExampleAccommodations() {
    await db.delete(accommodations);

    const destinationMap = await getDestinationMap();

    const slugs = [
        ['cabanas-rio-colon', 'Colón'],
        ['loft-moderno-gualeguaychu', 'Gualeguaychú'],
        ['hotel-centro-larroque', 'Larroque'],
        ['quinta-campo-chajari', 'Chajarí'],
        ['hostel-cultura-federacion', 'Federación'],
        ['habitacion-caseros', 'Caseros'],
        ['apart-barrio-norte', 'Concordia'],
        ['bungalow-san-jose', 'San José'],
        ['glamping-liebig', 'Pueblo Liebig'],
        ['refugio-yerua', 'Puerto Yeruá'],
        ['cabana-monte-ubajay', 'Ubajay'],
        ['dome-naturaleza-san-salvador', 'San Salvador'],
        ['aparta-larroque', 'Larroque'],
        ['parador-paranacito', 'Villa Paranacito'],
        ['habitacion-ibicuy', 'Ibicuy'],
        ['eco-vivienda-uruguay', 'Santa Ana'],
        ['camping-san-justo', 'San Justo'],
        ['estancia-villa-elisa', 'Villa Elisa'],
        ['casa-colonia-elia', 'Colonia Elía'],
        ['casita-aldea', 'Aldea San Antonio']
    ];

    const values = slugs.map((tuple, i) => {
        const [slug, dest] = tuple;
        if (!dest) throw new Error(`Missing destination for slug: ${slug}`);
        const images = imagePool(Math.floor(Math.random() * 18) + 3);
        const reviewsCount = Math.floor(Math.random() * 10);
        const reviews = Array.from({ length: reviewsCount }, (_, j) => ({
            author: ownerId,
            title: `Experiencia #${j + 1}`,
            content: `Todo excelente. Repetiremos sin duda. ${j}`,
            rating: {
                cleanliness: 4 + Math.random(),
                hospitality: 4 + Math.random(),
                services: 4 + Math.random(),
                accuracy: 4 + Math.random(),
                communication: 4 + Math.random(),
                location: 4 + Math.random()
            }
        }));

        const destinationId = destinationMap.get(dest.toLowerCase());
        if (!destinationId) {
            throw new Error(`Destination '${dest.toLowerCase()}' not found for slug: ${slug}`);
        }

        return {
            id: `20000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
            slug: slug || '',
            type:
                [
                    'CABIN',
                    'APARTMENT',
                    'HOUSE',
                    'ROOM',
                    'HOTEL',
                    'CAMPING',
                    'HOSTEL',
                    'COUNTRY_HOUSE'
                ][i % 8] || '',
            destinationId: destinationId,
            ownerId,
            state: 'ACTIVE',
            description: sampleDescriptions[i % sampleDescriptions.length] || '',
            contactInfo: {
                personalEmail: `${slug}@mail.com`,
                mobilePhone: '+5493411234567',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            socialNetworks: socialExamples[i % socialExamples.length] || {},
            price: {
                basePrice: { price: 18000 + i * 300, currency: 'ARS' },
                additionalFees: {
                    cleaning: 1500
                },
                discounts: {
                    weekly: 5,
                    monthly: 10
                }
            },
            location: {
                street: `Calle Principal ${i + 1}`,
                city: dest,
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: randomCoords()
            },
            features: sampleFeatures[i % sampleFeatures.length],
            amenities: [],
            media: {
                featuredImage: images[0],
                gallery: images,
                videos:
                    i % 4 === 0
                        ? [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', state: 'ACTIVE' }]
                        : []
            },
            rating: reviews.at(0)?.rating || null,
            reviews,
            schedule: {
                lateCheckout: i % 3 === 0,
                lateCheckoutTime: '14:00',
                selfCheckin: true,
                selfCheckout: true,
                checkinTime: '12:00',
                checkoutTime: '10:00'
            },
            extraInfo: {
                capacity: 2 + (i % 5),
                minNights: 1,
                maxNights: 14,
                bedrooms: 1 + (i % 3),
                beds: 1 + (i % 2),
                bathrooms: 1,
                petFriendly: i % 4 === 0,
                smokingAllowed: i % 5 === 0,
                extraRules: i % 2 === 0 ? ['No ruidos fuertes', 'No mascotas'] : []
            },
            isFeatured: i % 6 === 0,
            tags: i % 3 === 0 ? ['relax', 'río'] : [],
            createdAt: now,
            updatedAt: now
        };
    });

    console.log('[seed] Inserting enriched example accommodations...');
    await db.insert(accommodations).values(values);
}

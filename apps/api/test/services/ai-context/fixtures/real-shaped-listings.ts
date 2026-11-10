/**
 * Real-shaped listing fixtures for the AI-chat context builders (HOS-2095).
 *
 * The HOS-2095 sweep measured three truncation defects on real production
 * listings; these fixtures reproduce their SHAPE (not their text) so the
 * regression tests and the context-size measurement exercise the same failure:
 *
 * - The Casa Quinta carries 40 amenities and its air conditioning is #37, so a
 *   20-amenity cap drops it and the bot answers "no figura".
 * - Its parking FAQ is #15, so a 10-FAQ cap drops it.
 * - Its pool dimensions sit after character 800 of the description.
 *
 * @module test/services/ai-context/fixtures/real-shaped-listings
 */

/** 40 amenity slugs; `air_conditioning` is deliberately at position 37. */
export const CASA_QUINTA_AMENITY_SLUGS: readonly string[] = [
    'wifi',
    'heating',
    'full_kitchen',
    'refrigerator_freezer',
    'microwave',
    'coffee_maker',
    'bed_linens',
    'towels',
    'cable_tv',
    'bbq_grill',
    'parking',
    'washer',
    'fireplace',
    'wood_stove',
    'private_garden',
    'smoke_detector',
    'first_aid_kit',
    'fire_extinguisher',
    'pool',
    'hot_tub',
    'laundry',
    'breakfast',
    'covered_parking',
    'balcony',
    'terrace',
    'iron',
    'hair_dryer',
    'safe',
    'fan',
    'blackout_curtains',
    'baby_crib',
    'wheelchair_accessible',
    'pet_friendly',
    'electric_kettle',
    'kitchen_utensils',
    'board_games',
    'air_conditioning',
    'bicycles',
    'dryer',
    'gas_electric_stove'
];

/** 12 feature slugs. */
export const CASA_QUINTA_FEATURE_SLUGS: readonly string[] = [
    'river_front',
    'natural_environment',
    'rural_area',
    'silent_environment',
    'gravel_access',
    'family_suitable',
    'couple_suitable',
    'pet_suitable',
    'ideal_for_groups',
    'rustic_style',
    'exclusive_kids_area',
    'renewable_energy'
];

/** Builds the 15 FAQs; the parking one is #15. */
export function makeCasaQuintaFaqs(): Array<{ question: string; answer: string }> {
    const filler = Array.from({ length: 14 }, (_, i) => ({
        question: `¿Pregunta frecuente número ${i + 1} sobre la casa quinta?`,
        answer: `Respuesta del propietario a la pregunta ${i + 1}, con algún detalle práctico para el huésped.`
    }));
    return [
        ...filler,
        {
            question: '¿Hay estacionamiento?',
            answer: 'Sí, hay lugar para tres autos dentro del predio, con portón eléctrico.'
        }
    ];
}

/** A ~1,600-char description whose pool dimensions appear after char 800. */
export const CASA_QUINTA_DESCRIPTION = `${'La casa quinta está rodeada de un parque arbolado de una hectárea, con galería, quincho y vista abierta al campo. '.repeat(8)}La pileta mide 8 x 4 metros, con una profundidad de 1,60 m, y tiene solárium con reposeras. ${'Ideal para familias y grupos de amigos que buscan descanso cerca del río. '.repeat(8)}`;

/** The Casa Quinta row as `getById` returns it. */
export function makeCasaQuinta(): Record<string, unknown> {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Cheroga Casa Quinta',
        summary: 'Casa quinta con pileta y parque a 10 minutos del río.',
        description: CASA_QUINTA_DESCRIPTION,
        type: 'COUNTRY_HOUSE',
        destinationId: 'dest-1',
        ownerId: 'owner-1',
        averageRating: 4.8,
        reviewsCount: 23,
        destination: { name: 'Colón' },
        extraInfo: { capacity: 10, bedrooms: 4, bathrooms: 3, beds: 7 },
        policies: {
            paymentMethods: ['cash', 'transfer'],
            pets: { admission: 'yes', extraCost: false },
            smokingAllowed: 'outdoor_only',
            eventsAllowed: false,
            checkIn: { from: '14:00', to: '20:00' },
            checkOut: { to: '10:00' },
            minNights: 2
        },
        price: { price: 85000, currency: 'ARS' }
    };
}

/** A bar with a real-sized carta (30 items) and a MID price range. */
export function makeBarVenue(): Record<string, unknown> {
    return {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'La Esquina del Puerto',
        summary: 'Bar de tragos y picadas frente al puerto.',
        description: `${'Bar con terraza frente al puerto, música en vivo los fines de semana y una carta de tragos de autor. '.repeat(12)}`,
        type: 'BAR',
        priceRange: 'MID',
        menuUrl: null,
        openingHours: { lunes: '18:00-02:00', viernes: '18:00-04:00', sábado: '18:00-04:00' },
        averageRating: 4.4,
        reviewsCount: 41,
        policies: { paymentMethods: ['cash', 'debit', 'credit'] }
    };
}

/** 30 carta items across 3 sections, every one priced. */
export function makeBarMenuItems(): Array<{
    sectionName: string | null;
    name: string;
    description: string | null;
    priceCents: number | null;
    isAvailable: boolean | null;
}> {
    const sections = ['Tragos', 'Picadas', 'Postres'];
    return Array.from({ length: 30 }, (_, i) => ({
        sectionName: sections[Math.floor(i / 10)] ?? null,
        name: `Plato ${i + 1}`,
        description: 'Preparado en el momento con productos de la zona.',
        priceCents: 450000 + i * 25000,
        isAvailable: true
    }));
}

/** 14 venue FAQs, the reservation policy one being #12. */
export function makeBarFaqs(): Array<{ question: string; answer: string }> {
    return Array.from({ length: 14 }, (_, i) => ({
        question: i === 11 ? '¿Toman reservas?' : `¿Pregunta del bar número ${i + 1}?`,
        answer:
            i === 11
                ? 'Aceptamos reservas para grupos de más de 6 personas.'
                : `Respuesta del local a la pregunta ${i + 1}.`
    }));
}

/** A kayak excursion with prices in centavos, as the column stores them. */
export function makeKayakExperience(): Record<string, unknown> {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Kayak al Atardecer',
        summary: 'Remada guiada por el río Uruguay al caer el sol.',
        description: `${'Salimos desde la costanera y remamos hasta las islas, con paradas para fotos y mate. '.repeat(12)}`,
        type: 'KAYAK_RENTAL',
        durationMinutes: 150,
        priceFrom: 1500000,
        priceUnit: 'per_person',
        isPriceOnRequest: false,
        meetingPoint: 'Costanera, frente al club náutico.',
        meetingPointDirections: ['Bajar por calle 12 de Abril', 'Doblar a la izquierda en la costanera'],
        whatToBring: ['Protector solar', 'Ropa que se pueda mojar'],
        requirements: ['Saber nadar'],
        policies: { cancellation: 'Se reintegra el 100% hasta 24 horas antes.', privateGroups: true },
        averageRating: 4.9,
        reviewsCount: 17
    };
}

/** 12 experience FAQs. */
export function makeKayakFaqs(): Array<{ question: string; answer: string }> {
    return Array.from({ length: 12 }, (_, i) => ({
        question: `¿Pregunta sobre el kayak número ${i + 1}?`,
        answer: `Respuesta del prestador a la pregunta ${i + 1}.`
    }));
}

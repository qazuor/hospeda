/**
 * @fileoverview
 * Data migration: 0028-add-estimated-events-entre-rios
 *
 * Inserts 43 real Entre Ríos tourist events whose date is only known to
 * month precision (HOS-280) — content sourced from official municipal /
 * tourism-board pages or, when no such page exists (a handful of purely
 * Facebook-driven local events), from the base facts recorded in the
 * curation source list, with no invented dates, figures, or artist names.
 *
 * ## Month-precision dates (HOS-280)
 *
 * Every event here (except the two noted below) sets `date.precision =
 * EventDatePrecisionEnum.MONTH` and a `start` pinned to the **1st of the
 * month at UTC midnight** (`...-01T00:00:00.000Z`) — the literal `Z`/UTC
 * form, not a `-03:00` local offset, so the day-of-month placeholder never
 * shifts into the neighboring month once rendered. Any UI consuming this
 * field is expected to render month+year only for a `MONTH`-precision
 * event (see `EventDateSchema`'s `precision` JSDoc).
 *
 * Two events carry a real, fully-known day and are seeded as ordinary
 * `EXACT`-precision events (precision omitted — `EXACT` is the schema
 * default): "Actividades por la Inmaculada Concepción" (8 de diciembre,
 * patron-saint day) and "Conmemoración de la Batalla de Caseros" (3 de
 * febrero, a fixed historical-anniversary date).
 *
 * ## Scope decision: `group: 'example'`
 *
 * Same classification as the sibling confirmed-events migration
 * (`0025-add-confirmed-events-entre-rios-2026`): real-world tourist events
 * are time-bound calendar content, not canonical system/catalog data, so
 * they follow the `example` track. `events` is on the seed dual-write
 * guard's demo-exempt list, so this migration alone is a complete delta.
 *
 * ## Idempotency
 *
 * Both `event_locations` and `events` are upserted by their unique `slug`
 * via `onConflictDoNothing()`, with a follow-up `SELECT` to resolve the id
 * of a row that already existed. Two of this migration's locations —
 * `san-salvador-centro` and `villa-paranacito-centro` — are the exact same
 * real, address-less "city centre" venue already created by
 * `0025-add-confirmed-events-entre-rios-2026`; this migration deliberately
 * reuses those slugs instead of minting duplicates, and the idempotent
 * upsert naturally resolves them to the existing row (reported as
 * "already present", not newly inserted) as long as 0025 runs first, which
 * the ascending migration-number run order guarantees.
 *
 * ## Location sharing (one row per real venue, not per event)
 *
 * Several venues host more than one event in this batch: the CDU "Predio
 * Multieventos" (Novembeer, Fiesta Nacional de la Playa de Río, Carnaval),
 * "Palacio San José" (the Batalla de Caseros act and the spring cultural
 * activities), the CDU city-wide placeholder (the three recurring races /
 * spring festivities with no single named venue), "Balneario San José"
 * (the Fiesta del Campamentista and its associated Acuatlón), and
 * "Larroque" city-wide (all three Larroque events share one town-level
 * location, since none names a specific venue). This migration creates 33
 * new `event_locations` rows (plus the 2 reused ones above) for 43 events.
 *
 * ## `destino a confirmar` note — Palacio San José
 *
 * The source curation list flags event #15 ("Actividades culturales de
 * primavera en el Palacio San José") as "DESTINO A CONFIRMAR": the Palacio
 * is physically in the rural zone of Departamento Uruguay (Ruta Provincial
 * N.º 39, km 128), not inside the city of Concepción del Uruguay proper,
 * even though it is administratively/touristically bundled under CDU (as
 * event #11, the Batalla de Caseros act at the same Palacio, already is).
 * Per this migration's hard constraint to never change a destination from
 * the source list, both events keep `destinationSlug: 'concepcion-del-uruguay'`
 * — see the report accompanying this migration for the flag to resolve.
 *
 * ## `destructive` flag decision
 *
 * `false` — purely additive, guarded by `onConflictDoNothing` on each
 * table's unique `slug`. Never updates or deletes existing data.
 */

import type { DrizzleClient } from '@repo/db';
import { destinations, eq, eventLocations, events, inArray } from '@repo/db';
import {
    EventCategoryEnum,
    EventDatePrecisionEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0028-add-estimated-events-entre-rios',
    group: 'example',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The 16 CITY destination slugs this migration's venues/events resolve against. */
const DESTINATION_SLUGS = [
    'concepcion-del-uruguay',
    'colon',
    'san-jose',
    'federacion',
    'concordia',
    'liebig',
    'ubajay',
    'urdinarrain',
    'larroque',
    'san-salvador',
    'santa-ana',
    'paranacito',
    'ibicuy',
    'gualeguay',
    'san-justo',
    'caseros'
] as const;

type DestinationSlug = (typeof DESTINATION_SLUGS)[number];

/** One real venue → one `event_locations` row. Shared across events where the venue repeats. */
interface LocationSeed {
    readonly slug: string;
    readonly destinationSlug: DestinationSlug;
    readonly placeName: string;
    readonly street?: string;
    readonly number?: string;
}

const LOCATIONS: readonly LocationSeed[] = [
    // --- Concepción del Uruguay (10 locations) ---
    {
        slug: 'predio-multieventos-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Predio Multieventos'
    },
    {
        slug: 'costa-isla-puerto-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Costa e Isla del Puerto'
    },
    {
        slug: 'isla-puerto-banco-pelay-costanera-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Isla del Puerto, Banco Pelay y costanera'
    },
    {
        slug: 'basilica-inmaculada-concepcion-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Basílica de la Inmaculada Concepción y centro'
    },
    {
        slug: 'isla-puerto-espacios-deportivos-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Isla del Puerto y espacios deportivos'
    },
    {
        slug: 'costanera-isla-puerto-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Costanera Isla del Puerto'
    },
    {
        slug: 'plaza-ramirez-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Plaza General Francisco Ramírez'
    },
    {
        slug: 'balneario-itape-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Balneario Itapé'
    },
    {
        slug: 'palacio-san-jose-cdu',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Palacio San José',
        street: 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)'
    },
    {
        slug: 'concepcion-del-uruguay-centro',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Concepción del Uruguay'
    },
    // --- Colón (2 locations) ---
    {
        slug: 'balneario-inkier-zona-costera-colon',
        destinationSlug: 'colon',
        placeName: 'Balneario Inkier, Puerto y zona costera'
    },
    {
        slug: 'parque-quiros-colon',
        destinationSlug: 'colon',
        placeName: 'Parque Quirós'
    },
    // --- San José (1 location) ---
    {
        slug: 'balneario-san-jose',
        destinationSlug: 'san-jose',
        placeName: 'Balneario San José'
    },
    // --- Federación (2 locations) ---
    {
        slug: 'anfiteatro-garcilazo-federacion',
        destinationSlug: 'federacion',
        placeName: 'Anfiteatro Juancho Garcilazo'
    },
    {
        slug: 'federacion-centro',
        destinationSlug: 'federacion',
        placeName: 'Federación'
    },
    // --- Concordia (3 locations) ---
    {
        slug: 'corsodromo-bonfiglio-concordia',
        destinationSlug: 'concordia',
        placeName: 'Corsódromo Atanasio Bonfiglio'
    },
    {
        slug: 'concordia-centro',
        destinationSlug: 'concordia',
        placeName: 'Concordia'
    },
    {
        slug: 'entorno-salto-grande-concordia',
        destinationSlug: 'concordia',
        placeName: 'Entorno de Salto Grande'
    },
    // --- Pueblo Liebig (2 locations) ---
    {
        slug: 'pueblo-liebig-centro',
        destinationSlug: 'liebig',
        placeName: 'Pueblo Liebig',
        street: 'Calle 17 de Mayo s/n'
    },
    {
        slug: 'predio-municipal-liebig',
        destinationSlug: 'liebig',
        placeName: 'Predio Municipal de Pueblo Liebig'
    },
    // --- Ubajay (2 locations) ---
    {
        slug: 'ubajay-centro',
        destinationSlug: 'ubajay',
        placeName: 'Ubajay'
    },
    {
        slug: 'centro-educativo-311-ubajay',
        destinationSlug: 'ubajay',
        placeName: 'Centro Educativo N.º 311, Barrio Rosario'
    },
    // --- Urdinarrain (2 locations) ---
    {
        slug: 'urdinarrain-centro',
        destinationSlug: 'urdinarrain',
        placeName: 'Urdinarrain'
    },
    {
        slug: 'polideportivo-municipal-urdinarrain',
        destinationSlug: 'urdinarrain',
        placeName: 'Polideportivo Municipal'
    },
    // --- Larroque (1 location, shared by 3 events) ---
    {
        slug: 'larroque-centro',
        destinationSlug: 'larroque',
        placeName: 'Larroque'
    },
    // --- San Salvador (1 location, REUSED slug from 0025) ---
    {
        slug: 'san-salvador-centro',
        destinationSlug: 'san-salvador',
        placeName: 'San Salvador (Capital Nacional del Arroz)'
    },
    // --- Santa Ana (2 locations) ---
    {
        slug: 'santa-ana-centro',
        destinationSlug: 'santa-ana',
        placeName: 'Santa Ana'
    },
    {
        slug: 'camping-municipal-santa-ana',
        destinationSlug: 'santa-ana',
        placeName: 'Camping Municipal'
    },
    // --- Villa Paranacito (1 location, REUSED slug from 0025) ---
    {
        slug: 'villa-paranacito-centro',
        destinationSlug: 'paranacito',
        placeName: 'Villa Paranacito'
    },
    // --- Ibicuy (2 locations) ---
    {
        slug: 'ibicuy-centro',
        destinationSlug: 'ibicuy',
        placeName: 'Ibicuy'
    },
    {
        slug: 'ibicuy-costa-rio',
        destinationSlug: 'ibicuy',
        placeName: 'Ibicuy (junto al río)'
    },
    // --- Gualeguay (1 location) ---
    {
        slug: 'corsodromo-gualeguay',
        destinationSlug: 'gualeguay',
        placeName: 'Corsódromo de Gualeguay'
    },
    // --- San Justo (2 locations) ---
    {
        slug: 'san-justo-centro',
        destinationSlug: 'san-justo',
        placeName: 'San Justo'
    },
    {
        slug: 'plaza-urquiza-san-justo',
        destinationSlug: 'san-justo',
        placeName: 'Plaza Justo José de Urquiza'
    },
    // --- Caseros (1 location) ---
    {
        slug: 'predio-ferrocarril-caseros',
        destinationSlug: 'caseros',
        placeName: 'Predio del Ferrocarril'
    }
] as const;

/** One tourist event, linked to a {@link LocationSeed} by `locationSlug`. */
interface EventSeed {
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly category: EventCategoryEnum;
    readonly date: {
        readonly start: string;
        readonly end?: string;
        readonly isAllDay: boolean;
        /** Omit for a real, fully-known day (schema default `EXACT`). */
        readonly precision?: EventDatePrecisionEnum;
    };
    readonly pricing?: { readonly isFree: boolean };
    readonly locationSlug: string;
    readonly seo: { readonly title: string; readonly description: string };
}

const ESTIMATED_DATE_NOTE =
    '*La fecha es una estimación basada en ediciones anteriores; la programación oficial se confirmará más cerca del evento.*';

const EVENTS: readonly EventSeed[] = [
    // ============================= Concepción del Uruguay =============================
    {
        slug: 'novembeer-concepcion-del-uruguay-2026',
        name: 'Novembeer',
        summary:
            'Festival de cerveza artesanal en Concepción del Uruguay, con gastronomía, emprendedores y música en vivo durante un fin de semana largo de noviembre. Entrada libre.',
        description: `Concepción del Uruguay, a orillas del río Uruguay, vive cada primavera una escena de cerveza artesanal en crecimiento, y **Novembeer** es su vidriera anual: un festival pensado para disfrutar al aire libre en el Predio Multieventos durante un fin de semana largo.

La propuesta reúne:

- Cerveza artesanal de productores de la región
- Puestos de gastronomía
- Emprendedores locales
- Música en vivo desde media tarde

La edición 2025 se desarrolló durante un fin de semana largo de noviembre, con jornadas desde las 19:00 y entrada libre.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.GASTRONOMY,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        pricing: { isFree: true },
        locationSlug: 'predio-multieventos-cdu',
        seo: {
            title: 'Novembeer 2026 en Concepción del Uruguay',
            description:
                'En noviembre de 2026 (estimado), el Predio Multieventos recibe Novembeer: cerveza artesanal, gastronomía y música en vivo.'
        }
    },
    {
        slug: 'circuito-natacion-aguas-abiertas-rio-uruguay-2026',
        name: 'Circuito de Natación en Aguas Abiertas del Río Uruguay',
        summary:
            'Competencia de natación en aguas abiertas del río Uruguay, con nadadores de Argentina y Uruguay, en la Costa e Isla del Puerto de Concepción del Uruguay.',
        description: `El río Uruguay es uno de los grandes protagonistas de Concepción del Uruguay, y el **Circuito de Natación en Aguas Abiertas del Río Uruguay** aprovecha ese escenario natural para una competencia que cruza la frontera entre Argentina y Uruguay.

La prueba se desarrolla en la zona de la Costa e Isla del Puerto, con:

- Participación de deportistas de Argentina y Uruguay
- Distintas categorías de nado en aguas abiertas
- Largada y llegada sobre la costanera

Una cita deportiva que combina el atractivo del río con el espíritu binacional que caracteriza a buena parte del calendario deportivo de la ciudad.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'costa-isla-puerto-cdu',
        seo: {
            title: 'Circuito de Natación en Aguas Abiertas 2026',
            description:
                'En noviembre de 2026 (estimado), nadadores de Argentina y Uruguay compiten en aguas abiertas del río Uruguay, en Concepción del Uruguay.'
        }
    },
    {
        slug: 'lanzamiento-temporada-verano-concepcion-del-uruguay-2026',
        name: 'Lanzamiento de la temporada de verano 2026/2027',
        summary:
            'Presentación oficial de playas, servicios turísticos y propuestas culturales, deportivas y recreativas de la temporada de verano en Concepción del Uruguay.',
        description: `Con la llegada de diciembre, Concepción del Uruguay abre formalmente su temporada de playas sobre el río Uruguay, uno de los principales atractivos turísticos de la ciudad durante el verano.

El **lanzamiento de la temporada de verano 2026/2027** presenta oficialmente:

- Las playas de Isla del Puerto y Banco Pelay
- Los servicios turísticos disponibles en la costanera
- La agenda cultural, deportiva y recreativa del verano

Es el puntapié inicial de varios meses de actividad turística en la ciudad, que continúan con el Carnaval y la Fiesta Nacional de la Playa de Río.

${ESTIMATED_DATE_NOTE}

Fuente: [concepcionentrerios.tur.ar](https://concepcionentrerios.tur.ar/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-12-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'isla-puerto-banco-pelay-costanera-cdu',
        seo: {
            title: 'Lanzamiento de verano en Concepción del Uruguay',
            description:
                'En diciembre de 2026 (estimado), Concepción del Uruguay presenta playas, servicios turísticos y agenda cultural y deportiva del verano.'
        }
    },
    {
        slug: 'actividades-inmaculada-concepcion-cdu-2026',
        name: 'Actividades por la Inmaculada Concepción',
        summary:
            'Celebraciones por la patrona de Concepción del Uruguay, con actividades religiosas y culturales en la Basílica y el centro de la ciudad, el 8 de diciembre.',
        description: `La **Inmaculada Concepción** es la patrona de la ciudad que lleva su nombre, y cada 8 de diciembre Concepción del Uruguay celebra su día con una jornada que combina fe y vida comunitaria en torno a la Basílica.

La celebración incluye:

- Actividades religiosas en la Basílica de la Inmaculada Concepción
- Propuestas culturales en el centro de la ciudad
- Participación de instituciones y vecinos

Una fecha fija en el calendario local, con historia propia y fuerte identidad para la comunidad.

Fuente: [concepcionentrerios.tur.ar](https://concepcionentrerios.tur.ar/)`,
        category: EventCategoryEnum.CULTURE,
        date: { start: '2026-12-08T00:00:00-03:00', isAllDay: true },
        locationSlug: 'basilica-inmaculada-concepcion-cdu',
        seo: {
            title: 'Inmaculada Concepción en Concepción del Uruguay',
            description:
                'El 8 de diciembre de 2026, la ciudad celebra a su patrona con actividades religiosas y culturales en la Basílica y el centro.'
        }
    },
    {
        slug: 'fiesta-nacional-playa-de-rio-2027',
        name: 'Fiesta Nacional de la Playa de Río 2027',
        summary:
            'Principal evento musical y turístico de Concepción del Uruguay, con artistas nacionales, bandas locales, feria y gastronomía durante varias noches de enero.',
        description: `La **Fiesta Nacional de la Playa de Río** es, desde hace años, el evento musical y turístico más convocante de Concepción del Uruguay, con varias noches consecutivas de espectáculos en el Predio Multieventos.

La propuesta reúne habitualmente:

- Artistas nacionales en el escenario principal
- Bandas y músicos locales
- Feria de artesanos y emprendedores
- Puestos de gastronomía

La edición 2026 se realizó del 14 al 18 de enero, con cinco a seis noches de actividad y competencias asociadas como parte de la agenda deportiva del evento.

${ESTIMATED_DATE_NOTE}

Fuente: [fiestadelaplayaderio.com.ar](https://www.fiestadelaplayaderio.com.ar/)`,
        category: EventCategoryEnum.MUSIC,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'predio-multieventos-cdu',
        seo: {
            title: 'Fiesta Nacional de la Playa de Río 2027',
            description:
                'En enero de 2027 (estimado), el Predio Multieventos recibe el principal festival musical y turístico de Concepción del Uruguay.'
        }
    },
    {
        slug: 'agenda-deportiva-fiesta-playa-de-rio-2027',
        name: 'Agenda deportiva de la Fiesta de la Playa 2027',
        summary:
            'Rugby seven, beach vóley, fútbol playa, aguas abiertas, atletismo y pesca, como parte de la agenda deportiva de la Fiesta Nacional de la Playa de Río.',
        description: `Además de su costado musical, la Fiesta Nacional de la Playa de Río tiene una fuerte agenda deportiva propia, desplegada en la Isla del Puerto y otros espacios deportivos de Concepción del Uruguay.

La agenda incluye disciplinas como:

- Rugby seven
- Beach vóley
- Fútbol playa
- Aguas abiertas
- Atletismo
- Pesca

La edición 2025 se desarrolló del 11 al 18 de enero, con la participación de diez instituciones deportivas de la ciudad.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'isla-puerto-espacios-deportivos-cdu',
        seo: {
            title: 'Agenda deportiva de la Fiesta de la Playa 2027',
            description:
                'En enero de 2027 (estimado), rugby seven, beach vóley, aguas abiertas y más disciplinas se disputan en Concepción del Uruguay.'
        }
    },
    {
        slug: 'apertura-carnaval-concepcion-del-uruguay-2027',
        name: 'Apertura del Carnaval y presentación de comparsas',
        summary:
            'Lanzamiento oficial del Carnaval de Concepción del Uruguay, con la presentación de las comparsas en la Costanera Isla del Puerto.',
        description: `Antes de que el Carnaval tome el Predio Multieventos, Concepción del Uruguay realiza su acto de apertura sobre la Costanera Isla del Puerto, donde se presentan oficialmente las comparsas que competirán en la temporada.

El evento reúne:

- La presentación de las comparsas participantes
- Actividades sobre la costanera
- El anuncio oficial del calendario de corsos

La edición 2026 se realizó el 11 de enero en la Costanera Isla del Puerto.

${ESTIMATED_DATE_NOTE}

Fuente: [lapiramide.net](https://www.lapiramide.net/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'costanera-isla-puerto-cdu',
        seo: {
            title: 'Apertura del Carnaval en Concepción del Uruguay',
            description:
                'En enero de 2027 (estimado), la Costanera Isla del Puerto recibe la apertura oficial del Carnaval y la presentación de comparsas.'
        }
    },
    {
        slug: 'carnaval-concepcion-del-uruguay-2027',
        name: 'Carnaval de Concepción del Uruguay 2027',
        summary:
            'Corsos con las comparsas Aimará, Urugua-í y Unidos do Bahia, en el Predio Multieventos de Concepción del Uruguay, durante varias noches de febrero.',
        description: `El Carnaval es una de las tradiciones más arraigadas de Concepción del Uruguay, con corsos que reúnen a miles de personas en el Predio Multieventos durante varias noches de febrero.

Compiten habitualmente las comparsas:

- Aimará
- Urugua-í
- Unidos do Bahia

La edición 2026 se desarrolló en cinco fechas: 7, 14, 16, 21 y 28 de febrero.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-02-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'predio-multieventos-cdu',
        seo: {
            title: 'Carnaval de Concepción del Uruguay 2027',
            description:
                'En febrero de 2027 (estimado), las comparsas Aimará, Urugua-í y Unidos do Bahia compiten en el Predio Multieventos.'
        }
    },
    {
        slug: 'concepcion-beer-fiesta-cerveza-artesanal-2027',
        name: 'Concepción Beer, Fiesta de la Cerveza Artesanal 2027',
        summary:
            'Festival gratuito de cerveza artesanal, gastronomía, música y propuestas infantiles en la Plaza General Francisco Ramírez de Concepción del Uruguay.',
        description: `Con más de una década de historia, **Concepción Beer** es la otra gran cita cervecera de la ciudad, esta vez en pleno centro, sobre la Plaza General Francisco Ramírez.

El festival, de entrada gratuita, incluye:

- Cerveza artesanal de productores regionales
- Puestos de gastronomía
- Música en vivo
- Propuestas para el público infantil
- Espacio para emprendedores

La edición 2026 fue la 18.ª y se realizó el 15 de febrero.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.GASTRONOMY,
        date: {
            start: '2027-02-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        pricing: { isFree: true },
        locationSlug: 'plaza-ramirez-cdu',
        seo: {
            title: 'Concepción Beer: Fiesta de la Cerveza 2027',
            description:
                'En febrero de 2027 (estimado), la Plaza Ramírez recibe cerveza artesanal, gastronomía y música en vivo, con entrada gratuita.'
        }
    },
    {
        slug: 'festival-costa-a-costa-concepcion-del-uruguay-2027',
        name: 'Festival de Costa a Costa',
        summary:
            'Festival cultural y musical del fin de semana de Carnaval, en el Balneario Itapé de Concepción del Uruguay, parte de la agenda estival de la ciudad.',
        description: `El Balneario Itapé suma su propia propuesta a la agenda estival de Concepción del Uruguay con el **Festival de Costa a Costa**, pensado para el fin de semana de Carnaval.

La propuesta combina:

- Espectáculos musicales
- Actividades culturales
- Aprovechamiento del entorno costero del balneario

Un complemento a los corsos del Predio Multieventos, pensado para quienes buscan una alternativa junto al río durante el fin de semana de Carnaval.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.MUSIC,
        date: {
            start: '2027-02-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'balneario-itape-cdu',
        seo: {
            title: 'Festival de Costa a Costa en Concepción del Uruguay',
            description:
                'En febrero de 2027 (estimado), el Balneario Itapé recibe un festival musical y cultural durante el fin de semana de Carnaval.'
        }
    },
    {
        slug: 'conmemoracion-batalla-de-caseros-2027',
        name: 'Conmemoración de la Batalla de Caseros',
        summary:
            'Acto histórico y protocolar por el aniversario de la Batalla de Caseros, en el Palacio San José, antigua residencia de Justo José de Urquiza.',
        description: `El **Palacio San José**, antigua residencia del gobernador entrerriano y presidente Justo José de Urquiza, fue el punto de partida del Ejército Grande hacia la Batalla de Caseros, y cada 3 de febrero el sitio recuerda ese episodio con un acto conmemorativo.

La jornada incluye:

- Acto protocolar y cultural
- Participación de instituciones locales
- Actividades vinculadas a la figura de Urquiza

La edición 2026 marcó el 174.º aniversario de la batalla. El Palacio, ubicado en zona rural del departamento Uruguay, funciona hoy como Museo y Monumento Histórico Nacional.

Fuente: [museourquiza.cultura.gob.ar](https://museourquiza.cultura.gob.ar/ver-noticias/)`,
        category: EventCategoryEnum.CULTURE,
        date: { start: '2027-02-03T00:00:00-03:00', isAllDay: true },
        locationSlug: 'palacio-san-jose-cdu',
        seo: {
            title: 'Conmemoración de la Batalla de Caseros',
            description:
                'El 3 de febrero de 2027, el Palacio San José recuerda con un acto protocolar el aniversario de la Batalla de Caseros.'
        }
    },
    {
        slug: 'maraton-tecnologica-utn-concepcion-del-uruguay-2026',
        name: 'Maratón Tecnológica UTN',
        summary:
            'Maratón que forma parte del circuito regional de carreras, organizada por la UTN en Concepción del Uruguay.',
        description: `La **Maratón Tecnológica UTN** es una de las carreras que integran el activo circuito de maratones de Concepción del Uruguay, organizada en el marco de la Universidad Tecnológica Nacional.

La prueba se desarrolla:

- Por las calles de Concepción del Uruguay
- Como parte del circuito regional de maratones cronometradas
- Con distintas categorías de participación

La edición 2025 se corrió el 9 de agosto, dentro de la agenda anual de carreras que organiza la ciudad junto a otras entidades deportivas locales.

${ESTIMATED_DATE_NOTE}

Fuente: [cronofrancolini.com.ar](https://www.cronofrancolini.com.ar/)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2026-08-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'concepcion-del-uruguay-centro',
        seo: {
            title: 'Maratón Tecnológica UTN en Concepción del Uruguay',
            description:
                'En agosto de 2026 (estimado), la UTN organiza una nueva edición de su maratón dentro del circuito regional de carreras.'
        }
    },
    {
        slug: 'maraton-solidaria-alcec-concepcion-del-uruguay-2026',
        name: 'Maratón Solidaria ALCEC',
        summary:
            'Evento deportivo y solidario a beneficio de ALCEC, recurrente en el calendario de carreras de Concepción del Uruguay.',
        description: `La **Maratón Solidaria ALCEC** combina deporte y colaboración con la Asociación de Lucha Contra el Cáncer, y es una de las citas fijas del calendario de carreras de Concepción del Uruguay.

La prueba incluye:

- Recorrido por la ciudad
- Distintas categorías de participación
- Recaudación a beneficio de ALCEC

La edición 2026 se corrió el sábado 5 de septiembre, en el marco del 60.º aniversario de "Todos Somos ALCEC".

${ESTIMATED_DATE_NOTE}

Fuente: [cronofrancolini.com.ar](https://www.cronofrancolini.com.ar/)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2026-09-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'concepcion-del-uruguay-centro',
        seo: {
            title: 'Maratón Solidaria ALCEC en Concepción del Uruguay',
            description:
                'En septiembre de 2026 (estimado), la Maratón Solidaria ALCEC combina deporte y colaboración con la lucha contra el cáncer.'
        }
    },
    {
        slug: 'festejos-de-primavera-concepcion-del-uruguay-2026',
        name: 'Festejos de Primavera en Concepción del Uruguay 2026',
        summary:
            'Música, juventud, propuestas recreativas, gastronomía y actividades al aire libre para celebrar la llegada de la primavera en Concepción del Uruguay.',
        description: `Cada septiembre, Concepción del Uruguay celebra la llegada de la primavera con una agenda pensada especialmente para el público joven, combinando música y actividades al aire libre.

La propuesta incluye:

- Espectáculos musicales
- Actividades recreativas para jóvenes
- Gastronomía
- Propuestas al aire libre en distintos puntos de la ciudad

Una agenda que da inicio a la temporada de eventos de primavera-verano que la ciudad despliega hasta el Carnaval.

${ESTIMATED_DATE_NOTE}

Fuente: [cdeluruguay.gob.ar](https://www.cdeluruguay.gob.ar/gobierno/noticias)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-09-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'concepcion-del-uruguay-centro',
        seo: {
            title: 'Festejos de Primavera en Concepción del Uruguay',
            description:
                'En septiembre de 2026 (estimado), música, gastronomía y actividades al aire libre celebran la llegada de la primavera.'
        }
    },
    {
        slug: 'actividades-primavera-palacio-san-jose-2026',
        name: 'Actividades culturales de primavera en el Palacio San José',
        summary:
            'Actividades especiales, encuentros educativos y propuestas familiares por la llegada de la primavera en el Palacio San José, departamento Uruguay.',
        description: `El Palacio San José, antigua residencia de Justo José de Urquiza y hoy Museo y Monumento Histórico Nacional, suma cada primavera una agenda de actividades especiales abierta a familias y escuelas.

La propuesta incluye habitualmente:

- Encuentros educativos con grupos escolares
- Celebraciones y recreaciones históricas
- Música y propuestas familiares
- Actividades plásticas y talleres

El Palacio se ubica en zona rural del departamento Uruguay, sobre la Ruta Provincial N.º 39, y su agenda de primavera suele articularse con la propuesta turística de Concepción del Uruguay, la ciudad cabecera del departamento.

${ESTIMATED_DATE_NOTE}

Fuente: [museourquiza.cultura.gob.ar](https://museourquiza.cultura.gob.ar/ver-noticias/)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2026-09-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'palacio-san-jose-cdu',
        seo: {
            title: 'Actividades de primavera en el Palacio San José',
            description:
                'En septiembre de 2026 (estimado), el Palacio San José organiza encuentros educativos y actividades familiares de primavera.'
        }
    },
    // ============================================= Colón =============================================
    {
        slug: 'lanzamiento-temporada-verano-colon-2026',
        name: 'Lanzamiento de la temporada de verano en Colón',
        summary:
            'Presentación de la temporada de playas en Colón, con música, actividades recreativas, gastronomía, ferias y servicios de playa en la zona costera.',
        description: `Colón, una de las ciudades balnearias más visitadas de la costa del río Uruguay en Entre Ríos, abre cada diciembre su temporada de playas con un evento que presenta la oferta turística del verano.

El lanzamiento incluye:

- Presentación de los balnearios, con eje en Balneario Inkier
- Actividades recreativas y musicales
- Ferias y gastronomía
- Presentación de los servicios de playa disponibles

El acto marca el comienzo formal de la temporada alta en una ciudad que combina playas de arena, termas y un centro turístico consolidado.

${ESTIMATED_DATE_NOTE}

Fuente: [colon.gov.ar](https://colon.gov.ar/category/turismo/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-12-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'balneario-inkier-zona-costera-colon',
        seo: {
            title: 'Lanzamiento de la temporada de verano en Colón',
            description:
                'En diciembre de 2026 (estimado), Colón presenta sus balnearios, ferias, gastronomía y servicios de playa para el verano.'
        }
    },
    {
        slug: 'fiesta-nacional-artesania-colon-2027',
        name: 'Fiesta Nacional de la Artesanía 2027',
        summary:
            'Uno de los eventos más importantes de Entre Ríos: artesanos de todo el país, espectáculos nacionales, gastronomía y muestras de oficios en el Parque Quirós.',
        description: `La **Fiesta Nacional de la Artesanía** es una de las citas culturales más importantes del calendario de Entre Ríos, y convierte al Parque Quirós de Colón en punto de encuentro de artesanos de todo el país.

La fiesta reúne:

- Artesanos de distintas provincias argentinas
- Espectáculos musicales nacionales
- Gastronomía regional
- Muestras y demostraciones de oficios tradicionales

Su prestigio nacional la posiciona como uno de los grandes atractivos turísticos del verano en Colón, junto a las termas y las playas de la ciudad.

${ESTIMATED_DATE_NOTE}

Fuente: [colonturismo.tur.ar](https://www.colonturismo.tur.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-02-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'parque-quiros-colon',
        seo: {
            title: 'Fiesta Nacional de la Artesanía en Colón 2027',
            description:
                'En febrero de 2027 (estimado), el Parque Quirós recibe artesanos de todo el país, espectáculos y gastronomía en Colón.'
        }
    },
    // ============================================ San José ============================================
    {
        slug: 'fiesta-provincial-campamentista-2027',
        name: 'Fiesta Provincial del Campamentista 2027',
        summary:
            'Festival de verano con música, gastronomía, actividades familiares y deportes acuáticos, en el Balneario San José, con más de 20.000 visitantes.',
        description: `San José celebra cada enero uno de los eventos de verano más convocantes del departamento Colón: la **Fiesta Provincial del Campamentista**, en el Balneario San José, a orillas del río Uruguay.

La propuesta reúne:

- Espectáculos musicales
- Gastronomía
- Actividades familiares
- Deportes acuáticos, entre ellos el Acuatlón del Campamentista

La edición 2026 se realizó del 9 al 11 de enero y convocó a más de 20.000 personas.

${ESTIMATED_DATE_NOTE}

Fuente: [sanjose.gob.ar](https://sanjose.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'balneario-san-jose',
        seo: {
            title: 'Fiesta Provincial del Campamentista 2027',
            description:
                'En enero de 2027 (estimado), el Balneario San José recibe música, gastronomía y deportes acuáticos para toda la familia.'
        }
    },
    {
        slug: 'acuatlon-del-campamentista-2027',
        name: 'Acuatlón del Campamentista 2027',
        summary:
            'Competencia combinada de natación y running, individual y por postas, en el Balneario San José, asociada a la Fiesta Provincial del Campamentista.',
        description: `Dentro de la Fiesta Provincial del Campamentista, San José suma una prueba deportiva propia: el **Acuatlón del Campamentista**, que combina natación en el río Uruguay y una posta de running por el balneario.

La competencia contempla:

- Modalidad individual
- Modalidad por postas o equipos
- Distintas categorías de participación

Se desarrolla en simultáneo con la fiesta de verano de San José, sumando una propuesta deportiva a la agenda cultural y musical del fin de semana.

${ESTIMATED_DATE_NOTE}

Fuente: [sanjose.gob.ar](https://sanjose.gob.ar/)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'balneario-san-jose',
        seo: {
            title: 'Acuatlón del Campamentista en San José 2027',
            description:
                'En enero de 2027 (estimado), natación y running se combinan en el Acuatlón del Campamentista, en el Balneario San José.'
        }
    },
    // =========================================== Federación ===========================================
    {
        slug: 'fiesta-nacional-del-lago-federacion-2027',
        name: 'Fiesta Nacional del Lago 2027',
        summary:
            'Festival nacional con varias noches de música en el Anfiteatro Juancho Garcilazo de Federación, con artistas regionales y nacionales.',
        description: `Federación, la ciudad reconstruida a orillas del Lago de Salto Grande y conocida por sus aguas termales, celebra cada enero su fiesta mayor: la **Fiesta Nacional del Lago**, en el Anfiteatro Juancho Garcilazo.

El festival se desarrolla en cuatro jornadas, con:

- Espectáculos musicales de artistas regionales y nacionales
- Gastronomía
- Actividades para toda la familia

Es el evento que concentra la mayor convocatoria turística del verano en Federación, en una ciudad que combina el Lago de Salto Grande, el Parque Acuático y el complejo termal.

${ESTIMATED_DATE_NOTE}

Fuente: [federacion.tur.ar](https://www.federacion.tur.ar/fiesta-nacional-del-lago/)`,
        category: EventCategoryEnum.MUSIC,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'anfiteatro-garcilazo-federacion',
        seo: {
            title: 'Fiesta Nacional del Lago en Federación 2027',
            description:
                'En enero de 2027 (estimado), el Anfiteatro Juancho Garcilazo recibe cuatro noches de música nacional y regional en Federación.'
        }
    },
    {
        slug: 'carnaval-federaense-2027',
        name: 'Carnaval Federaense 2027',
        summary:
            'Carnaval local de Federación, con comparsas, batucadas, música y propuestas pensadas para los turistas que visitan la ciudad en enero.',
        description: `En paralelo a la Fiesta Nacional del Lago, Federación despliega su propio **Carnaval Federaense**, con comparsas y batucadas que recorren la ciudad durante enero.

La celebración incluye:

- Desfile de comparsas
- Batucadas y música en vivo
- Actividades pensadas para el público turístico

Una propuesta que suma color y actividad nocturna a la agenda de verano de Federación, complementando el circuito termal y el Lago de Salto Grande.

${ESTIMATED_DATE_NOTE}

Fuente: [federacion.tur.ar](https://www.federacion.tur.ar/carnaval-federaense/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'federacion-centro',
        seo: {
            title: 'Carnaval Federaense en Federación 2027',
            description:
                'En enero de 2027 (estimado), comparsas y batucadas recorren Federación en el tradicional Carnaval Federaense.'
        }
    },
    // ============================================ Concordia ===========================================
    {
        slug: 'carnaval-de-concordia-2027',
        name: 'Carnaval de Concordia 2027',
        summary:
            'Uno de los carnavales más importantes del litoral: comparsas, carrozas y batucadas en el Corsódromo Atanasio Bonfiglio, con más de 100.000 visitantes.',
        description: `El **Carnaval de Concordia** es, junto con el de Gualeguaychú, uno de los más importantes del litoral argentino, con corsos que se realizan cada verano en el Corsódromo Atanasio Bonfiglio, con capacidad para 17.000 personas y una pista de 350 metros.

Compiten las comparsas:

- Bella Samba
- Emperatriz
- Imperio
- Ráfaga

En conjunto reúnen cerca de 2.000 integrantes en pista, y el evento convoca a más de 100.000 personas cada temporada, entre enero y febrero.

${ESTIMATED_DATE_NOTE}

Fuente: [concordia.gob.ar](https://www.concordia.gob.ar/carnaval)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'corsodromo-bonfiglio-concordia',
        seo: {
            title: 'Carnaval de Concordia 2027: fechas y comparsas',
            description:
                'En enero de 2027 (estimado), el Corsódromo Atanasio Bonfiglio recibe uno de los carnavales más importantes del litoral.'
        }
    },
    {
        slug: 'fiesta-nacional-citricultura-concordia-2026',
        name: 'Fiesta Nacional de la Citricultura 2026',
        summary:
            'Celebración de la producción citrícola regional: exposición, espectáculos, gastronomía y actividades productivas en Concordia.',
        description: `Concordia es el corazón de una de las regiones citrícolas más importantes de la Argentina, y la **Fiesta Nacional de la Citricultura** celebra esa identidad productiva con una agenda que combina exposición y espectáculos.

La fiesta incluye:

- Exposición de la producción citrícola regional
- Espectáculos en vivo
- Gastronomía
- Actividades vinculadas al sector productivo

Una celebración que pone en valor uno de los pilares económicos de la ciudad, en el marco de la agenda de eventos que Concordia despliega hacia fin de año.

${ESTIMATED_DATE_NOTE}

Fuente: [concordia.gob.ar](https://www.concordia.gob.ar/turismo/agenda)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-12-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'concordia-centro',
        seo: {
            title: 'Fiesta Nacional de la Citricultura en Concordia',
            description:
                'En diciembre de 2026 (estimado), Concordia celebra su identidad citrícola con exposición, espectáculos y gastronomía.'
        }
    },
    {
        slug: 'maraton-binacional-salto-grande-2027',
        name: 'Maratón Binacional de Salto Grande',
        summary:
            'Competencia que conecta el entorno de Salto Grande y reúne corredores argentinos y uruguayos, con distancias de 10, 21 y 42 kilómetros.',
        description: `La **Maratón Binacional de Salto Grande** es una de las pocas carreras del país que cruza una frontera internacional: su distancia mayor une las ciudades de Concordia, en Entre Ríos, y Salto, en Uruguay, a través de la represa de Salto Grande.

La prueba ofrece tres distancias:

- 10 km, aeróbica, para amateurs y familias
- 21 km, media maratón, en territorio uruguayo
- 42 km, maratón completa, que cruza ambas naciones

El recorrido atraviesa el corredor del río Uruguay y la región del Lago de Salto Grande, con la represa como punto emblemático del trazado.

${ESTIMATED_DATE_NOTE}

Fuente: [concordia.gob.ar](https://www.concordia.gob.ar/turismo/agenda/marat%C3%B3n-binacional-de-salto-grande)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2027-03-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'entorno-salto-grande-concordia',
        seo: {
            title: 'Maratón Binacional de Salto Grande 2027',
            description:
                'En marzo de 2027 (estimado), una carrera de hasta 42 km une Concordia y Salto a través de la represa de Salto Grande.'
        }
    },
    // ========================================= Pueblo Liebig ==========================================
    {
        slug: 'liebig-rural-tour-2026',
        name: 'Liebig Rural Tour 2026',
        summary:
            'Encuentro de autos y motos clásicas, Hot Rod, Rat Rod, bandas en vivo, artesanos y emprendedores en Pueblo Liebig, con más de 150 vehículos.',
        description: `Pueblo Liebig, la antigua colonia industrial construida en torno a la fábrica de extracto de carne más grande del mundo en su momento, es hoy sede de uno de los encuentros de autos clásicos más importantes del departamento Colón: el **Liebig Rural Tour**.

La edición reúne habitualmente:

- Más de 150 vehículos, entre Hot Rod, Rat Rod y clásicos
- Motos clásicas
- Bandas en vivo
- Artesanos y emprendedores locales
- Gastronomía

La 9.ª edición se realizó el 26 y 27 de julio de 2025, con entrada libre y gratuita, en el predio conocido históricamente como "la cocina más grande del mundo".

${ESTIMATED_DATE_NOTE}

Fuente: [sanjose.tur.ar](https://sanjose.tur.ar/events/liebig-rural-tour-9o-edicion/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-07-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        pricing: { isFree: true },
        locationSlug: 'pueblo-liebig-centro',
        seo: {
            title: 'Liebig Rural Tour 2026 en Pueblo Liebig',
            description:
                'En julio de 2026 (estimado), más de 150 autos y motos clásicas se reúnen en Pueblo Liebig, con entrada libre y gratuita.'
        }
    },
    {
        slug: 'fiesta-provincial-identidad-patrimonio-liebig-2027',
        name: 'Fiesta Provincial de la Identidad y el Patrimonio 2027',
        summary:
            'Celebra la identidad obrera, industrial y cultural de Pueblo Liebig: música, danza, gastronomía, artesanos y actividades comunitarias.',
        description: `Pueblo Liebig conserva una identidad muy particular, forjada por la histórica fábrica que le dio nombre y por las comunidades de trabajadores que allí se asentaron. La **Fiesta Provincial de la Identidad y el Patrimonio** celebra esa herencia obrera e industrial en el Predio Municipal.

La fiesta incluye:

- Música y danza
- Gastronomía local
- Artesanos
- Actividades comunitarias

La edición 2025 se realizó el 10 y 11 de enero, consolidando este encuentro como una de las citas culturales del departamento Colón.

${ESTIMATED_DATE_NOTE}

Fuente: [colonturismo.tur.ar](https://www.colonturismo.tur.ar/eventos/)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'predio-municipal-liebig',
        seo: {
            title: 'Fiesta de la Identidad y el Patrimonio en Liebig',
            description:
                'En enero de 2027 (estimado), Pueblo Liebig celebra su identidad obrera e industrial con música, danza y gastronomía.'
        }
    },
    // ============================================ Ubajay ==============================================
    {
        slug: 'fiesta-provincial-del-yatay-2026',
        name: 'Fiesta Provincial del Yatay 2026',
        summary:
            'Celebración de la cultura local y el paisaje de palmares de Ubajay, con música, cultura regional, gastronomía y emprendedores.',
        description: `Ubajay es conocida por su cercanía al Parque Nacional El Palmar y sus extensos palmares de yatay, y la **Fiesta Provincial del Yatay** celebra esa identidad paisajística con una agenda cultural propia.

La fiesta reúne:

- Música y espectáculos culturales
- Gastronomía regional
- Emprendedores locales
- Actividades relacionadas con la cultura del palmar

Un homenaje al entorno natural que distingue a Ubajay dentro del circuito turístico del norte de Entre Ríos.

${ESTIMATED_DATE_NOTE}

Fuente: [ubajay.gob.ar](https://ubajay.gob.ar/category/gobierno/cultura/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'ubajay-centro',
        seo: {
            title: 'Fiesta Provincial del Yatay en Ubajay 2026',
            description:
                'En noviembre de 2026 (estimado), Ubajay celebra su paisaje de palmares con música, gastronomía y emprendedores locales.'
        }
    },
    {
        slug: 'guiso-popular-de-ubajay-2026',
        name: 'Guiso Popular de Ubajay',
        summary:
            'Encuentro comunitario y gastronómico en el Centro Educativo N.º 311 del Barrio Rosario de Ubajay, pensado para disfrutar en familia.',
        description: `El **Guiso Popular de Ubajay** es un clásico encuentro comunitario del Barrio Rosario, organizado en el Centro Educativo N.º 311, pensado como una noche para compartir en familia o con amigos.

La propuesta incluye:

- Guiso popular compartido
- Encuentro comunitario en el barrio
- Actividades organizadas por la municipalidad

La edición anterior se realizó el 20 de agosto, desde las 20:00 horas.

${ESTIMATED_DATE_NOTE}

Fuente: [ubajay.gob.ar](https://ubajay.gob.ar/category/gobierno/cultura/)`,
        category: EventCategoryEnum.GASTRONOMY,
        date: {
            start: '2026-08-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'centro-educativo-311-ubajay',
        seo: {
            title: 'Guiso Popular de Ubajay 2026: encuentro',
            description:
                'En agosto de 2026 (estimado), el Barrio Rosario de Ubajay organiza un encuentro comunitario con guiso popular compartido.'
        }
    },
    // ========================================== Urdinarrain ===========================================
    {
        slug: 'feria-libro-infantil-alas-de-papel-2026',
        name: 'Feria del Libro Infantil "Alas de Papel" 2026',
        summary:
            'Feria de literatura infantil en Urdinarrain, con narración, talleres, editoriales y propuestas para escuelas y familias.',
        description: `Urdinarrain sostiene desde hace más de una década una de las ferias de literatura infantil más consolidadas de la región: **Alas de Papel**, pensada para acercar la lectura a chicos y familias.

La feria incluye:

- Narración de cuentos
- Talleres para chicos
- Stands de editoriales
- Propuestas especiales para escuelas

La 15.ª edición se realizó del 18 al 22 de septiembre de 2024, consolidando a Urdinarrain como sede de un evento cultural de referencia para las escuelas de la zona.

${ESTIMATED_DATE_NOTE}

Fuente: [urdinarrain.gov.ar](https://urdinarrain.gov.ar/v2/category/cultura/)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2026-09-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'urdinarrain-centro',
        seo: {
            title: 'Feria del Libro Infantil Alas de Papel',
            description:
                'En septiembre de 2026 (estimado), Urdinarrain recibe narración, talleres y editoriales en su feria de literatura infantil.'
        }
    },
    {
        slug: 'expo-ovina-urdinarrain-2026',
        name: 'Expo Ovina de Urdinarrain 2026',
        summary:
            'Exposición ganadera ovina en el Polideportivo Municipal de Urdinarrain, con productores, empresas, comercios, artesanos y gastronomía.',
        description: `La **Expo Ovina de Urdinarrain** pone en valor la producción ganadera ovina de la zona, con una muestra que combina el sector productivo y la propuesta comercial y gastronómica en el Polideportivo Municipal.

La exposición reúne:

- Productores y ejemplares ovinos
- Empresas y comercios locales
- Artesanos
- Gastronomía
- Actividades técnicas para el sector

La edición 2025 contó con más de 100 ejemplares ovinos y más de 70 puestos comerciales, y se realizó entre el 31 de octubre y el 1 de noviembre.

${ESTIMATED_DATE_NOTE}

Fuente: [urdinarrain.gov.ar](https://urdinarrain.gov.ar/v2/category/cultura/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-10-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'polideportivo-municipal-urdinarrain',
        seo: {
            title: 'Expo Ovina de Urdinarrain 2026',
            description:
                'En octubre de 2026 (estimado), el Polideportivo Municipal recibe productores, comercios y gastronomía en la Expo Ovina.'
        }
    },
    // ============================================ Larroque ============================================
    {
        slug: 'fiesta-de-la-tradicion-larroque-2026',
        name: 'Fiesta de la Tradición 2026',
        summary:
            'Celebración tradicionalista en Larroque con folklore, danza, gastronomía criolla y cultura rural del centro de Entre Ríos.',
        description: `Larroque, una localidad del centro de Entre Ríos con fuerte arraigo rural, celebra cada año su identidad tradicionalista con la **Fiesta de la Tradición**, dedicada al folklore y las costumbres criollas.

La celebración incluye:

- Espectáculos de folklore y danza
- Gastronomía criolla
- Actividades relacionadas con la cultura rural
- Participación de instituciones locales

Una fiesta que refuerza la identidad gauchesca de la localidad, en sintonía con otras celebraciones tradicionalistas del centro de la provincia.

${ESTIMATED_DATE_NOTE}

Fuente: [larroque.gob.ar](https://www.larroque.gob.ar/)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'larroque-centro',
        seo: {
            title: 'Fiesta de la Tradición en Larroque 2026',
            description:
                'En noviembre de 2026 (estimado), Larroque celebra el folklore y la cultura rural con danza y gastronomía criolla.'
        }
    },
    {
        slug: 'carnavaleando-larroque-2027',
        name: 'Carnavaleando Larroque 2027',
        summary:
            'Celebración de verano en Larroque vinculada al carnaval local, con música, baile y actividades populares para toda la comunidad.',
        description: `Larroque suma a su calendario de verano una propuesta popular de carnaval: **Carnavaleando Larroque**, pensada para animar las noches de enero con música y baile.

La propuesta incluye:

- Música en vivo
- Espacios de baile popular
- Actividades para toda la familia

Una fecha pensada para dinamizar la vida social del pueblo durante el verano, en línea con la agenda de festejos que Larroque despliega en esta época del año.

${ESTIMATED_DATE_NOTE}

Fuente: [larroque.gob.ar](https://www.larroque.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'larroque-centro',
        seo: {
            title: 'Carnavaleando Larroque 2027: carnaval de verano',
            description:
                'En enero de 2027 (estimado), Larroque anima sus noches de verano con música y baile popular en Carnavaleando Larroque.'
        }
    },
    {
        slug: 'larroque-pinta-2027',
        name: 'Larroque Pinta 2027',
        summary:
            'Evento cultural y recreativo de verano en Larroque, con propuestas artísticas y comunitarias para la temporada estival.',
        description: `**Larroque Pinta** es una propuesta cultural y recreativa que Larroque suma a su agenda de verano, pensada para dinamizar la vida cultural del pueblo durante enero.

La propuesta incluye:

- Actividades artísticas y culturales
- Espacios recreativos comunitarios
- Participación de instituciones y vecinos

Se enmarca en la agenda estival de la localidad, junto a Carnavaleando Larroque y la Fiesta de la Tradición.

${ESTIMATED_DATE_NOTE}

Fuente: [larroque.gob.ar](https://www.larroque.gob.ar/)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'larroque-centro',
        seo: {
            title: 'Larroque Pinta 2027: agenda cultural de verano',
            description:
                'En enero de 2027 (estimado), Larroque suma actividades artísticas y culturales a su agenda de verano con Larroque Pinta.'
        }
    },
    // =========================================== San Salvador ==========================================
    {
        slug: 'carnavales-de-san-salvador-2027',
        name: 'Carnavales de San Salvador 2027',
        summary:
            'Carnavales tradicionales de San Salvador, la Capital Nacional del Arroz, con el característico encierro de toros y décadas de historia.',
        description: `San Salvador, conocida como la Capital Nacional del Arroz, tiene en sus **Carnavales** una de sus tradiciones más singulares: el característico "encierro de toros", una representación festiva con décadas de historia en la ciudad.

La celebración incluye:

- El tradicional encierro de toros
- Corsos y actividades populares
- Participación de instituciones y comparsas locales

Una tradición muy particular dentro del mapa de carnavales de Entre Ríos, que distingue a San Salvador de otras propuestas de la provincia.

${ESTIMATED_DATE_NOTE}

Fuente: [sansalvadorer.gob.ar](https://sansalvadorer.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'san-salvador-centro',
        seo: {
            title: 'Carnavales de San Salvador 2027',
            description:
                'En enero de 2027 (estimado), San Salvador celebra sus carnavales tradicionales con el característico encierro de toros.'
        }
    },
    // ============================================ Santa Ana ===========================================
    {
        slug: 'fiesta-nacional-de-la-sandia-2027',
        name: 'Fiesta Nacional de la Sandía 2027',
        summary:
            'Celebración principal de Santa Ana: música, gastronomía, producción regional, emprendedores y actividades familiares, en enero.',
        description: `La sandía es uno de los cultivos que identifican a Santa Ana, y la **Fiesta Nacional de la Sandía** es la celebración más importante de la localidad, con una agenda pensada para toda la familia.

La fiesta reúne:

- Espectáculos musicales
- Gastronomía
- Exposición de la producción regional
- Emprendedores locales
- Actividades familiares

La edición 2026 se realizó del 16 al 18 de enero.

${ESTIMATED_DATE_NOTE}

Fuente: [santaana.gob.ar](https://www.santaana.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'santa-ana-centro',
        seo: {
            title: 'Fiesta Nacional de la Sandía en Santa Ana 2027',
            description:
                'En enero de 2027 (estimado), Santa Ana celebra su producción de sandía con música, gastronomía y actividades familiares.'
        }
    },
    {
        slug: 'apertura-temporada-verano-santa-ana-2026',
        name: 'Apertura de temporada de verano de Santa Ana',
        summary:
            'Lanzamiento turístico de la temporada de verano en Santa Ana, en el Camping Municipal, junto a la presentación de la Fiesta Nacional de la Sandía.',
        description: `Santa Ana abre su temporada de verano con un acto en el Camping Municipal, que además funciona como presentación oficial de la Fiesta Nacional de la Sandía del mes siguiente.

El lanzamiento incluye:

- Presentación de los servicios turísticos del Camping Municipal
- Adelanto de la agenda de verano
- Presentación oficial de la Fiesta Nacional de la Sandía

Un acto que marca el inicio formal de la temporada turística en esta localidad del departamento Colón.

${ESTIMATED_DATE_NOTE}

Fuente: [santaana.gob.ar](https://www.santaana.gob.ar/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-12-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'camping-municipal-santa-ana',
        seo: {
            title: 'Apertura de temporada de verano en Santa Ana',
            description:
                'En diciembre de 2026 (estimado), el Camping Municipal de Santa Ana presenta la temporada de verano y la Fiesta de la Sandía.'
        }
    },
    // ========================================== Villa Paranacito =======================================
    {
        slug: 'fiesta-provincial-carrozas-nauticas-2026',
        name: 'Fiesta Provincial de las Carrozas Náuticas 2026',
        summary:
            'Desfile de carrozas construidas sobre embarcaciones, con música, danza y actividades culturales, en Villa Paranacito, corazón del Delta entrerriano.',
        description: `En pleno Delta entrerriano, donde el agua marca buena parte de la vida cotidiana, Villa Paranacito celebra cada noviembre la **Fiesta Provincial de las Carrozas Náuticas**, un desfile único de carrozas iluminadas construidas sobre embarcaciones.

La fiesta incluye:

- Desfile nocturno de carrozas sobre el río
- Música y danza
- Elección de carrozas y representantes ganadoras
- Baile al aire libre de cierre

El evento nació en 1981, impulsado por estudiantes y docentes de una escuela local, y es Fiesta Provincial desde 1994.

${ESTIMATED_DATE_NOTE}

Fuente: [villaparanacito.gob.ar](https://www.villaparanacito.gob.ar/turismo/eventos)`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'villa-paranacito-centro',
        seo: {
            title: 'Fiesta de las Carrozas Náuticas en Paranacito',
            description:
                'En noviembre de 2026 (estimado), Villa Paranacito celebra un desfile nocturno de carrozas iluminadas sobre el río.'
        }
    },
    // ============================================= Ibicuy ==============================================
    {
        slug: 'fiesta-de-ibicuy-2026',
        name: 'Fiesta de Ibicuy 2026',
        summary:
            'Espectáculos musicales, gastronomía, emprendedores y actividades por el aniversario y la identidad de Ibicuy, en el extremo sur de Entre Ríos.',
        description: `Ibicuy, la localidad más austral de Entre Ríos, celebra cada año su identidad y aniversario con la **Fiesta de Ibicuy**, un encuentro que reúne a la comunidad y a visitantes de la zona.

La fiesta incluye:

- Espectáculos musicales
- Gastronomía
- Emprendedores locales
- Actividades comunitarias por el aniversario de la localidad

Un evento que refuerza la identidad de esta localidad ribereña del extremo sur de la provincia.

${ESTIMATED_DATE_NOTE}

Fuente: [ibicuy.gob.ar](https://www.ibicuy.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'ibicuy-centro',
        seo: {
            title: 'Fiesta de Ibicuy 2026: aniversario e identidad',
            description:
                'En noviembre de 2026 (estimado), Ibicuy celebra su aniversario e identidad con música, gastronomía y emprendedores.'
        }
    },
    {
        slug: 'festival-pescado-frito-chamarrita-ibicuy-2026',
        name: 'Festival del Pescado Frito y la Chamarrita',
        summary:
            'Festival folklórico y gastronómico junto al río en Ibicuy, dedicado al pescado frito y a la chamarrita, ritmo tradicional del litoral entrerriano.',
        description: `El río es protagonista de la vida de Ibicuy, y el **Festival del Pescado Frito y la Chamarrita** celebra esa identidad ribereña con una propuesta que combina gastronomía y folklore junto a la costa.

El festival reúne:

- Pescado frito como plato central
- Espectáculos de chamarrita, ritmo tradicional litoraleño
- Música y baile folklórico
- Gastronomía regional

Una fiesta que pone en valor tanto la pesca artesanal como el folklore propio del litoral, junto al río que atraviesa la localidad.

${ESTIMATED_DATE_NOTE}

Fuente: difusión municipal en redes sociales.`,
        category: EventCategoryEnum.GASTRONOMY,
        date: {
            start: '2026-09-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'ibicuy-costa-rio',
        seo: {
            title: 'Festival del Pescado Frito y la Chamarrita',
            description:
                'En septiembre de 2026 (estimado), Ibicuy celebra junto al río su identidad ribereña con pescado frito y chamarrita.'
        }
    },
    // ============================================ Gualeguay ===========================================
    {
        slug: 'carnaval-de-gualeguay-2027',
        name: 'Carnaval de Gualeguay 2027',
        summary:
            "Comparsas Si-Sí, K'rumbay y Samba Verá compiten en el Corsódromo de Gualeguay, uno de los principales atractivos estivales de la ciudad.",
        description: `Gualeguay, ciudad ribereña sobre el río homónimo, tiene en su Carnaval uno de los grandes atractivos turísticos del verano, con corsos en el Corsódromo local.

Compiten las comparsas:

- Si-Sí
- K'rumbay
- Samba Verá

Un carnaval que, junto al de Concordia y Gualeguaychú, forma parte del circuito de grandes carnavales del litoral entrerriano.

${ESTIMATED_DATE_NOTE}

Fuente: [gualeguay.gob.ar](https://www.gualeguay.gob.ar/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2027-01-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'corsodromo-gualeguay',
        seo: {
            title: 'Carnaval de Gualeguay 2027: comparsas y corsos',
            description:
                "En enero de 2027 (estimado), las comparsas Si-Sí, K'rumbay y Samba Verá compiten en el Corsódromo de Gualeguay."
        }
    },
    // ============================================ San Justo ============================================
    {
        slug: 'festival-de-las-instituciones-san-justo-2026',
        name: 'Festival de las Instituciones 2026',
        summary:
            'Encuentro comunitario con instituciones locales de San Justo, con música, gastronomía, emprendedores y actividades familiares.',
        description: `San Justo reúne cada año a sus instituciones locales en el **Festival de las Instituciones**, un encuentro comunitario que combina música, gastronomía y actividades para toda la familia.

El festival incluye:

- Participación de instituciones locales
- Espectáculos musicales
- Gastronomía
- Emprendedores
- Actividades familiares

Una jornada pensada para fortalecer los lazos comunitarios de esta localidad del centro de Entre Ríos.

${ESTIMATED_DATE_NOTE}

Fuente: difusión municipal en redes sociales.`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2026-11-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'san-justo-centro',
        seo: {
            title: 'Festival de las Instituciones en San Justo 2026',
            description:
                'En noviembre de 2026 (estimado), San Justo reúne a sus instituciones locales con música, gastronomía y actividades familiares.'
        }
    },
    {
        slug: 'aniversario-de-san-justo-2027',
        name: 'Aniversario de San Justo 2027',
        summary:
            'Celebración del aniversario de San Justo en la Plaza Justo José de Urquiza, con acto protocolar y actividades comunitarias desde la noche.',
        description: `Cada marzo, San Justo celebra su aniversario fundacional con un acto central en la Plaza Justo José de Urquiza, que reúne a instituciones y vecinos de la localidad.

La celebración incluye:

- Acto protocolar por el aniversario
- Participación de instituciones locales
- Actividades comunitarias nocturnas

La 146.ª edición se realizó el sábado 7 de marzo, desde las 20:00 horas.

${ESTIMATED_DATE_NOTE}

Fuente: difusión municipal en redes sociales.`,
        category: EventCategoryEnum.CULTURE,
        date: {
            start: '2027-03-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'plaza-urquiza-san-justo',
        seo: {
            title: 'Aniversario de San Justo 2027: acto central',
            description:
                'En marzo de 2027 (estimado), San Justo celebra su aniversario fundacional con un acto en la Plaza Justo José de Urquiza.'
        }
    },
    // ============================================= Caseros =============================================
    {
        slug: 'expo-agroindustrial-caseros-2026',
        name: 'Expo Agroindustrial Caseros 2026',
        summary:
            'Exposición agroindustrial en el Predio del Ferrocarril de Caseros, con empresas, productores, comercios, emprendedores, instituciones y gastronomía.',
        description: `Caseros, localidad rural del departamento Uruguay, despliega su propuesta productiva en la **Expo Agroindustrial Caseros**, realizada en el Predio del Ferrocarril.

La exposición reúne:

- Empresas y productores locales
- Comercios y emprendedores
- Instituciones de la localidad
- Gastronomía

La 2.ª edición se realizó el 13 y 14 de diciembre de 2025.

${ESTIMATED_DATE_NOTE}

Fuente: difusión municipal en redes sociales.`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-12-01T00:00:00.000Z',
            isAllDay: true,
            precision: EventDatePrecisionEnum.MONTH
        },
        locationSlug: 'predio-ferrocarril-caseros',
        seo: {
            title: 'Expo Agroindustrial Caseros 2026',
            description:
                'En diciembre de 2026 (estimado), el Predio del Ferrocarril de Caseros recibe una exposición agroindustrial con gastronomía.'
        }
    }
] as const;

/**
 * Resolves each entry in {@link DESTINATION_SLUGS} to its real database id,
 * throwing if any expected CITY destination is missing from this database.
 */
async function resolveDestinationIds(
    db: DrizzleClient
): Promise<ReadonlyMap<DestinationSlug, string>> {
    const rows = await db
        .select({ id: destinations.id, slug: destinations.slug })
        .from(destinations)
        .where(inArray(destinations.slug, [...DESTINATION_SLUGS]));

    const bySlug = new Map(rows.map((row) => [row.slug, row.id]));

    const missing = DESTINATION_SLUGS.filter((slug) => !bySlug.has(slug));
    if (missing.length > 0) {
        throw new Error(
            `0028-add-estimated-events-entre-rios: missing expected destination slug(s): ${missing.join(', ')}`
        );
    }

    return bySlug as ReadonlyMap<DestinationSlug, string>;
}

/**
 * Idempotently inserts one `event_locations` row (insert-or-fetch-existing by
 * unique `slug`), returning its id either way.
 */
async function upsertEventLocation(
    db: DrizzleClient,
    location: LocationSeed,
    destinationIdBySlug: ReadonlyMap<DestinationSlug, string>
): Promise<{ readonly id: string; readonly inserted: boolean }> {
    const destinationId = destinationIdBySlug.get(location.destinationSlug);
    if (!destinationId) {
        throw new Error(
            `0028-add-estimated-events-entre-rios: unresolved destination "${location.destinationSlug}" for location "${location.slug}"`
        );
    }

    const inserted = await db
        .insert(eventLocations)
        .values({
            slug: location.slug,
            destinationId,
            placeName: location.placeName,
            street: location.street ?? null,
            number: location.number ?? null,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        })
        .onConflictDoNothing({ target: eventLocations.slug })
        .returning({ id: eventLocations.id });

    if (inserted[0]) {
        return { id: inserted[0].id, inserted: true };
    }

    const [existing] = await db
        .select({ id: eventLocations.id })
        .from(eventLocations)
        .where(eq(eventLocations.slug, location.slug))
        .limit(1);

    if (!existing) {
        throw new Error(
            `0028-add-estimated-events-entre-rios: failed to insert or resolve event_location "${location.slug}"`
        );
    }

    return { id: existing.id, inserted: false };
}

/**
 * Idempotently inserts one `events` row (insert-or-skip by unique `slug`).
 */
async function upsertEvent(
    db: DrizzleClient,
    event: EventSeed,
    authorId: string,
    locationId: string,
    destinationId: string
): Promise<{ readonly inserted: boolean }> {
    const inserted = await db
        .insert(events)
        .values({
            slug: event.slug,
            name: event.name,
            summary: event.summary,
            description: event.description,
            category: event.category,
            date: {
                // The `events.date` jsonb column is typed `$type<EventDate>()`, whose
                // `start`/`end` are `Date` (the output type of `EventDateSchema`'s
                // string->Date transform), not the raw ISO strings authored in
                // `EventSeed` above — convert here so this satisfies that type and
                // stores a normalized value in the jsonb column either way.
                start: new Date(event.date.start),
                ...(event.date.end ? { end: new Date(event.date.end) } : {}),
                isAllDay: event.date.isAllDay,
                // `EventDate`'s inferred (output) type makes `precision` a
                // required property, since `EventDateSchema` resolves it via
                // `.optional().default(EXACT)` — the default is only applied
                // by zod at parse time, not by the jsonb column's `$type<>()`
                // cast, so this insert must supply it explicitly. Falls back
                // to `EXACT` for the 2 events that omit it in `EventSeed`.
                precision: event.date.precision ?? EventDatePrecisionEnum.EXACT
            },
            authorId,
            locationId,
            organizerId: null,
            destinationId,
            pricing: event.pricing ?? null,
            media: null,
            visibility: VisibilityEnum.PUBLIC,
            isFeatured: false,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            seo: event.seo
        })
        .onConflictDoNothing({ target: events.slug })
        .returning({ id: events.id });

    return { inserted: inserted.length > 0 };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const destinationIdBySlug = await resolveDestinationIds(ctx.db);

    let locationsInserted = 0;
    const locationIdBySlug = new Map<string, string>();
    for (const location of LOCATIONS) {
        const result = await upsertEventLocation(ctx.db, location, destinationIdBySlug);
        locationIdBySlug.set(location.slug, result.id);
        if (result.inserted) {
            locationsInserted += 1;
        }
    }

    let eventsInserted = 0;
    for (const event of EVENTS) {
        const locationSeed = LOCATIONS.find((location) => location.slug === event.locationSlug);
        if (!locationSeed) {
            throw new Error(
                `0028-add-estimated-events-entre-rios: event "${event.slug}" references unknown locationSlug "${event.locationSlug}"`
            );
        }
        const locationId = locationIdBySlug.get(event.locationSlug);
        const destinationId = destinationIdBySlug.get(locationSeed.destinationSlug);
        if (!locationId || !destinationId) {
            throw new Error(
                `0028-add-estimated-events-entre-rios: could not resolve location/destination ids for event "${event.slug}"`
            );
        }

        const result = await upsertEvent(ctx.db, event, ctx.actor.id, locationId, destinationId);
        if (result.inserted) {
            eventsInserted += 1;
        }
    }

    return {
        summary: `Inserted ${eventsInserted} of ${EVENTS.length} estimated (month-precision) Entre Ríos tourist events (rest already present), across ${locationsInserted} of ${LOCATIONS.length} newly-created event locations.`,
        counts: {
            eventsInserted,
            eventsAlreadyPresent: EVENTS.length - eventsInserted,
            locationsInserted,
            locationsAlreadyPresent: LOCATIONS.length - locationsInserted
        }
    };
}

/**
 * @fileoverview
 * Data migration: 0025-add-confirmed-events-entre-rios-2026
 *
 * Inserts 9 real, confirmed-date tourist events for the second half of 2026
 * across the Entre Ríos litoral, sourced from each event's official
 * municipal/tourism-board announcement (source link at the bottom of every
 * `description`).
 *
 * ## Scope decision: `group: 'example'`
 *
 * These are real-world tourist events, not synthetic demo content, but they
 * follow the `example` seed-data track (not `required`) because they are
 * time-bound calendar content rather than canonical system/catalog data —
 * the same classification every other `src/data/event/*.json` fixture uses.
 * Per `packages/seed/CLAUDE.md`'s dual-write guard exemption list, `events`
 * is one of the explicitly demo-exempt entities, so this migration alone
 * (no baseline JSON fixture edit) is a complete, compliant delta.
 *
 * ## Idempotency
 *
 * Both `event_locations` and `events` are upserted by their unique `slug`
 * via `onConflictDoNothing()`, with a follow-up `SELECT` to resolve the id
 * of a row that already existed (conflict path). Re-running this migration
 * is therefore a clean no-op on the second pass — required since the seed
 * runner does not re-run an already-ledgered migration, but the insert
 * logic itself must still tolerate re-application (e.g. a manual re-run
 * against a DB where the ledger row was hand-removed).
 *
 * ## Location sharing (one row per real venue, not per event)
 *
 * Events 6 (Festival de los 6 Cilindros) and 7 (Competición Especial
 * Entrerriana y Fórmula Entrerriana) both take place at the same physical
 * venue — the Autódromo de Concepción del Uruguay — across three different
 * weekends. Per the "one `event_locations` row per venue" rule, they share
 * a single location row (`autodromo-concepcion-del-uruguay`), so this
 * migration creates 8 location rows for 9 events, not 9.
 *
 * ## `destructive` flag decision
 *
 * `false` — this migration only ever INSERTs new rows (guarded by
 * `onConflictDoNothing` on each table's unique `slug`). It never updates or
 * deletes existing data, so the production destructive-migration gate does
 * not apply. (Not that it matters here — as an `example`-group migration it
 * never runs against production regardless.)
 */

import type { DrizzleClient } from '@repo/db';
import { destinations, eq, eventLocations, events, inArray } from '@repo/db';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0027-add-confirmed-events-entre-rios-2026',
    group: 'example',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The 7 CITY destination slugs this migration's venues/events resolve against. */
const DESTINATION_SLUGS = [
    'colon',
    'san-jose',
    'federacion',
    'concordia',
    'concepcion-del-uruguay',
    'san-salvador',
    'paranacito'
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
    {
        slug: 'puerto-de-colon',
        destinationSlug: 'colon',
        placeName: 'Puerto de Colón'
    },
    {
        slug: 'predio-sociedad-rural-colon',
        destinationSlug: 'colon',
        placeName: 'Predio de la Sociedad Rural de Colón',
        street: 'Ruta 130 km 37, Colonia San Miguel'
    },
    {
        slug: 'predio-multieventos-san-jose',
        destinationSlug: 'san-jose',
        placeName: 'Predio Multieventos de San José'
    },
    {
        slug: 'predio-parque-acuatico-federacion',
        destinationSlug: 'federacion',
        placeName: 'Predio frente al Parque Acuático de Federación'
    },
    {
        slug: 'parque-central-vinedos-moulins-concordia',
        destinationSlug: 'concordia',
        placeName: 'Parque Central Viñedos Moulins y Centro de Convenciones de Concordia'
    },
    {
        slug: 'autodromo-concepcion-del-uruguay',
        destinationSlug: 'concepcion-del-uruguay',
        placeName: 'Autódromo de Concepción del Uruguay'
    },
    {
        slug: 'san-salvador-centro',
        destinationSlug: 'san-salvador',
        placeName: 'San Salvador (Capital Nacional del Arroz)'
    },
    {
        slug: 'villa-paranacito-centro',
        destinationSlug: 'paranacito',
        placeName: 'Villa Paranacito'
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
    };
    readonly pricing?: { readonly isFree: boolean };
    readonly locationSlug: string;
    readonly seo: { readonly title: string; readonly description: string };
}

const EVENTS: readonly EventSeed[] = [
    {
        slug: 'feria-del-puerto-colon-2026',
        name: 'Feria del Puerto',
        summary:
            'Feria de vacaciones de invierno en el Puerto de Colón, con artesanías, productores, gastronomía y actividades para toda la familia. Entrada gratuita.',
        description: `Cada invierno, el **Puerto de Colón** se convierte en uno de los paseos más animados de la ciudad. Sobre la costa del río Uruguay, la zona portuaria recibe a familias y turistas con una feria a cielo abierto que reúne artesanos, productores y propuestas gastronómicas en pleno receso escolar.

La **Feria del Puerto** se desarrolla del **24 al 28 de julio de 2026**, desde las **10:00**, con una agenda pensada para recorrer sin apuro:

- Artesanías de artesanos de distintos puntos del país
- Puestos de productores regionales
- Gastronomía variada
- Espacio infantil especial
- Música en vivo gratuita, con artistas locales y regionales, desde media tarde
- Participación de emprendedores locales

Con **entrada gratuita** durante los cinco días, es una buena excusa para sumar el paseo por la costanera a un recorrido por las termas y el resto de los atractivos de Colón.

Fuente: [colonturismo.tur.ar](https://www.colonturismo.tur.ar/eventos/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-07-24T10:00:00-03:00',
            end: '2026-07-28T10:00:00-03:00',
            isAllDay: false
        },
        pricing: { isFree: true },
        locationSlug: 'puerto-de-colon',
        seo: {
            title: 'Feria del Puerto en Colón 2026: entrada gratuita',
            description:
                'Del 24 al 28 de julio de 2026, el Puerto de Colón recibe la Feria del Puerto: artesanías, productores y gastronomía para toda la familia. Entrada gratuita.'
        }
    },
    {
        slug: 'expo-rural-colon-2026',
        name: '42.ª Expo Rural Colón',
        summary:
            'Exposición rural en Colón con producción agropecuaria, animales, maquinaria, comercio, gastronomía y espectáculos.',
        description: `En las chacras que rodean a Colón, la actividad agropecuaria tiene un peso propio en la economía local, y cada año esa producción se muestra puertas afuera en una de las citas más esperadas del calendario rural del departamento.

La **42.ª Expo Rural Colón** se realiza el **20 y 21 de septiembre de 2026** en el **Predio de la Sociedad Rural**, sobre la **Ruta 130 km 37**, en Colonia San Miguel (departamento Colón).

La muestra combina producción y esparcimiento:

- Exposición de producción agropecuaria y animales
- Maquinaria agrícola
- Espacios comerciales
- Puestos de gastronomía
- Espectáculos en vivo

Una propuesta clásica para el sector productivo de la zona, pero también abierta al público general que quiera acercarse a ver de cerca el trabajo del campo entrerriano.

Fuente: [instagram.com/reel/DOoiLhclZJg](https://www.instagram.com/reel/DOoiLhclZJg/)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-09-20T00:00:00-03:00',
            end: '2026-09-21T00:00:00-03:00',
            isAllDay: true
        },
        locationSlug: 'predio-sociedad-rural-colon',
        seo: {
            title: '42.ª Expo Rural Colón 2026: agro y espectáculos',
            description:
                'El 20 y 21 de septiembre de 2026, la Sociedad Rural de Colón presenta su 42.ª Expo Rural: producción, animales, maquinaria, gastronomía y espectáculos en vivo.'
        }
    },
    {
        slug: 'fiesta-nacional-colonizacion-san-jose-2026',
        name: '39.ª Fiesta Nacional de la Colonización',
        summary:
            'Fiesta nacional en San José con espectáculos musicales, gastronomía, desfile evocativo y actividades familiares en homenaje a la historia inmigrante.',
        description: `San José conserva una fuerte identidad ligada a la inmigración europea que fundó la colonia, y cada año esa historia se pone en escena en uno de los eventos más representativos de la ciudad, con jornadas que celebran las tradiciones y la memoria de los primeros colonos.

La **39.ª Fiesta Nacional de la Colonización** tiene sus jornadas centrales el **sábado 25 y el domingo 26 de julio de 2026** en el **Predio Multieventos de San José**, aunque la agenda de festejos arranca semanas antes con actividades en distintos puntos de la ciudad, como el Torneo de Pesca en Pueblo Liebig y el Torneo de Tiro.

Durante el fin de semana central, la propuesta incluye:

- Espectáculos musicales, con **Luciano Pereyra**, **La Kuppé**, **Los Lirios de Santa Fe** y **Miguel Figueroa con Amanecer Campero**
- Acto protocolar y desfile de instituciones locales
- Desfile evocativo y exposición de vehículos antiguos
- Almuerzo popular
- Gastronomía y actividades familiares

La entrada es **gratuita para los vecinos de San José** presentando DNI, mientras que el resto del público abona una entrada general.

Fuente: [sanjose.gob.ar](https://sanjose.gob.ar/san-jose-presento-la-39-fiesta-nacional-de-la-colonizacion/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-07-24T00:00:00-03:00',
            end: '2026-07-26T00:00:00-03:00',
            isAllDay: true
        },
        locationSlug: 'predio-multieventos-san-jose',
        seo: {
            title: '39.ª Fiesta Nacional de la Colonización en San José',
            description:
                'Del 24 al 26 de julio de 2026, San José celebra su Fiesta Nacional de la Colonización: Luciano Pereyra, desfile evocativo, gastronomía y actividades familiares.'
        }
    },
    {
        slug: 'a-la-olla-festival-sabores-federacion-2026',
        name: 'A la Olla: Festival de Sabores',
        summary:
            'Festival gastronómico en Federación con variedad de platos, feria de emprendedores, música y espectáculos en vivo.',
        description: `Federación combina desde hace años el atractivo termal con una identidad gastronómica propia, y **A la Olla: Festival de Sabores** es una de las citas que pone esa combinación en primer plano, pensada como una salida ideal para compartir en familia o con amigos durante las vacaciones de invierno.

El festival se realiza el **domingo 26 de julio de 2026**, desde las **11:00**, en el predio frente al **Parque Acuático de Federación**.

La propuesta reúne:

- Variedad de platos y propuestas culinarias locales
- Feria de emprendedores
- Música en vivo
- Espectáculos

Bajo la idea de que la gastronomía, la cultura y el turismo se unen, es una buena opción para combinar con un día de termas o un paseo por el Lago de Salto Grande.

Fuente: [federacion.tur.ar](https://www.federacion.tur.ar/eventos-actividades-en-federacion/)`,
        category: EventCategoryEnum.GASTRONOMY,
        date: { start: '2026-07-26T11:00:00-03:00', isAllDay: false },
        locationSlug: 'predio-parque-acuatico-federacion',
        seo: {
            title: 'A la Olla: Festival de Sabores en Federación 2026',
            description:
                'El domingo 26 de julio de 2026, desde las 11:00, Federación reúne gastronomía, feria de emprendedores y música en vivo frente al Parque Acuático.'
        }
    },
    {
        slug: 'concordia-produce-2026',
        name: 'Concordia Produce 2026',
        summary:
            'Encuentro dedicado a la industria, la producción, el comercio y la vinculación empresarial en Concordia.',
        description: `Concordia es uno de los polos productivos más importantes de Entre Ríos, con una economía apoyada en la citricultura y una fuerte actividad comercial e industrial regional. **Concordia Produce** nació para poner esa producción en vidriera y convertirse en un espacio de vinculación entre empresas, productores y emprendedores.

La segunda edición de **Concordia Produce 2026** se desarrolla del **23 al 25 de octubre de 2026**, con inicio el viernes a las 09:00, en el **Parque Central Viñedos Moulins** y el **Centro de Convenciones de Concordia**.

El encuentro está dedicado a:

- La industria regional
- La producción
- El comercio
- Los emprendimientos
- La vinculación empresarial

Organizado por la Secretaría de Desarrollo Productivo de la Municipalidad de Concordia, se presenta como la Expo Productiva Multisectorial más importante de la región, pensada tanto para el sector productivo como para el público general interesado en conocer de cerca lo que se produce en la zona.

Fuente: [concordia.gob.ar](https://www.concordia.gob.ar/turismo/agenda/concordia-produce-2026)`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: '2026-10-23T00:00:00-03:00',
            end: '2026-10-25T00:00:00-03:00',
            isAllDay: true
        },
        locationSlug: 'parque-central-vinedos-moulins-concordia',
        seo: {
            title: 'Concordia Produce 2026: industria y producción',
            description:
                'Del 23 al 25 de octubre de 2026, Concordia reúne industria, producción, comercio y emprendimientos en el Parque Central Viñedos Moulins.'
        }
    },
    {
        slug: 'festival-6-cilindros-concepcion-del-uruguay-2026',
        name: 'Festival de los 6 Cilindros',
        summary:
            'Encuentro de automovilismo en el Autódromo de Concepción del Uruguay con TC Bonaerense, categorías invitadas y cupecitas históricas.',
        description: `El Autódromo de Concepción del Uruguay concentra en pleno invierno una seguidilla de tres fines de semana de automovilismo, y el **Festival de los 6 Cilindros** abre ese calendario como una de las fechas más convocantes para pilotos, equipos y aficionados de la región.

La carrera se corre el **25 y 26 de julio de 2026** en el **Autódromo de Concepción del Uruguay**, con el **TC Bonaerense** como principal atractivo, acompañado por cinco categorías más en pista.

El fin de semana reúne:

- TC Bonaerense
- Cinco categorías invitadas
- Cupecitas históricas
- Pilotos y preparadores de distintas provincias, muchos de gran trayectoria

Una cita pensada para el público fanático de la velocidad, en un autódromo que en las semanas siguientes recibe otras dos fechas del calendario regional.

Fuente: [lapiramide.net](https://www.lapiramide.net/amp/noticias/2026/07/22/351070-el-autodromo-de-concepcion-del-uruguay-se-prepara-para-tres-fines-de-semana-a-puro-automovilismo)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2026-07-25T00:00:00-03:00',
            end: '2026-07-26T00:00:00-03:00',
            isAllDay: true
        },
        locationSlug: 'autodromo-concepcion-del-uruguay',
        seo: {
            title: 'Festival de los 6 Cilindros en Concepción del Uruguay',
            description:
                'El 25 y 26 de julio de 2026, el Autódromo de Concepción del Uruguay recibe el Festival de los 6 Cilindros: TC Bonaerense y cupecitas históricas.'
        }
    },
    {
        slug: 'competicion-especial-entrerriana-formula-entrerriana-2026',
        name: 'Competición Especial y Fórmula Entrerriana',
        summary:
            'Competencia provincial de automovilismo en el Autódromo de Concepción del Uruguay con la Competición Especial Entrerriana y la Fórmula Entrerriana.',
        description: `Además del Festival de los 6 Cilindros, el Autódromo de Concepción del Uruguay suma otra fecha de automovilismo apenas unos días después, dentro de la seguidilla de tres fines de semana que el circuito tiene programada para este invierno.

La **Competición Especial Entrerriana y Fórmula Entrerriana** se disputa el **31 de julio y el 1 y 2 de agosto de 2026**, también en el **Autódromo de Concepción del Uruguay**, como parte del Campeonato Río Uruguay Seguros 2026.

Se trata de una competencia provincial de automovilismo que reúne a las clases de:

- La Competición Especial Entrerriana
- La Fórmula Entrerriana

Una fecha pensada para el público que sigue de cerca el automovilismo provincial, en el mismo escenario que semanas antes recibió al TC Bonaerense.

Fuente: [facebook.com/autodromocdelu](https://www.facebook.com/autodromocdelu/)`,
        category: EventCategoryEnum.SPORTS,
        date: {
            start: '2026-07-31T00:00:00-03:00',
            end: '2026-08-02T00:00:00-03:00',
            isAllDay: true
        },
        locationSlug: 'autodromo-concepcion-del-uruguay',
        seo: {
            title: 'Competición y Fórmula Entrerriana en Concepción del Uruguay',
            description:
                'Del 31 de julio al 2 de agosto de 2026, el Autódromo de Concepción del Uruguay recibe la Competición Especial Entrerriana y la Fórmula Entrerriana.'
        }
    },
    {
        slug: 'fiesta-nacional-arroz-san-salvador-2026',
        name: 'XVIII Fiesta Nacional del Arroz',
        summary:
            'Exposición agroindustrial en San Salvador, Capital Nacional del Arroz, con producción, gastronomía, emprendedores y espectáculos musicales.',
        description: `San Salvador es conocida en toda la provincia como la Capital Nacional del Arroz, y cada año esa identidad productiva se celebra puertas afuera con una de las fiestas agroindustriales más grandes de Entre Ríos.

La **XVIII Fiesta Nacional del Arroz** se realiza del **6 al 8 de noviembre de 2026** en **San Salvador**, presentada oficialmente en la Cooperativa Arrocera local como la expo-agro industrial a cielo abierto más importante de la provincia, con **entrada libre y gratuita**.

La fiesta reúne:

- Exposición agroindustrial y producción arrocera
- Espacios productivos que este año suman viñedos regionales como novedad
- Instituciones y emprendedores locales
- Gastronomía
- Espectáculos musicales, con artistas como **La Konga**, **Picaflor Bailantero** y **El Cuartetazo**, entre otros

Una fiesta pensada tanto para los vecinos de San Salvador, que además cuentan con propuestas de entradas pensadas especialmente para ellos, como para quienes se acerquen desde otros puntos de la provincia.

Fuente: [sansalvadorer.gob.ar](https://sansalvadorer.gob.ar/se-presento-la-xviii-fiesta-nacional-del-arroz-nuestra-fiesta/)`,
        category: EventCategoryEnum.FESTIVAL,
        date: {
            start: '2026-11-06T00:00:00-03:00',
            end: '2026-11-08T00:00:00-03:00',
            isAllDay: true
        },
        pricing: { isFree: true },
        locationSlug: 'san-salvador-centro',
        seo: {
            title: 'XVIII Fiesta Nacional del Arroz en San Salvador 2026',
            description:
                'Del 6 al 8 de noviembre de 2026, San Salvador celebra la XVIII Fiesta Nacional del Arroz: exposición agroindustrial, gastronomía y espectáculos musicales.'
        }
    },
    {
        slug: 'fiesta-patronal-nuestra-senora-islas-paranacito-2026',
        name: 'Fiesta Patronal Nuestra Señora de las Islas y Día del Isleño',
        summary:
            'Celebración religiosa y cultural en Villa Paranacito con peregrinación náutica y terrestre, coincidente con el Día del Isleño.',
        description: `Villa Paranacito está en el corazón del Delta entrerriano, una región de islas donde el agua marca buena parte de la vida cotidiana, y esa identidad isleña se hace protagonista una vez al año en una celebración que combina fe y tradición.

La **Fiesta Patronal Nuestra Señora de las Islas y Día del Isleño** se celebra el **31 de octubre de 2026** en **Villa Paranacito**, con eje en la Parroquia Nuestra Señora de las Islas.

La jornada incluye:

- Misa y actividades comunitarias
- Peregrinación náutica y terrestre, con la procesión principal realizada por agua
- Homenaje a la imagen de Nuestra Señora de las Islas, tallada en madera en la década de 1960 por el escultor alemán Leo Moroder

La fecha coincide con el **Día del Isleño**, que conmemora el Primer Congreso de Productores Isleños de 1936 y se celebra con actos en escuelas y encuentros deportivos, en homenaje a quienes viven y trabajan en la región de islas.

Fuente: [villaparanacito.gob.ar](https://www.villaparanacito.gob.ar/turismo/eventos)`,
        category: EventCategoryEnum.CULTURE,
        date: { start: '2026-10-31T00:00:00-03:00', isAllDay: true },
        pricing: { isFree: true },
        locationSlug: 'villa-paranacito-centro',
        seo: {
            title: 'Fiesta Patronal Nuestra Señora de las Islas 2026',
            description:
                'El 31 de octubre de 2026, Villa Paranacito celebra a Nuestra Señora de las Islas y el Día del Isleño con peregrinación náutica y terrestre.'
        }
    }
] as const;

/**
 * Resolves each entry in {@link DESTINATION_SLUGS} to its real database id.
 *
 * Returns whatever subset of {@link DESTINATION_SLUGS} actually exists in
 * this database — which may be partial or empty. This migration is exercised
 * by `cli-data-migrate.integration.test.ts` against a near-empty DB that has
 * the super-admin but NOT the base destination seed, so treating a missing
 * destination as fatal would fail that CI-run environment; the `up()` loops
 * below skip whatever can't resolve instead.
 */
async function resolveDestinationIds(
    db: DrizzleClient
): Promise<ReadonlyMap<DestinationSlug, string>> {
    const rows = await db
        .select({ id: destinations.id, slug: destinations.slug })
        .from(destinations)
        .where(inArray(destinations.slug, [...DESTINATION_SLUGS]));

    const bySlug = new Map(rows.map((row) => [row.slug, row.id]));

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
            `0025-add-confirmed-events-entre-rios-2026: unresolved destination "${location.destinationSlug}" for location "${location.slug}"`
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
            `0025-add-confirmed-events-entre-rios-2026: failed to insert or resolve event_location "${location.slug}"`
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
                isAllDay: event.date.isAllDay
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
    let locationsSkipped = 0;
    const locationIdBySlug = new Map<string, string>();
    for (const location of LOCATIONS) {
        // Skip locations whose destination doesn't exist in this environment
        // (e.g. the CI integration DB, which has no base destination seed)
        // instead of throwing — this migration must be a no-op-but-successful
        // pass there, not a hard failure.
        if (!destinationIdBySlug.has(location.destinationSlug)) {
            locationsSkipped += 1;
            continue;
        }
        const result = await upsertEventLocation(ctx.db, location, destinationIdBySlug);
        locationIdBySlug.set(location.slug, result.id);
        if (result.inserted) {
            locationsInserted += 1;
        }
    }

    let eventsInserted = 0;
    let eventsSkipped = 0;
    for (const event of EVENTS) {
        const locationSeed = LOCATIONS.find((location) => location.slug === event.locationSlug);
        if (!locationSeed) {
            throw new Error(
                `0025-add-confirmed-events-entre-rios-2026: event "${event.slug}" references unknown locationSlug "${event.locationSlug}"`
            );
        }
        const locationId = locationIdBySlug.get(event.locationSlug);
        const destinationId = destinationIdBySlug.get(locationSeed.destinationSlug);
        if (!locationId || !destinationId) {
            // The location (and therefore its destination) was skipped above
            // for the same environment-tolerance reason — skip the event too.
            eventsSkipped += 1;
            continue;
        }

        const result = await upsertEvent(ctx.db, event, ctx.actor.id, locationId, destinationId);
        if (result.inserted) {
            eventsInserted += 1;
        }
    }

    return {
        summary: `Inserted ${eventsInserted} of ${EVENTS.length} confirmed Entre Ríos tourist events (rest already present), across ${locationsInserted} of ${LOCATIONS.length} newly-created event locations. Skipped ${eventsSkipped} events and ${locationsSkipped} locations (destinations absent in this environment).`,
        counts: {
            eventsInserted,
            eventsAlreadyPresent: EVENTS.length - eventsInserted - eventsSkipped,
            eventsSkipped,
            locationsInserted,
            locationsAlreadyPresent: LOCATIONS.length - locationsInserted - locationsSkipped,
            locationsSkipped
        }
    };
}

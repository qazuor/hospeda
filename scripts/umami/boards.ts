import type { BoardComponentSpec, BoardDefinition } from './definitions.js';
import { buildBoardDefinition, HOSPEDA_FUNNELS, HOSPEDA_GOALS } from './definitions.js';

/**
 * The six Umami boards that replace the PostHog dashboards `00 Resumen` ...
 * `05 Calidad` (HOS-2119, T-039 and T-040), plus the `Attribution` board
 * (HOS-2359, OD-10). Pure data plus one pure builder:
 * no I/O, no clock, so the output is deterministic (AC-6, idempotent setup).
 *
 * ORDER OF OPERATIONS: Funnel and Goal components store `props.reportId`, the id
 * of a saved report. The setup script must upsert the reports first
 * (`buildReportDefinitions`), then pass the resulting `name -> id` map to
 * {@link buildBoardDefinitions}. A component that names a report missing from
 * the map makes the build throw `UNRESOLVED_REPORT`; nothing is guessed.
 *
 * The component types were checked against the Umami 3.5.0 editor registry:
 * `EventsChart` and `EventsMetricsBar` have no configurable props (they chart
 * ALL custom events), `MetricsTable` takes `props.type` and `props.limit`, and
 * `Funnel` / `Goal` take `props.reportId` only.
 */

/** A dashboard of PostHog and the board that replaces it. */
export interface BoardSpec {
    /** Stable natural key of the board in Umami. */
    readonly name: string;
    readonly description: string;
    readonly rows: readonly (readonly BoardComponentSpec[])[];
}

function funnelName(index: number): string {
    const funnel = HOSPEDA_FUNNELS[index];
    if (funnel === undefined) throw new Error(`No funnel at index ${index}`);
    return funnel.name;
}

function goalName(index: number): string {
    const goal = HOSPEDA_GOALS[index];
    if (goal === undefined) throw new Error(`No goal at index ${index}`);
    return goal.name;
}

// Indexes into HOSPEDA_FUNNELS / HOSPEDA_GOALS; the tests pin the names.
const F_SIGNUP_PUBLISHED = funnelName(0);
const F_VIEW_CONTACT = funnelName(1);
const F_CONTACT_3 = funnelName(2);
const F_OWNER = funnelName(3);
const F_SUBSCRIPTION = funnelName(4);
const G_SIGNUP = goalName(0);
const G_PUBLISHED = goalName(1);
const G_CONTACT = goalName(2);
const G_SUBSCRIPTION = goalName(3);
const G_CHARGE = goalName(4);
const G_TRIAL = goalName(5);

/** The seven boards, in dashboard order (`Attribution` last). */
export const BOARD_SPECS: readonly BoardSpec[] = [
    {
        name: '00 Resumen',
        description: 'Dashboard ejecutivo: tráfico, conversiones clave y embudos base.',
        rows: [
            [
                { kind: 'metricsBar', title: 'Pageviews y visitantes' },
                { kind: 'visitorsChart', title: 'Evolución de visitantes' }
            ],
            [
                { kind: 'goal', title: 'Registros completados', reportName: G_SIGNUP },
                { kind: 'goal', title: 'Alojamientos publicados', reportName: G_PUBLISHED }
            ],
            [
                { kind: 'goal', title: 'Contactos completados', reportName: G_CONTACT },
                { kind: 'goal', title: 'Suscripciones activadas', reportName: G_SUBSCRIPTION }
            ],
            [
                {
                    kind: 'funnel',
                    title: 'Registro → alojamiento publicado',
                    reportName: F_SIGNUP_PUBLISHED
                },
                {
                    kind: 'funnel',
                    title: 'Vista de alojamiento → contacto',
                    reportName: F_VIEW_CONTACT
                }
            ]
        ]
    },
    {
        name: '01 Adquisición',
        description: 'Fuentes, campañas, landings y conversiones de adquisición.',
        rows: [
            [
                { kind: 'metricsBar', title: 'Pageviews y visitantes' },
                { kind: 'visitorsChart', title: 'Evolución de visitantes' }
            ],
            [
                { kind: 'metricsTable', title: 'Visitantes por referrer', dimension: 'referrer' },
                { kind: 'metricsTable', title: 'Landing pages', dimension: 'entry' }
            ],
            [
                {
                    kind: 'metricsTable',
                    title: 'Visitantes por UTM source',
                    dimension: 'utmSource'
                },
                {
                    kind: 'metricsTable',
                    title: 'Visitantes por UTM campaign',
                    dimension: 'utmCampaign'
                }
            ],
            [
                { kind: 'goal', title: 'Registros completados', reportName: G_SIGNUP },
                { kind: 'goal', title: 'Contactos completados', reportName: G_CONTACT }
            ]
        ]
    },
    {
        name: '02 Descubrimiento',
        description: 'Vistas de contenido, búsquedas y conversión a contacto.',
        rows: [
            [
                { kind: 'eventsMetricsBar', title: 'Métricas de eventos' },
                { kind: 'eventsChart', title: 'Eventos en el tiempo' }
            ],
            [
                {
                    kind: 'metricsTable',
                    title: 'Eventos (búsquedas, vistas, contactos)',
                    dimension: 'event',
                    limit: 20
                },
                { kind: 'goal', title: 'Contactos completados', reportName: G_CONTACT }
            ],
            [
                {
                    kind: 'funnel',
                    title: 'Vista de alojamiento → contacto',
                    reportName: F_VIEW_CONTACT
                },
                {
                    kind: 'funnel',
                    title: 'Contacto de alojamiento (3 pasos)',
                    reportName: F_CONTACT_3
                }
            ]
        ]
    },
    {
        name: '03 Owners',
        description: 'Onboarding, drafts, importaciones y publicaciones de owners.',
        rows: [
            [
                { kind: 'eventsMetricsBar', title: 'Métricas de eventos' },
                { kind: 'eventsChart', title: 'Eventos en el tiempo' }
            ],
            [
                {
                    kind: 'metricsTable',
                    title: 'Eventos (onboarding, drafts, importaciones, publicación)',
                    dimension: 'event',
                    limit: 20
                },
                { kind: 'goal', title: 'Alojamientos publicados', reportName: G_PUBLISHED }
            ],
            [
                {
                    kind: 'funnel',
                    title: 'Owner adquisición → publicación',
                    reportName: F_OWNER
                }
            ]
        ]
    },
    {
        name: '04 Suscripciones',
        description: 'Checkout, activación, cobros y conversión de trials.',
        rows: [
            [
                { kind: 'eventsMetricsBar', title: 'Métricas de eventos' },
                { kind: 'eventsChart', title: 'Eventos en el tiempo' }
            ],
            [
                {
                    kind: 'metricsTable',
                    title: 'Eventos (checkout, cobros, trials)',
                    dimension: 'event',
                    limit: 20
                },
                { kind: 'goal', title: 'Suscripciones activadas', reportName: G_SUBSCRIPTION }
            ],
            [
                { kind: 'goal', title: 'Pagos exitosos', reportName: G_CHARGE },
                { kind: 'goal', title: 'Trials convertidos a pago', reportName: G_TRIAL }
            ],
            [{ kind: 'funnel', title: 'Funnel de suscripción', reportName: F_SUBSCRIPTION }]
        ]
    },
    {
        name: '05 Calidad',
        description: 'Fallos que afectan conversión o uso, y embudos de control.',
        rows: [
            [
                {
                    kind: 'eventsChart',
                    title: 'Eventos en el tiempo (incluye *_failed y billing_charge_declined)'
                },
                {
                    kind: 'metricsTable',
                    title: 'Eventos (fallos de contacto, importación y cobro)',
                    dimension: 'event',
                    limit: 20
                }
            ],
            [
                {
                    kind: 'funnel',
                    title: 'Owner adquisición → publicación',
                    reportName: F_OWNER
                },
                {
                    kind: 'funnel',
                    title: 'Contacto de alojamiento (3 pasos)',
                    reportName: F_CONTACT_3
                }
            ]
        ]
    },
    {
        // HOS-2359 (OD-10). Named literally as the owner wrote it, unlike the
        // numbered boards above. Built from `MetricsTable` because the 3.5.0
        // registry has no attribution component (M-3); first-click
        // attribution lives in the saved reports of `attribution-definitions.ts`,
        // and email opens are the `email-open` event (HOS-2583).
        name: 'Attribution',
        description:
            'De dónde vienen las visitas: UTM de emails, botones de compartir, QR y presentaciones, y sus conversiones.',
        rows: [
            [
                {
                    kind: 'metricsTable',
                    title: 'Visitantes por UTM source',
                    dimension: 'utmSource'
                },
                { kind: 'metricsTable', title: 'Visitantes por UTM medium', dimension: 'utmMedium' }
            ],
            [
                {
                    kind: 'metricsTable',
                    title: 'Visitantes por UTM campaign',
                    dimension: 'utmCampaign'
                },
                {
                    kind: 'metricsTable',
                    title: 'Visitantes por UTM content',
                    dimension: 'utmContent'
                }
            ],
            [
                { kind: 'goal', title: 'Registros completados', reportName: G_SIGNUP },
                { kind: 'goal', title: 'Contactos completados', reportName: G_CONTACT }
            ]
        ]
    }
] as const;

/** Input of {@link buildBoardDefinitions}. */
export interface BuildBoardDefinitionsInput {
    /** Umami website the boards read. */
    readonly websiteId: string;
    /** Saved report name -> report id, from the report upserts (reports first). */
    readonly reportIds: Readonly<Record<string, string>>;
}

/**
 * Builds the six dashboard boards. Pure: equal input gives deeply equal output.
 *
 * @param input - Website id and the `name -> id` map of the already upserted reports
 * @returns Board definitions in dashboard order, ready for `upsertBoard`
 * @throws {UmamiDefinitionError} `UNRESOLVED_REPORT` when a funnel or goal
 * component names a report that is not in `input.reportIds`
 *
 * @example
 * ```ts
 * const boards = buildBoardDefinitions({ websiteId, reportIds: { 'Goal · Registros completados': 'uuid' } });
 * ```
 */
export function buildBoardDefinitions(
    input: BuildBoardDefinitionsInput
): readonly BoardDefinition[] {
    return BOARD_SPECS.map((spec) =>
        buildBoardDefinition({
            name: spec.name,
            description: spec.description,
            websiteId: input.websiteId,
            rows: spec.rows,
            reportIds: input.reportIds
        })
    );
}

/**
 * Names of every report the boards reference, deduplicated, in first-use order.
 * The setup script can assert all of them were upserted before building boards.
 *
 * @returns Report names
 */
export function listReferencedReportNames(): readonly string[] {
    const names = new Set<string>();
    for (const spec of BOARD_SPECS) {
        for (const row of spec.rows) {
            for (const component of row) {
                if (component.kind === 'funnel' || component.kind === 'goal') {
                    names.add(component.reportName);
                }
            }
        }
    }
    return [...names];
}

/** A PostHog tile that has no (or only a partial) Umami equivalent. */
export interface DroppedTile {
    /** Board that replaces the PostHog dashboard. */
    readonly dashboard: string;
    /** PostHog insight name, without the `[Dashboard]` prefix. */
    readonly tile: string;
    /** Why Umami cannot express it. */
    readonly reason: string;
    /** What covers the need instead (gap list for `docs/analytics/umami-dashboards.md`). */
    readonly replacement: string;
}

const NO_EVENT_PROP =
    'Umami has no board component or saved report that breaks an event down by a custom event property (the breakdown report accepts only fixed columns).';
const NO_PERSON =
    'Umami has no person properties, so a breakdown by a person attribute cannot exist.';
const NO_PER_EVENT =
    'No board component charts or counts ONE custom event: EventsChart and EventsMetricsBar take no props and cover all events; only conversion events have a saved Goal.';
const EVENT_DATA = 'An `event-data` read of the property, or an admin page reading the Hospeda DB.';
const EVENTS_TABLE =
    'The `MetricsTable` of events on the same board lists this event with its count.';

/**
 * Tiles of the PostHog dashboards that were not ported one-to-one. Source of
 * the gap list in `docs/analytics/umami-dashboards.md` (T-042). Only listed
 * here when the tile is dropped or reduced; ported tiles are in
 * {@link BOARD_SPECS}.
 */
export const DROPPED_TILES: readonly DroppedTile[] = [
    {
        dashboard: '00 Resumen',
        tile: 'Visitantes activos mensuales (MAU)',
        reason: 'Umami has no rolling monthly-active-users metric.',
        replacement: 'The metrics bar shows unique visitors of the selected date range.'
    },
    {
        dashboard: '00 Resumen',
        tile: 'Conversión visitante → registro',
        reason: 'A funnel needs a concrete first step; there is no "any pageview" step.',
        replacement: 'Goal "Registros completados" (share of visitors that signed up).'
    },
    {
        dashboard: '00 Resumen',
        tile: 'Pageviews 30d / Evolución diaria (DAU)',
        reason: 'DAU as a math mode does not exist; the date range is chosen on the board.',
        replacement: 'WebsiteMetricsBar and WebsiteChart (pageviews, visitors, visits).'
    },
    {
        dashboard: '00 Resumen',
        tile: 'Top destinos por visitantes',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '00 Resumen',
        tile: 'Top alojamientos por contactos',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '00 Resumen',
        tile: 'Registros / Alojamientos publicados / Contactos / Suscripciones creadas 30d',
        reason: 'A Goal shows the share of visitors that fired the event, not an event count.',
        replacement: 'Goals of the same names (counts and rate) plus the events table.'
    },
    {
        dashboard: '01 Adquisición',
        tile: 'Pageviews / Registros / Contactos 30d',
        reason: 'Trends of a single event have no dedicated component.',
        replacement: 'WebsiteMetricsBar, WebsiteChart and the Goals for sign-up and contact.'
    },
    {
        dashboard: '02 Descubrimiento',
        tile: 'Búsquedas, vistas de destinos/alojamientos/eventos/posts, contactos iniciados 30d',
        reason: NO_PER_EVENT,
        replacement: EVENTS_TABLE
    },
    {
        dashboard: '02 Descubrimiento',
        tile: 'Contactos por destino',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '02 Descubrimiento',
        tile: 'Contactos por alojamiento',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '03 Owners',
        tile: 'Inicios de onboarding, drafts, importaciones completadas/fallidas 30d',
        reason: NO_PER_EVENT,
        replacement: EVENTS_TABLE
    },
    {
        dashboard: '03 Owners',
        tile: 'Publicaciones por plan',
        reason: NO_PERSON,
        replacement: 'An admin page reading the Hospeda DB (plan lives in billing tables).'
    },
    {
        dashboard: '04 Suscripciones',
        tile: 'Checkouts iniciados, pagos fallidos 30d',
        reason: NO_PER_EVENT,
        replacement: EVENTS_TABLE
    },
    {
        dashboard: '04 Suscripciones',
        tile: 'Suscripciones por plan',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '04 Suscripciones',
        tile: 'Suscripciones por período',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    },
    {
        dashboard: '05 Calidad',
        tile: 'Contactos fallidos, importaciones fallidas, pagos fallidos 30d',
        reason: NO_PER_EVENT,
        replacement: EVENTS_TABLE
    },
    {
        dashboard: '05 Calidad',
        tile: 'Pagos fallidos por categoría',
        reason: NO_EVENT_PROP,
        replacement: EVENT_DATA
    }
] as const;

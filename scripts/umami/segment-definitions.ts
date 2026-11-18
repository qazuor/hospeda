import { z } from 'zod';
import { assertCatalogEvent } from './definitions.js';

/**
 * Typed definitions of the Umami segments and cohorts of the WEB website
 * (HOS-2119). A segment is a saved filter set; a cohort is a saved "did this
 * action in this window" group. The payload shape was measured on Umami 3.5.0
 * and mirrored from the server's own zod schema.
 *
 * Nothing here performs I/O. The output is a function of the input only, so the
 * setup script can compare it with what Umami stores and stay idempotent.
 */

/** Filter operators accepted by Umami 3.5 (`parameters.filters[].operator`). */
export const SEGMENT_OPERATORS = [
    'eq',
    'neq',
    's',
    'ns',
    'c',
    'dnc',
    're',
    'nre',
    't',
    'f',
    'gt',
    'lt',
    'gte',
    'lte',
    'bf',
    'af'
] as const;

/** Filter names accepted by Umami 3.5 (`parameters.filters[].name`). */
export const SEGMENT_FILTER_NAMES = [
    'path',
    'referrer',
    'title',
    'query',
    'os',
    'browser',
    'device',
    'country',
    'region',
    'city',
    'tag',
    'hostname',
    'distinctId',
    'language',
    'event',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
    'utmTerm'
] as const;

/** Zod schema of a segment/cohort `parameters` object (mirrors the Umami server). */
export const segmentParametersSchema = z.object({
    filters: z
        .array(
            z.object({
                name: z.enum(SEGMENT_FILTER_NAMES),
                operator: z.enum(SEGMENT_OPERATORS),
                value: z.string()
            })
        )
        .optional(),
    match: z.enum(['all', 'any']).optional(),
    dateRange: z.string().optional(),
    action: z.object({ type: z.enum(['path', 'event']), value: z.string() }).optional()
});

/** `parameters` of a segment or cohort. */
export type SegmentParameters = z.infer<typeof segmentParametersSchema>;

/** Kind of a saved audience. */
export type SegmentType = 'segment' | 'cohort';

/** A segment or cohort ready to be upserted. Natural key: `websiteId` + `type` + `name`. */
export interface SegmentDefinition {
    readonly type: SegmentType;
    readonly name: string;
    readonly parameters: SegmentParameters;
}

type Filter = NonNullable<SegmentParameters['filters']>[number];

function filter(name: Filter['name'], operator: Filter['operator'], value: string): Filter {
    return { name, operator, value };
}

function segment(input: {
    readonly name: string;
    readonly filters: readonly Filter[];
    readonly match?: 'all' | 'any';
}): SegmentDefinition {
    return {
        type: 'segment',
        name: input.name,
        parameters: {
            filters: [...input.filters],
            match: input.match ?? 'all'
        }
    };
}

/** Segments of the WEB website. */
export const HOSPEDA_SEGMENTS: readonly SegmentDefinition[] = [
    segment({
        name: 'Celular y tablet',
        filters: [filter('device', 'eq', 'mobile'), filter('device', 'eq', 'tablet')],
        match: 'any'
    }),
    segment({
        name: 'Escritorio y notebook',
        filters: [filter('device', 'eq', 'desktop'), filter('device', 'eq', 'laptop')],
        match: 'any'
    }),
    segment({ name: 'Visitantes de Argentina', filters: [filter('country', 'eq', 'AR')] }),
    segment({ name: 'Visitantes del exterior', filters: [filter('country', 'neq', 'AR')] }),
    segment({
        name: 'Brasil y Uruguay',
        filters: [filter('country', 'eq', 'BR'), filter('country', 'eq', 'UY')],
        match: 'any'
    }),
    segment({ name: 'Llegan desde Google', filters: [filter('referrer', 'c', 'google')] }),
    segment({
        name: 'Llegan desde redes sociales',
        filters: [
            filter('referrer', 'c', 'facebook'),
            filter('referrer', 'c', 'instagram'),
            filter('referrer', 'c', 'whatsapp'),
            filter('referrer', 'c', 't.co')
        ],
        match: 'any'
    }),
    segment({ name: 'Llegan por campaña (UTM)', filters: [filter('utmSource', 's', '')] }),
    segment({ name: 'Usuarios logueados', filters: [filter('distinctId', 's', '')] }),
    segment({ name: 'Visitantes anónimos', filters: [filter('distinctId', 'ns', '')] }),
    segment({
        name: 'Navegan fichas de alojamiento',
        filters: [filter('path', 'c', '/alojamientos/')]
    }),
    segment({
        name: 'Navegan Comer y salir y Experiencias',
        filters: [filter('path', 'c', '/comer-y-salir/'), filter('path', 'c', '/experiencias/')],
        match: 'any'
    })
] as const;

/** Input of {@link buildCohortDefinition}. */
export interface CohortInput {
    readonly name: string;
    /** Catalog event the cohort members fired. */
    readonly event: string;
    /** Look-back window, e.g. `7day`, `30day`, `90day`. */
    readonly dateRange: string;
}

/**
 * Builds an event cohort.
 *
 * @param input - See {@link CohortInput}
 * @returns The cohort definition
 * @throws {UmamiDefinitionError} `UNKNOWN_EVENT` for a non-catalog event
 *
 * @example
 * ```ts
 * buildCohortDefinition({ name: 'Se registraron (30 días)', event: 'sign_up_completed', dateRange: '30day' });
 * ```
 */
export function buildCohortDefinition(input: CohortInput): SegmentDefinition {
    return {
        type: 'cohort',
        name: input.name,
        parameters: {
            action: { type: 'event', value: assertCatalogEvent(input.event) },
            dateRange: input.dateRange
        }
    };
}

/** Cohorts of the WEB website. */
export const HOSPEDA_COHORTS: readonly CohortInput[] = [
    { name: 'Vieron un alojamiento (7 días)', event: 'accommodation_viewed', dateRange: '7day' },
    {
        name: 'Contactaron a un dueño (30 días)',
        event: 'contact_owner_completed',
        dateRange: '30day'
    },
    { name: 'Se registraron (30 días)', event: 'sign_up_completed', dateRange: '30day' },
    {
        name: 'Publicaron un alojamiento (30 días)',
        event: 'accommodation_published',
        dateRange: '30day'
    },
    { name: 'Usaron el chat con IA (30 días)', event: 'ai_chat_opened', dateRange: '30day' },
    {
        name: 'Empezaron un checkout (30 días)',
        event: 'billing_checkout_started',
        dateRange: '30day'
    },
    {
        name: 'Activaron una suscripción (90 días)',
        event: 'billing_subscription_activated',
        dateRange: '90day'
    },
    { name: 'Empezaron un trial (90 días)', event: 'trial_started', dateRange: '90day' }
] as const;

/**
 * Builds every segment and cohort, validated against the zod schema (segments
 * first, then cohorts). Pure: two calls return deeply equal values.
 *
 * @returns Definitions ready for `upsertSegment`
 * @throws {UmamiDefinitionError} `UNKNOWN_EVENT` if a cohort names a non-catalog event
 * @throws {z.ZodError} If a definition violates the Umami payload schema
 */
export function buildSegmentDefinitions(): readonly SegmentDefinition[] {
    const all = [...HOSPEDA_SEGMENTS, ...HOSPEDA_COHORTS.map(buildCohortDefinition)];
    for (const definition of all) segmentParametersSchema.parse(definition.parameters);
    return all;
}

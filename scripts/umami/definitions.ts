import { AnalyticsEventSchemas } from '../../packages/analytics/src/catalog.js';
import type { BoardType, JsonValue, ReportType } from './client.js';

/**
 * Pure, deterministic builders for the Umami report and board definitions
 * (HOS-2119, T-038). They port the retired PostHog insight builders (removed in
 * HOS-2119 T-064); the PostHog -> Umami mapping and the
 * insights that have no Umami equivalent are recorded in
 * `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md` ("T-038").
 *
 * Nothing here performs I/O or reads the clock. The output is a function of the
 * input only, so the setup script can compare it to what Umami stores and stay
 * idempotent (AC-6).
 */

/** Name of an event of the analytics catalog (`AnalyticsEventSchemas`). */
export type CatalogEventName = keyof typeof AnalyticsEventSchemas;

/**
 * Default funnel conversion window, in MINUTES (measured on Umami 3.5.0: with
 * events 2 h apart, `window: 10` breaks the funnel and `window: 200` completes
 * it). 14 days, the PostHog funnel default.
 */
export const DEFAULT_FUNNEL_WINDOW_MINUTES = 20_160;

/** Default look-back of every PostHog insight (`date_from: '-30d'`), in days. */
export const DEFAULT_LOOKBACK_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/** Failure category of a {@link UmamiDefinitionError}. */
export type UmamiDefinitionErrorCode =
    | 'UNKNOWN_EVENT'
    | 'INVALID_FUNNEL'
    | 'INVALID_PATH'
    | 'UNRESOLVED_REPORT'
    | 'INVALID_WINDOW';

/** Raised when a definition cannot be built. Never carries secrets. */
export class UmamiDefinitionError extends Error {
    public readonly code: UmamiDefinitionErrorCode;
    public readonly detail: string;

    /**
     * @param input.code - Failure category
     * @param input.message - Human readable message
     * @param input.detail - The offending value (event name, path, report name)
     */
    constructor(input: {
        readonly code: UmamiDefinitionErrorCode;
        readonly message: string;
        readonly detail: string;
    }) {
        super(input.message);
        this.name = 'UmamiDefinitionError';
        this.code = input.code;
        this.detail = input.detail;
    }
}

/** A report ready to be upserted. `name` is the natural key (per website). */
export interface ReportDefinition {
    readonly name: string;
    readonly type: ReportType;
    readonly description: string;
    readonly parameters: { readonly [key: string]: JsonValue };
}

/** A board ready to be upserted. `name` is the natural key. */
export interface BoardDefinition {
    readonly name: string;
    readonly type: BoardType;
    readonly description: string;
    readonly parameters: { readonly [key: string]: JsonValue };
}

/**
 * Validates that a name is an event of the analytics catalog.
 *
 * @param eventName - Candidate event name
 * @returns The same name, narrowed to {@link CatalogEventName}
 * @throws {UmamiDefinitionError} `UNKNOWN_EVENT` when it is not a catalog key
 *
 * @example
 * ```ts
 * assertCatalogEvent('sign_up_completed'); // 'sign_up_completed'
 * assertCatalogEvent('nope'); // throws UmamiDefinitionError
 * ```
 */
export function assertCatalogEvent(eventName: string): CatalogEventName {
    if (!Object.hasOwn(AnalyticsEventSchemas, eventName)) {
        throw new UmamiDefinitionError({
            code: 'UNKNOWN_EVENT',
            message: `Event "${eventName}" is not in AnalyticsEventSchemas`,
            detail: eventName
        });
    }
    return eventName as CatalogEventName;
}

/** One funnel step: a catalog event, or a page path (must start with `/`). */
export type FunnelStepInput =
    | { readonly type: 'event'; readonly event: string }
    | { readonly type: 'path'; readonly path: string };

/** Input of {@link buildFunnelReport}. */
export interface BuildFunnelReportInput {
    /** Stable natural key of the report. */
    readonly name: string;
    readonly description: string;
    /** Ordered steps, at least two (Umami rejects fewer). */
    readonly steps: readonly FunnelStepInput[];
    /** Conversion window in minutes. Defaults to {@link DEFAULT_FUNNEL_WINDOW_MINUTES}. */
    readonly windowMinutes?: number;
}

/**
 * Builds a `funnel` report. Parameter shape measured on Umami 3.5.0:
 * `{ window: <minutes>, steps: [{ type: 'event' | 'path', value }] }`.
 *
 * @param input - See {@link BuildFunnelReportInput}
 * @returns The report definition; step order is preserved
 * @throws {UmamiDefinitionError} `UNKNOWN_EVENT`, `INVALID_PATH`,
 * `INVALID_FUNNEL` (fewer than two steps) or `INVALID_WINDOW`
 *
 * @example
 * ```ts
 * buildFunnelReport({
 *   name: 'Funnel · Suscripción',
 *   description: 'Checkout hasta pago',
 *   steps: [
 *     { type: 'event', event: 'billing_checkout_started' },
 *     { type: 'event', event: 'billing_charge_succeeded' }
 *   ]
 * });
 * ```
 */
export function buildFunnelReport(input: BuildFunnelReportInput): ReportDefinition {
    const windowMinutes = input.windowMinutes ?? DEFAULT_FUNNEL_WINDOW_MINUTES;
    if (!Number.isInteger(windowMinutes) || windowMinutes < 1) {
        throw new UmamiDefinitionError({
            code: 'INVALID_WINDOW',
            message: `Funnel window must be a positive integer of minutes, got ${windowMinutes}`,
            detail: String(windowMinutes)
        });
    }
    if (input.steps.length < 2) {
        throw new UmamiDefinitionError({
            code: 'INVALID_FUNNEL',
            message: `Funnel "${input.name}" needs at least two steps`,
            detail: input.name
        });
    }
    const steps = input.steps.map((step) => {
        if (step.type === 'event') {
            return { type: 'event', value: assertCatalogEvent(step.event) };
        }
        if (!step.path.startsWith('/')) {
            throw new UmamiDefinitionError({
                code: 'INVALID_PATH',
                message: `Funnel path step "${step.path}" must start with "/"`,
                detail: step.path
            });
        }
        return { type: 'path', value: step.path };
    });
    return {
        name: input.name,
        type: 'funnel',
        description: input.description,
        parameters: { window: windowMinutes, steps }
    };
}

/** Input of {@link buildGoalReport}. */
export interface BuildGoalReportInput {
    /** Stable natural key of the report. */
    readonly name: string;
    readonly description: string;
    /** Catalog event whose unique-visitor conversion is tracked. */
    readonly event: string;
}

/**
 * Builds a `goal` report on a catalog event. Parameter shape measured on
 * Umami 3.5.0: `{ type: 'event' | 'path', value }`. A goal reports the share of
 * visitors that fired the event, which is also what replaces the PostHog
 * "pageview -> event" funnel.
 *
 * @param input - See {@link BuildGoalReportInput}
 * @returns The report definition
 * @throws {UmamiDefinitionError} `UNKNOWN_EVENT` for a non-catalog event
 *
 * @example
 * ```ts
 * buildGoalReport({ name: 'Goal · Registros', description: '...', event: 'sign_up_completed' });
 * ```
 */
export function buildGoalReport(input: BuildGoalReportInput): ReportDefinition {
    return {
        name: input.name,
        type: 'goal',
        description: input.description,
        parameters: { type: 'event', value: assertCatalogEvent(input.event) }
    };
}

/**
 * Resolves the date range of a report run from an injected clock (Umami stores
 * no date range in a report; every run passes `startAt`/`endAt` in ms).
 *
 * @param input.now - Injected clock value in epoch ms
 * @param input.days - Look-back in days. Defaults to {@link DEFAULT_LOOKBACK_DAYS}
 * @returns `{ startAt, endAt }` in epoch ms
 *
 * @example
 * ```ts
 * resolveDateRange({ now: 1_700_000_000_000 }); // 30 days back
 * ```
 */
export function resolveDateRange(input: { readonly now: number; readonly days?: number }): {
    readonly startAt: number;
    readonly endAt: number;
} {
    const days = input.days ?? DEFAULT_LOOKBACK_DAYS;
    return { startAt: input.now - days * MS_PER_DAY, endAt: input.now };
}

/** Funnels ported from the PostHog insights (deduplicated by steps). */
export const HOSPEDA_FUNNELS: readonly BuildFunnelReportInput[] = [
    {
        name: 'Funnel · Registro → alojamiento publicado',
        description: 'Cuentas creadas que llegan a publicar un alojamiento.',
        steps: [
            { type: 'event', event: 'sign_up_completed' },
            { type: 'event', event: 'accommodation_published' }
        ]
    },
    {
        name: 'Funnel · Vista de alojamiento → contacto',
        description: 'Vista de un alojamiento hasta contacto completado con el owner.',
        steps: [
            { type: 'event', event: 'accommodation_viewed' },
            { type: 'event', event: 'contact_owner_completed' }
        ]
    },
    {
        name: 'Funnel · Contacto de alojamiento (3 pasos)',
        description: 'Vista, contacto iniciado y contacto completado.',
        steps: [
            { type: 'event', event: 'accommodation_viewed' },
            { type: 'event', event: 'contact_owner_started' },
            { type: 'event', event: 'contact_owner_completed' }
        ]
    },
    {
        name: 'Funnel · Owner adquisición → publicación',
        description: 'Desde el inicio del registro hasta la publicación.',
        steps: [
            { type: 'event', event: 'sign_up_started' },
            { type: 'event', event: 'sign_up_completed' },
            { type: 'event', event: 'onboarding_started' },
            { type: 'event', event: 'accommodation_published' }
        ]
    },
    {
        name: 'Funnel · Suscripción',
        description: 'Checkout iniciado, suscripción activada y cargo exitoso.',
        steps: [
            { type: 'event', event: 'billing_checkout_started' },
            { type: 'event', event: 'billing_subscription_activated' },
            { type: 'event', event: 'billing_charge_succeeded' }
        ]
    }
] as const;

/** Conversion goals ported from the PostHog single-event trend KPIs. */
export const HOSPEDA_GOALS: readonly BuildGoalReportInput[] = [
    {
        name: 'Goal · Registros completados',
        description: 'Visitantes que completan el registro (reemplaza visitante → registro).',
        event: 'sign_up_completed'
    },
    {
        name: 'Goal · Alojamientos publicados',
        description: 'Visitantes que publican un alojamiento.',
        event: 'accommodation_published'
    },
    {
        name: 'Goal · Contactos completados',
        description: 'Visitantes que completan un contacto con un owner.',
        event: 'contact_owner_completed'
    },
    {
        name: 'Goal · Suscripciones activadas',
        description: 'Visitantes con una suscripción activada.',
        event: 'billing_subscription_activated'
    },
    {
        name: 'Goal · Pagos exitosos',
        description: 'Visitantes con un pago de suscripción confirmado.',
        event: 'billing_charge_succeeded'
    },
    {
        name: 'Goal · Trials convertidos a pago',
        description: 'Visitantes cuyo trial se convirtió a pago.',
        event: 'trial_converted'
    }
] as const;

/**
 * Builds every report ported from PostHog, in a fixed order (funnels, then
 * goals). Pure: two calls return deeply equal values.
 *
 * @returns Report definitions, ready for `upsertReport`
 * @throws {UmamiDefinitionError} If a definition names a non-catalog event
 *
 * @example
 * ```ts
 * const reports = buildReportDefinitions(); // 5 funnels + 6 goals
 * ```
 */
export function buildReportDefinitions(): readonly ReportDefinition[] {
    return [...HOSPEDA_FUNNELS.map(buildFunnelReport), ...HOSPEDA_GOALS.map(buildGoalReport)];
}

/** Dimensions accepted by the `MetricsTable` board component (measured). */
export const METRICS_TABLE_DIMENSIONS = [
    'path',
    'fullPath',
    'entry',
    'exit',
    'title',
    'query',
    'referrer',
    'channel',
    'country',
    'region',
    'city',
    'browser',
    'os',
    'device',
    'language',
    'screen',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
    'utmTerm',
    'event',
    'hostname'
] as const;

/** A `MetricsTable` dimension. */
export type MetricsTableDimension = (typeof METRICS_TABLE_DIMENSIONS)[number];

/** A board component, before report names are resolved to ids. */
export type BoardComponentSpec =
    | { readonly kind: 'metricsBar'; readonly title: string }
    | { readonly kind: 'eventsMetricsBar'; readonly title: string }
    | { readonly kind: 'visitorsChart'; readonly title: string }
    | { readonly kind: 'eventsChart'; readonly title: string }
    | {
          readonly kind: 'metricsTable';
          readonly title: string;
          readonly dimension: MetricsTableDimension;
          readonly limit?: number;
      }
    | { readonly kind: 'funnel'; readonly title: string; readonly reportName: string }
    | { readonly kind: 'goal'; readonly title: string; readonly reportName: string }
    | { readonly kind: 'text'; readonly title: string; readonly text: string };

/** Input of {@link buildBoardDefinition}. */
export interface BuildBoardDefinitionInput {
    /** Stable natural key of the board. */
    readonly name: string;
    readonly description: string;
    /** Umami website the board reads. */
    readonly websiteId: string;
    /** Rows of columns; one component per column. */
    readonly rows: readonly (readonly BoardComponentSpec[])[];
    /** Saved report name -> report id (from the upserts). */
    readonly reportIds: Readonly<Record<string, string>>;
}

function resolveReportId(input: {
    readonly reportName: string;
    readonly reportIds: Readonly<Record<string, string>>;
}): string {
    const id = Object.hasOwn(input.reportIds, input.reportName)
        ? input.reportIds[input.reportName]
        : undefined;
    if (id === undefined) {
        throw new UmamiDefinitionError({
            code: 'UNRESOLVED_REPORT',
            message: `Board references report "${input.reportName}" that has no id`,
            detail: input.reportName
        });
    }
    return id;
}

function buildComponent(input: {
    readonly spec: BoardComponentSpec;
    readonly reportIds: Readonly<Record<string, string>>;
}): { readonly [key: string]: JsonValue } {
    const { spec, reportIds } = input;
    const base = { title: spec.title, description: '' };
    switch (spec.kind) {
        case 'metricsBar':
            return { type: 'WebsiteMetricsBar', ...base };
        case 'eventsMetricsBar':
            return { type: 'EventsMetricsBar', ...base };
        case 'visitorsChart':
            return { type: 'WebsiteChart', ...base };
        case 'eventsChart':
            return { type: 'EventsChart', ...base };
        case 'metricsTable':
            return {
                type: 'MetricsTable',
                ...base,
                props: { type: spec.dimension, limit: spec.limit ?? 10 }
            };
        case 'funnel':
            return {
                type: 'Funnel',
                ...base,
                props: { reportId: resolveReportId({ reportName: spec.reportName, reportIds }) }
            };
        case 'goal':
            return {
                type: 'Goal',
                ...base,
                props: { reportId: resolveReportId({ reportName: spec.reportName, reportIds }) }
            };
        case 'text':
            return { type: 'TextBlock', ...base, props: { text: spec.text } };
    }
}

/**
 * Builds a `website` board. Layout shape follows the Umami 3.5.0 editor:
 * `parameters = { websiteId, rows: [{ id, columns: [{ id, component }] }] }`,
 * with `component = { type, title, description, props? }`. Row and column ids
 * are positional (`row-1`, `col-1-1`) so the output is deterministic; Umami's
 * editor generates random ids, which only matter for React keys.
 *
 * @param input - See {@link BuildBoardDefinitionInput}
 * @returns The board definition
 * @throws {UmamiDefinitionError} `UNRESOLVED_REPORT` when a funnel or goal
 * component names a report that is not in `reportIds`
 *
 * @example
 * ```ts
 * buildBoardDefinition({
 *   name: '00 · Hospeda — Resumen',
 *   description: '...',
 *   websiteId,
 *   rows: [[{ kind: 'metricsBar', title: 'Resumen' }]],
 *   reportIds: {}
 * });
 * ```
 */
export function buildBoardDefinition(input: BuildBoardDefinitionInput): BoardDefinition {
    const rows = input.rows.map((columns, rowIndex) => ({
        id: `row-${rowIndex + 1}`,
        columns: columns.map((spec, columnIndex) => ({
            id: `col-${rowIndex + 1}-${columnIndex + 1}`,
            component: buildComponent({ spec, reportIds: input.reportIds })
        }))
    }));
    return {
        name: input.name,
        type: 'website',
        description: input.description,
        parameters: { websiteId: input.websiteId, rows }
    };
}

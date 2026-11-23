import type { CatalogEventName, ReportDefinition } from './definitions.js';

/**
 * Campaign attribution reports created by `pnpm umami:setup` (HOS-2359, owner
 * decision OD-10).
 *
 * Each is a first-click `attribution` report on a conversion event, in the shape
 * measured on Umami 3.5.0 (HOS-2119 T-038):
 * `{ model: 'first-click', type: 'event', step }`. The 3.5.0 board editor has no
 * attribution component (HOS-2359 M-3), so these stay saved reports, opened from
 * Umami → Reports; the `Attribution` board shows the UTM breakdown and the goals.
 *
 * Kept out of `definitions.ts` (file-size limit). This module imports only TYPES
 * from there, so there is no runtime import cycle; the event names are checked at
 * compile time by `CatalogEventName`.
 */

/** Input of {@link buildAttributionReport}. */
export interface BuildAttributionReportInput {
    /** Stable natural key of the report. */
    readonly name: string;
    readonly description: string;
    /** Catalog conversion event the attribution walks back from. */
    readonly event: CatalogEventName;
}

/** The attribution reports, in setup order. */
export const HOSPEDA_ATTRIBUTION_REPORTS: readonly BuildAttributionReportInput[] = [
    {
        name: 'Atribución · Registros completados',
        description: 'Primer clic de campaña antes de completar el registro.',
        event: 'sign_up_completed'
    },
    {
        name: 'Atribución · Contactos completados',
        description: 'Primer clic de campaña antes de completar un contacto con un owner.',
        event: 'contact_owner_completed'
    }
] as const;

/**
 * Builds a first-click, event-step `attribution` report.
 *
 * @param input - See {@link BuildAttributionReportInput}
 * @returns The report definition, ready for `upsertReport`
 *
 * @example
 * ```ts
 * buildAttributionReport({ name: 'Atribución · X', description: '...', event: 'sign_up_completed' });
 * ```
 */
export function buildAttributionReport(input: BuildAttributionReportInput): ReportDefinition {
    return {
        name: input.name,
        type: 'attribution',
        description: input.description,
        parameters: { model: 'first-click', type: 'event', step: input.event }
    };
}

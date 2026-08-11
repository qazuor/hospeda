/**
 * @file editor-hub-status-model.ts
 * @description Per-section status lines for the editor hub (HOS-318 T-018).
 *
 * The second line under each hub row is what turns an index into a panel: not
 * "Fotos" but "Fotos — 6 fotos", not "Ubicación" but "Ubicación — ⚠ Sin
 * coordenadas". It is the value the long page could never give.
 *
 * ## OQ-3, resolved
 *
 * The spec asked whether `PublishPrecheckPanel.astro` could be the source.
 * It cannot: that panel answers "may this host create another listing?" from
 * draft counts and plan quota. It knows nothing about whether a given
 * accommodation has coordinates or photos. So the logic lives here.
 *
 * ## Two rules this file exists to enforce
 *
 * 1. **Never render a misleading zero.** A section with nothing meaningful to
 *    report gets NO second line, rather than "0 fotos" — apps/web's own rule
 *    against stats that read as a measurement when they are an absence.
 * 2. **Never signal by colour alone.** A warning carries its own words, so it
 *    survives greyscale, colour blindness and a screen reader.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How a status line should read. `warning` prefixes its own marker. */
export type EditorStatusTone = 'neutral' | 'warning';

/** One resolved status line. */
export interface EditorSectionStatus {
    readonly labelKey: string;
    readonly tone: EditorStatusTone;
    /** Interpolation values for the i18n string, when it takes any. */
    readonly params?: Readonly<Record<string, number>>;
}

/** The facts the hub needs to describe each section. */
export interface EditorStatusInput {
    readonly hasDescription: boolean;
    readonly maxGuests: number | null;
    readonly basePrice: number | null;
    readonly hasCoordinates: boolean;
    readonly amenityCount: number;
    readonly featureCount: number;
    readonly photoCount: number;
    readonly faqCount: number;
    readonly hasContact: boolean;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the status line for every section that has one.
 *
 * Sections absent from the returned map render no second line at all. Calendar,
 * translations and external reputation are deliberately absent: describing them
 * would need extra round-trips the hub should not pay for.
 *
 * @param params - The facts gathered from the loaded accommodation.
 * @returns Status lines keyed by section id. Missing key means "say nothing".
 */
export function resolveEditorSectionStatuses({
    input
}: {
    readonly input: EditorStatusInput;
}): Readonly<Record<string, EditorSectionStatus>> {
    const statuses: Record<string, EditorSectionStatus> = {};

    if (!input.hasDescription) {
        statuses.basicInfo = {
            labelKey: 'host.properties.editor.hub.status.missingDescription',
            tone: 'warning'
        };
    }

    if (input.basePrice === null) {
        statuses.capacityPricing = {
            labelKey: 'host.properties.editor.hub.status.missingPrice',
            tone: 'warning'
        };
    } else if (input.maxGuests !== null) {
        statuses.capacityPricing = {
            labelKey: 'host.properties.editor.hub.status.guests',
            tone: 'neutral',
            params: { count: input.maxGuests }
        };
    }

    if (!input.hasCoordinates) {
        statuses.location = {
            labelKey: 'host.properties.editor.hub.status.missingCoordinates',
            tone: 'warning'
        };
    }

    // A zero here is a real absence, not a measurement — so it warns instead of
    // reporting "0 seleccionados".
    const selected = input.amenityCount + input.featureCount;
    if (selected > 0) {
        statuses.amenities = {
            labelKey: 'host.properties.editor.hub.status.selected',
            tone: 'neutral',
            params: { count: selected }
        };
    }

    statuses.photos =
        input.photoCount > 0
            ? {
                  labelKey: 'host.properties.editor.hub.status.photos',
                  tone: 'neutral',
                  params: { count: input.photoCount }
              }
            : { labelKey: 'host.properties.editor.hub.status.missingPhotos', tone: 'warning' };

    if (input.faqCount > 0) {
        statuses.faqs = {
            labelKey: 'host.properties.editor.hub.status.faqs',
            tone: 'neutral',
            params: { count: input.faqCount }
        };
    }

    if (!input.hasContact) {
        statuses.contact = {
            labelKey: 'host.properties.editor.hub.status.missingContact',
            tone: 'warning'
        };
    }

    return statuses;
}

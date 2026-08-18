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
 * ## Three rules this file exists to enforce
 *
 * 1. **Never render a misleading zero.** A section with nothing meaningful to
 *    report gets NO second line, rather than "0 fotos" — apps/web's own rule
 *    against stats that read as a measurement when they are an absence.
 * 2. **Never signal by colour alone.** A warning carries its own words, so it
 *    survives greyscale, colour blindness and a screen reader.
 * 3. **Never warn about what does not block while staying silent about what
 *    does** (H-101). Measured failing in production: the hub warned "⚠ Sin
 *    fotos" and publishing succeeded anyway, while `bathrooms` and `minNights`
 *    blocked the publish with no mention anywhere in the editor — `minNights`
 *    did not appear in this file at all. The gate's list and this one had no
 *    field in common.
 *
 *    The fix is NOT to hand-copy the missing fields here, which would drift
 *    again the next time the gate changes. Blocking requirements are READ from
 *    `ACCOMMODATION_PUBLISH_REQUIREMENTS`, the very module
 *    `AccommodationService.publish()` rejects from.
 *
 * ## Blocking versus advisory
 *
 * The soft hints (description, price, coordinates, contact, FAQs) stay: they
 * are worth prompting for, and publishing without them is allowed. What changes
 * is that they no longer LOOK the same as a real blocker. A `blocking` status
 * says the listing cannot go live until it is resolved; a `warning` says the
 * listing would be better with it. Rendering both identically is what let
 * "⚠ Sin fotos" read as binding while being the opposite.
 */

import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    type AccommodationPublishReadinessInput,
    resolveMissingPublishRequirements
} from '@repo/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How a status line should read.
 *
 * - `neutral`  — a plain fact ("6 fotos").
 * - `warning`  — worth fixing, does not block publishing.
 * - `blocking` — publishing is refused until this is resolved.
 *
 * Each carries its own words, so the distinction survives greyscale and a
 * screen reader instead of living in the colour.
 */
export type EditorStatusTone = 'neutral' | 'warning' | 'blocking';

/** One resolved status line. */
export interface EditorSectionStatus {
    readonly labelKey: string;
    readonly tone: EditorStatusTone;
    /** Interpolation values for the i18n string, when it takes any. */
    readonly params?: Readonly<Record<string, number | string>>;
    /**
     * i18n keys naming the publish requirements this section is missing, in
     * requirement order. Set only on a `blocking` status — the renderer
     * translates each and lists them, so the host reads "Falta para publicar:
     * baños, noches mínimas" instead of a generic "algo falta".
     */
    readonly missingRequirementLabelKeys?: readonly string[];
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
    /**
     * What the publish gate will check. Passed straight through to
     * `resolveMissingPublishRequirements`, so the hub and the server reach the
     * same verdict by running the same code rather than two similar-looking
     * copies of it.
     */
    readonly publishReadiness: AccommodationPublishReadinessInput;
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

    // Blocking requirements are applied LAST, and they overwrite whatever
    // advisory line the section already had. That precedence is the point: a
    // section missing `bathrooms` used to render "8 huéspedes" — a calm,
    // complete-looking neutral line — over the very field refusing the publish.
    // Nothing may sit on top of a blocker.
    return { ...statuses, ...resolveBlockingStatuses({ input: input.publishReadiness }) };
}

/**
 * Builds one `blocking` status per editor section that owns an unmet publish
 * requirement.
 *
 * Several requirements can land on the same section (`capacity`, `minNights`,
 * `bedrooms` and `bathrooms` all live in capacity-and-price), so they are
 * grouped: one line naming every missing field, rather than four lines or — the
 * old behaviour — none.
 *
 * @param params - The readiness facts the publish gate will evaluate.
 * @returns Blocking statuses keyed by section id; empty when nothing blocks.
 */
function resolveBlockingStatuses({
    input
}: {
    readonly input: AccommodationPublishReadinessInput;
}): Record<string, EditorSectionStatus> {
    const missing = new Set<string>(resolveMissingPublishRequirements({ input }));
    if (missing.size === 0) return {};

    const bySection = new Map<string, string[]>();
    for (const requirement of ACCOMMODATION_PUBLISH_REQUIREMENTS) {
        if (!missing.has(requirement.id)) continue;
        const labelKeys = bySection.get(requirement.editorSectionId) ?? [];
        labelKeys.push(requirement.labelKey);
        bySection.set(requirement.editorSectionId, labelKeys);
    }

    const statuses: Record<string, EditorSectionStatus> = {};
    for (const [sectionId, labelKeys] of bySection) {
        statuses[sectionId] = {
            labelKey: 'host.properties.editor.hub.status.blockedFromPublishing',
            tone: 'blocking',
            missingRequirementLabelKeys: labelKeys
        };
    }
    return statuses;
}

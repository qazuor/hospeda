/**
 * @file accommodation.publish-requirements.ts
 * @description The single list of what an accommodation needs before it can be
 * published (H-101).
 *
 * ## Why this file exists
 *
 * There used to be TWO lists, written separately, that did not intersect:
 *
 * 1. **The server gate** — `AccommodationExtraInfoRequiredForPublishSchema`
 *    demanded `capacity`, `minNights`, `bedrooms`, `bathrooms`.
 * 2. **The editor hub warnings** — `resolveEditorSectionStatuses` warned about
 *    description, price, coordinates, photos and contact.
 *
 * Nothing in list 1 appeared in list 2. The measured result in production: the
 * hub showed "⚠ Sin fotos" and publishing succeeded anyway (leaving a public
 * page with a broken `<img>`), while `bathrooms` and `minNights` blocked the
 * publish with no warning anywhere in the editor — `minNights` was not even
 * mentioned by the editor in any form. The host read "faltan huéspedes" on a
 * form showing 11 guests and concluded, reasonably, that the site was broken.
 *
 * So this module is the ONE definition both sides consume. The server rejects
 * from it; the editor hub warns from it. Adding a requirement here makes it
 * appear in both places at once, which is the property that keeps the two from
 * drifting apart again.
 *
 * ## What belongs here, and what does not
 *
 * A requirement in this list BLOCKS publication. The softer editor hints
 * (description, price, coordinates, contact, FAQs) stay in
 * `resolveEditorSectionStatuses` as advice: they are worth prompting for but
 * publishing without them is allowed. The distinction is the whole point — the
 * old hub rendered both kinds identically, so "⚠ Sin fotos" looked exactly as
 * binding as a real blocker while being the opposite.
 *
 * The main image is a requirement by owner decision (14/08): with it, "avisa y
 * no bloquea" becomes "avisa y bloquea", which was the reading the warning
 * always implied.
 *
 * ## How a rejection reaches the browser
 *
 * NOT through `error.details`. `handleRouteError` strips `details` whenever
 * `HOSPEDA_API_DEBUG_ERRORS` is false, and that flag is REQUIRED to be false in
 * production — so a `ServiceError`-driven 400 arrives with `details: undefined`
 * for every real user. `error.reason` is emitted unconditionally and is
 * therefore the only channel that survives, which is what
 * {@link buildPublishRequirementsReason} encodes and
 * {@link parsePublishRequirementsReason} reads back.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifier of one publish requirement. */
export type AccommodationPublishRequirementId =
    | 'capacity'
    | 'minNights'
    | 'bedrooms'
    | 'bathrooms'
    | 'mainImage';

/**
 * The facts a publish check needs, gathered from wherever the caller holds
 * them. Deliberately NOT the full `Accommodation`: the server reads `extraInfo`
 * plus a media lookup, the editor hub reads its already-loaded editor payload,
 * and neither should have to shape itself like the other to ask the question.
 */
export interface AccommodationPublishReadinessInput {
    readonly capacity?: number | null;
    readonly minNights?: number | null;
    readonly bedrooms?: number | null;
    readonly bathrooms?: number | null;
    /** Whether the listing has a main image. Owner decision (14/08). */
    readonly hasMainImage: boolean;
}

/** One blocking requirement, and where in the editor it gets resolved. */
export interface AccommodationPublishRequirement {
    readonly id: AccommodationPublishRequirementId;
    /**
     * The `EditorSection.id` that owns the field. The hub uses it to attach the
     * warning to the row that can actually fix it — the missing half of H-94,
     * where a blocking field had no surface pointing at it.
     */
    readonly editorSectionId: string;
    /** i18n key for the field's own name, so a message can name it. */
    readonly labelKey: string;
    /** Whether this requirement is met. */
    readonly isSatisfied: (input: AccommodationPublishReadinessInput) => boolean;
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/**
 * Reads a numeric requirement, treating `null` and `undefined` alike and
 * accepting `0` as a real answer.
 *
 * A truthiness check would reject a studio with `bathrooms: 0` or a listing
 * with `minNights: 0`, both legitimately supplied values.
 *
 * @param value - The stored value.
 * @returns True when the host actually answered.
 */
function isAnswered(value: number | null | undefined): boolean {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Every requirement that blocks publication, in the order a host meets them.
 *
 * Order matters only for presentation: a message listing several missing fields
 * reads better following the editor's own section order.
 */
export const ACCOMMODATION_PUBLISH_REQUIREMENTS: readonly AccommodationPublishRequirement[] = [
    {
        id: 'capacity',
        editorSectionId: 'capacityPricing',
        labelKey: 'host.properties.editor.publishRequirement.capacity',
        isSatisfied: (input) => isAnswered(input.capacity)
    },
    {
        id: 'minNights',
        editorSectionId: 'capacityPricing',
        labelKey: 'host.properties.editor.publishRequirement.minNights',
        isSatisfied: (input) => isAnswered(input.minNights)
    },
    {
        id: 'bedrooms',
        editorSectionId: 'capacityPricing',
        labelKey: 'host.properties.editor.publishRequirement.bedrooms',
        isSatisfied: (input) => isAnswered(input.bedrooms)
    },
    {
        id: 'bathrooms',
        editorSectionId: 'capacityPricing',
        labelKey: 'host.properties.editor.publishRequirement.bathrooms',
        isSatisfied: (input) => isAnswered(input.bathrooms)
    },
    {
        id: 'mainImage',
        editorSectionId: 'photos',
        labelKey: 'host.properties.editor.publishRequirement.mainImage',
        isSatisfied: (input) => input.hasMainImage
    }
] as const;

/** Every declared requirement id, for membership checks. */
const REQUIREMENT_IDS: ReadonlySet<string> = new Set(
    ACCOMMODATION_PUBLISH_REQUIREMENTS.map((requirement) => requirement.id)
);

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Lists every requirement the listing does not yet meet.
 *
 * Returns ALL of them, never just the first: reporting one at a time is what
 * turns publishing into a guessing loop where the host fixes a field, retries,
 * and is told about the next one.
 *
 * @param params - The gathered readiness facts.
 * @returns The ids of the unmet requirements, in list order. Empty means the
 *   listing may be published as far as completeness is concerned.
 */
export function resolveMissingPublishRequirements({
    input
}: {
    readonly input: AccommodationPublishReadinessInput;
}): readonly AccommodationPublishRequirementId[] {
    return ACCOMMODATION_PUBLISH_REQUIREMENTS.filter(
        (requirement) => !requirement.isSatisfied(input)
    ).map((requirement) => requirement.id);
}

/**
 * Narrows an arbitrary string to a known requirement id.
 *
 * @param value - The candidate id, typically off the wire.
 * @returns True when it names a declared requirement.
 */
export function isAccommodationPublishRequirementId(
    value: string
): value is AccommodationPublishRequirementId {
    return REQUIREMENT_IDS.has(value);
}

// ---------------------------------------------------------------------------
// The `reason` wire format
// ---------------------------------------------------------------------------

/**
 * Prefix marking a `ServiceError.reason` that carries missing publish
 * requirements.
 */
export const PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX = 'PUBLISH_REQUIREMENTS_MISSING:';

/**
 * Encodes the missing requirements into a machine-readable `reason`.
 *
 * Lives here rather than at the throw site so the producer and the consumer
 * cannot spell the format differently — the same single-definition rule this
 * whole module exists to enforce.
 *
 * @param params - The unmet requirement ids.
 * @returns The `reason` string to attach to the `ServiceError`.
 */
export function buildPublishRequirementsReason({
    missing
}: {
    readonly missing: readonly AccommodationPublishRequirementId[];
}): string {
    return `${PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX}${missing.join(',')}`;
}

/**
 * Reads a `reason` back into the requirement ids it carries.
 *
 * Unknown names are dropped rather than passed through: the value arrives over
 * the wire, and the UI looks each id up in its own label table.
 *
 * @param params - The `reason` from the API error payload, if any.
 * @returns The requirement ids, or an empty list when the reason is absent or
 *   describes something else entirely (a subscription rejection, say).
 */
export function parsePublishRequirementsReason({
    reason
}: {
    readonly reason: string | null | undefined;
}): readonly AccommodationPublishRequirementId[] {
    if (!reason?.startsWith(PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX)) return [];

    return reason
        .slice(PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX.length)
        .split(',')
        .map((part) => part.trim())
        .filter(isAccommodationPublishRequirementId);
}

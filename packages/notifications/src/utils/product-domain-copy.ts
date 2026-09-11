/**
 * Vertical-aware copy fragments for billing emails whose wording assumed a
 * single vertical — accommodation — for every recipient (HOS-1283).
 *
 * This package does not depend on `@repo/schemas` (see the
 * `PartnerMentionEntryPayload` doc in `types/notification.types.ts`), so every
 * function here takes the raw `billing_subscriptions.product_domain` string
 * rather than the `ProductDomainEnum` member, and switches on the literal
 * values instead of importing the enum.
 *
 * `resolveTrialSeriesCopy` only branches on `'gastronomy'` and `'experience'`
 * beyond the accommodation default: those are the only two verticals whose
 * subscriptions can currently reach the trial series at all, alongside
 * accommodation itself — `createTrialSubscription` (`apps/api`) has exactly
 * two callers, one for accommodation's first publish and one for a
 * gastronomy/experience listing's first publish (HOS-1184). `tourist` and
 * `partner` never create a local, Hospeda-owned trial today (neither has a
 * "first publish" event — see HOS-1283's investigation), so there is no
 * vertical copy to write for them yet; the fallback below covers them safely
 * if that ever changes, but doing so well is a product decision, not
 * something to improvise here.
 *
 * `resolveRenewalReminderFooter` covers all five business verticals, because
 * `RENEWAL_REMINDER` fires for every paid subscription regardless of domain
 * (`notification-schedule.job.ts` iterates every active subscription, not
 * just accommodation's).
 *
 * @module utils/product-domain-copy
 */

/**
 * Vertical-specific copy fragments shared by the nine trial-series templates.
 *
 * Every field is a drop-in replacement for a phrase that assumed accommodation
 * in the pre-HOS-1283 templates. The accommodation values below are the exact
 * original wording — a candidate with no (or an accommodation) `productDomain`
 * renders byte-identical output to before this change.
 */
export interface TrialSeriesVerticalCopy {
    /** e.g. "tu alojamiento" / "tu local" / "tu experiencia". */
    readonly possessive: string;
    /** The verb-phrase a searcher is looking for, e.g. "dónde quedarse". */
    readonly searchIntent: string;
    /** InfoRow label for what a listing carries beyond photos/description. */
    readonly detailsLabel: string;
    /** Sentence fragment naming everything the trial keeps on file. */
    readonly savedItemsLine: string;
    /** Tip bullet about writing a good description. */
    readonly descriptionTip: string;
    /** Tip bullet about completing the vertical-specific details. */
    readonly detailsTip: string;
    /** Comma-joined saved-fields list used in the expiry email's alert box. */
    readonly expiredSavedLine: string;
}

/** Original accommodation wording — unchanged from the pre-HOS-1283 templates. */
const ACCOMMODATION_TRIAL_COPY: TrialSeriesVerticalCopy = {
    possessive: 'tu alojamiento',
    searchIntent: 'dónde quedarse',
    detailsLabel: 'servicios',
    savedItemsLine: 'Tus fotos, tu descripción, tus servicios y tus datos',
    descriptionTip:
        'Una descripción que cuente cómo se vive el alojamiento, no sólo cuántas camas tiene.',
    detailsTip: 'Los servicios cargados completos: es lo que la gente filtra al buscar.',
    expiredSavedLine: 'fotos, descripción, servicios, ubicación y datos de contacto'
};

/** Vocabulary matches the gastronomy landing page (`commerce.json`'s `landing.gastronomy`). */
const GASTRONOMY_TRIAL_COPY: TrialSeriesVerticalCopy = {
    possessive: 'tu local',
    searchIntent: 'dónde comer',
    detailsLabel: 'menú',
    savedItemsLine: 'Tus fotos, tu menú, tus horarios y tus datos',
    descriptionTip:
        'Un menú actualizado con tus platos y precios reales, no sólo el nombre del local.',
    detailsTip: 'Los horarios y el menú cargados completos: es lo que la gente filtra al buscar.',
    expiredSavedLine: 'fotos, menú, horarios, ubicación y datos de contacto'
};

/** Vocabulary matches the experience landing page (`commerce.json`'s `landing.experience`). */
const EXPERIENCE_TRIAL_COPY: TrialSeriesVerticalCopy = {
    possessive: 'tu experiencia',
    searchIntent: 'qué experiencias hacer',
    detailsLabel: 'horarios',
    savedItemsLine: 'Tus fotos, tu descripción, tus horarios y tus datos',
    descriptionTip: 'Una descripción que cuente cómo se vive la experiencia, no sólo la duración.',
    detailsTip: 'Los horarios y cupos cargados completos: es lo que la gente filtra al buscar.',
    expiredSavedLine: 'fotos, descripción, horarios, ubicación y datos de contacto'
};

/**
 * Resolves the trial-series copy fragments for a subscription's vertical.
 *
 * Fails OPEN to accommodation for `null`, `undefined`, `'accommodation'`
 * itself, or any value not explicitly branched (`'tourist'`, `'partner'`,
 * `'addon'`, or a future one) — matching this repo's standing fail-open
 * convention for the accommodation domain (`subscriptionMatchesDomain`'s doc
 * in `@repo/service-core`). Accommodation is the vertical every one of these
 * nine templates was originally written for, so an unrecognized value
 * reproducing that copy is a safe default, never a silent misfire.
 */
export function resolveTrialSeriesCopy(
    productDomain: string | null | undefined
): TrialSeriesVerticalCopy {
    if (productDomain === 'gastronomy') return GASTRONOMY_TRIAL_COPY;
    if (productDomain === 'experience') return EXPERIENCE_TRIAL_COPY;
    return ACCOMMODATION_TRIAL_COPY;
}

/**
 * Resolves the closing line of `RenewalReminder` (`templates/billing/renewal-reminder.tsx`).
 *
 * Unlike the trial series, `RENEWAL_REMINDER` fires for an active subscription
 * in ANY of the five business verticals (`notification-schedule.job.ts` does
 * not scope its sweep to accommodation), so all five get their own line here
 * rather than a three-way branch plus a shared fallback. The original,
 * accommodation-only sentence is preserved verbatim for `'accommodation'` and
 * for the fail-open default (`null`/`undefined`/unrecognized).
 */
export function resolveRenewalReminderFooter(productDomain: string | null | undefined): string {
    switch (productDomain) {
        case 'gastronomy':
            return 'Gracias por confiar en Hospeda para hacer crecer tu local gastronómico.';
        case 'experience':
            return 'Gracias por confiar en Hospeda para hacer crecer tu experiencia turística.';
        case 'tourist':
            return 'Gracias por confiar en Hospeda para tus próximos viajes.';
        case 'partner':
            return 'Gracias por confiar en Hospeda para tu alianza comercial.';
        default:
            return 'Gracias por confiar en Hospeda para tus necesidades de alojamiento turístico.';
    }
}

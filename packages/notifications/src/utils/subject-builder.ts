import { NotificationType } from '../types/notification.types.js';

/**
 * Maps notification types to Spanish email subject line patterns.
 * Supports template variables using {variableName} syntax.
 */
const SUBJECT_PATTERNS: Record<NotificationType, string> = {
    [NotificationType.SUBSCRIPTION_PURCHASE]: 'Confirmación de compra - {planName}',
    // `{addonName}` since HOS-722: this type is served by its own
    // `AddonPurchaseConfirmationPayload`, which carries `addonName`. It was
    // `{planName}` before that, because the type shared
    // `PurchaseConfirmationPayload` with SUBSCRIPTION_PURCHASE and the emitter
    // had to smuggle the add-on's name through the `planName` field. The
    // placeholder must always name a field the payload actually has —
    // naming one that does not is what made every addon receipt arrive titled
    // "Add-on adquirido - {addonName}".
    [NotificationType.ADDON_PURCHASE]: 'Add-on adquirido - {addonName}',
    [NotificationType.PAYMENT_SUCCESS]: 'Pago recibido - ${amount}',
    [NotificationType.PAYMENT_FAILURE]: 'Error en tu pago - Acción requerida',
    [NotificationType.RENEWAL_REMINDER]: 'Tu suscripción se renueva pronto - {planName}',
    [NotificationType.PLAN_CHANGE_CONFIRMATION]: 'Cambio de plan confirmado',
    [NotificationType.ADDON_EXPIRATION_WARNING]: 'Tu add-on {addonName} expira pronto',
    [NotificationType.ADDON_EXPIRED]: 'Tu add-on {addonName} ha expirado',
    [NotificationType.ADDON_RENEWAL_CONFIRMATION]: 'Add-on renovado - {addonName}',
    [NotificationType.TRIAL_ENDING_REMINDER]: 'Tu período de prueba termina pronto',
    [NotificationType.ADMIN_PAYMENT_FAILURE]: '[Admin] Fallo de pago - {userEmail}',
    [NotificationType.ADMIN_SYSTEM_EVENT]: '[Admin] Evento del sistema - {eventType}',
    // New acquisition lead (H-62 / H-148). Names the program and the applicant
    // because ops triages these from the inbox list: "another lead" tells an
    // operator nothing they can act on without opening the admin, which is the
    // dependency this alert exists to remove.
    [NotificationType.ADMIN_LEAD_RECEIVED]: '[Admin] Nuevo lead de {programLabel} — {contactName}',
    [NotificationType.FEEDBACK_REPORT]: '[{reportType}] {reportTitle}',
    [NotificationType.CONTACT_SUBMISSION]: '[Contacto] {contactType} - {senderName}',
    [NotificationType.SUBSCRIPTION_CANCELLED]: 'Tu suscripción {planName} ha sido cancelada',
    [NotificationType.SUBSCRIPTION_PAUSED]:
        'Tu suscripción {planName} ha sido pausada - Acción requerida',
    [NotificationType.SUBSCRIPTION_REACTIVATED]: 'Tu suscripción {planName} ha sido reactivada',
    [NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING]:
        'Límite reducido en tu plan {planName} - Revisá tu contenido',
    [NotificationType.PAYMENT_RETRY_WARNING]:
        'Problema con tu pago - Intento {failureCount} de {maxRetries}',
    [NotificationType.ADDON_CANCELLATION]: 'Tu complemento {addonName} ha sido cancelado',

    // Newsletter (SPEC-101)
    [NotificationType.NEWSLETTER_VERIFICATION]: 'Confirmá tu suscripción al newsletter de Hospeda',
    [NotificationType.NEWSLETTER_WELCOME]: 'Bienvenido al newsletter de Hospeda',
    [NotificationType.NEWSLETTER_CAMPAIGN]: '{subject}',

    // AI cost threshold alert (SPEC-173 T-025)
    [NotificationType.AI_COST_THRESHOLD_ALERT]:
        '[Admin] Alerta de costo IA — {thresholdPct}% del presupuesto ({scope})',

    // Soft-cancel confirmation (SPEC-147)
    [NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED]:
        'Cancellation confirmed — {planName} access until {accessUntil}',

    // D3 access-ending reminder (SPEC-147 T-010)
    [NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON]:
        'Your {planName} access ends in {daysRemaining} days — act now to keep it',

    // Plan retirement notification (SPEC-148)
    [NotificationType.PLAN_BEING_RETIRED]:
        'Important: {planName} is being retired — your access continues until {accessUntil}',

    // Alliance claim invitation (HOS-278 §6.2)
    [NotificationType.ALLIANCE_CLAIM_INVITE]:
        '¿Postulaste a {programLabel} en Hospeda? Confirmanos que fuiste vos',

    // Alliance application resolved (HOS-278 AC-6). One line for both
    // outcomes: a subject that announced the verdict would deliver it in the
    // inbox list, where a rejection lands with no context around it.
    [NotificationType.ALLIANCE_LEAD_DECISION]:
        'Novedades sobre tu postulación a {programLabel} en Hospeda',

    // Listing revoked (HOS-278 R-4). Names the listing so a provider with more
    // than one knows which; the reason stays in the body, where it has room.
    [NotificationType.HOST_TRADE_REVOKED]:
        'Tu ficha {listingName} ya no aparece en el directorio de Hospeda',

    // The usage chain (HOS-376). Each names the counterpart, because a busy
    // provider or host has several of these open and the inbox line is the
    // only place they can tell them apart before opening anything.
    [NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REQUEST]:
        '{counterpartName} registró un uso del beneficio: ¿nos lo confirmás?',
    [NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REMINDER]:
        'Sigue pendiente el uso del beneficio con {counterpartName}',
    [NotificationType.HOST_TRADE_USAGE_CONFIRMED]:
        '{counterpartName} confirmó el uso del beneficio',
    [NotificationType.HOST_TRADE_USAGE_REJECTED]:
        '{counterpartName} no reconoció el uso del beneficio',
    [NotificationType.HOST_TRADE_REVIEW_RECEIVED]: 'Recibiste una valoración en {listingName}',
    // Says nothing about the outcome: the same subject serves an approval and a
    // rejection, so a provider opening it is not braced for bad news before
    // reading which it was.
    [NotificationType.HOST_TRADE_REPLY_MODERATED]: 'Novedades sobre tu respuesta en Hospeda',

    // Partner revoked (HOS-278 R-4). Names the partner for the same reason,
    // and says "aliados" rather than "directorio": a partner was never in the
    // provider directory, so naming it would describe the wrong takedown.
    [NotificationType.PARTNER_REVOKED]: '{partnerName} ya no aparece entre los aliados de Hospeda',

    // Unpaid partner nudge (HOS-278 R-3). States the fact, not a deadline
    // countdown: the exact day lives in the body, where "no se borra nada" can
    // sit next to it.
    [NotificationType.PARTNER_UNPAID_NOTICE]: '{partnerName} todavía no está publicado',

    // Mentions logged (HOS-377 AC-9). Says what was DONE and nothing about how
    // it performed: "difundimos" is an action Hospeda actually took, whereas
    // anything shaped like "el alcance de {partnerName}" promises a number the
    // platform does not measure and will never be able to produce (AC-3).
    [NotificationType.PARTNER_MENTIONS_LOGGED]: 'Difundimos {partnerName} el {mentionedAtLabel}',

    // Broken iCal feed alert to the host (HOS-162 Phase 3)
    [NotificationType.ACCOMMODATION_CALENDAR_FEED_BROKEN]:
        'Tu calendario de {providerLabel} dejó de sincronizarse — {accommodationName}',

    // Plan price-increase advance notice (HOS-176)
    // TODO(HOS-176 D-3): PROVISIONAL copy — pending legal sign-off before enabling the increase flag.
    [NotificationType.PLAN_PRICE_CHANGE_NOTICE]:
        'Aviso previo: el precio de tu plan {planName} aumentará desde el {effectiveDate}'
};

/**
 * Generic fallback subject for unknown notification types
 */
const FALLBACK_SUBJECT = 'Notificación de Hospeda';

/** Matches a `{placeholder}` token inside a subject pattern. */
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Lists the template variables a notification type's subject declares.
 *
 * Exposed so callers can resolve exactly the variables a subject needs instead
 * of maintaining a parallel, hand-written list of them — the drift between
 * those two lists is what shipped `{counterpartName}` to real inboxes
 * (H-64 / H-75).
 *
 * @param params - `{ type }` the notification type to inspect.
 * @returns `{ placeholders }` in declaration order, without duplicates. Empty
 *   for a static subject or an unknown type.
 *
 * @example
 * ```ts
 * getSubjectPlaceholders({ type: NotificationType.PARTNER_MENTIONS_LOGGED })
 * // => { placeholders: ['partnerName', 'mentionedAtLabel'] }
 * ```
 */
export function getSubjectPlaceholders(params: { readonly type: NotificationType }): {
    readonly placeholders: readonly string[];
} {
    const pattern = SUBJECT_PATTERNS[params.type];

    if (!pattern) {
        return { placeholders: [] };
    }

    const found = new Set<string>();
    for (const match of pattern.matchAll(PLACEHOLDER_PATTERN)) {
        const key = match[1];
        if (key !== undefined) {
            found.add(key);
        }
    }

    return { placeholders: [...found] };
}

/**
 * Reports whether a built subject still carries template syntax.
 *
 * A subject is the only part of an email visible before it is opened, so a
 * surviving `{placeholder}` there reads as a broken message or as phishing.
 * Callers use this as a last line of defence before handing the string to a
 * transport.
 *
 * @param params - `{ subject }` the already-interpolated subject line.
 * @returns `{ unresolved }` — the placeholder names still present, empty when
 *   the subject is clean.
 *
 * @example
 * ```ts
 * findUnresolvedPlaceholders({ subject: '{partnerName} todavía no está publicado' })
 * // => { unresolved: ['partnerName'] }
 * ```
 */
export function findUnresolvedPlaceholders(params: { readonly subject: string }): {
    readonly unresolved: readonly string[];
} {
    const found = new Set<string>();
    for (const match of params.subject.matchAll(PLACEHOLDER_PATTERN)) {
        const key = match[1];
        if (key !== undefined) {
            found.add(key);
        }
    }

    return { unresolved: [...found] };
}

/**
 * The subject used when interpolation could not be completed.
 *
 * Deliberately the same generic line an unknown type falls back to: it says
 * nothing false, and it never publishes the template's own syntax.
 */
export const SAFE_FALLBACK_SUBJECT = FALLBACK_SUBJECT;

/**
 * Replaces template variables in a subject pattern with actual values.
 * Variables use {variableName} syntax.
 *
 * @param pattern - Subject pattern with template variables
 * @param data - Key-value pairs for variable replacement
 * @returns Subject with variables replaced, or original pattern if variable missing
 *
 * @example
 * ```ts
 * replacePlaceholders('Hello {name}', { name: 'John' })
 * // => 'Hello John'
 *
 * replacePlaceholders('Hello {name}', {})
 * // => 'Hello {name}' (placeholder preserved)
 * ```
 */
function replacePlaceholders(pattern: string, data: Record<string, string>): string {
    return pattern.replace(/\{(\w+)\}/g, (match, key) => {
        return data[key] === undefined ? match : data[key];
    });
}

/**
 * Gets the email subject line for a notification type.
 * Returns a Spanish subject line with template variables replaced.
 *
 * @param type - The notification type
 * @param data - Template variable values (e.g., planName, addonName, amount)
 * @returns Localized subject line with variables replaced
 *
 * @example
 * ```ts
 * getSubject(NotificationType.SUBSCRIPTION_PURCHASE, { planName: 'Pro' })
 * // => 'Confirmación de compra - Pro'
 *
 * getSubject(NotificationType.PAYMENT_SUCCESS, { amount: '1500' })
 * // => 'Pago recibido - $1500'
 *
 * // Missing variables are preserved
 * getSubject(NotificationType.ADDON_PURCHASE, {})
 * // => 'Add-on adquirido - {addonName}'
 *
 * // Unknown types return generic fallback
 * getSubject('unknown_type' as NotificationType, {})
 * // => 'Notificación de Hospeda'
 * ```
 */
export function getSubject(type: NotificationType, data: Record<string, string>): string {
    const pattern = SUBJECT_PATTERNS[type];

    if (!pattern) {
        return FALLBACK_SUBJECT;
    }

    return replacePlaceholders(pattern, data);
}

import { NotificationType } from '../types/notification.types.js';

/**
 * Maps notification types to Spanish email subject line patterns.
 * Supports template variables using {variableName} syntax.
 */
const SUBJECT_PATTERNS: Record<NotificationType, string> = {
    [NotificationType.SUBSCRIPTION_PURCHASE]: 'Confirmación de compra - {planName}',
    [NotificationType.ADDON_PURCHASE]: 'Add-on adquirido - {addonName}',
    [NotificationType.PAYMENT_SUCCESS]: 'Pago recibido - ${amount}',
    [NotificationType.PAYMENT_FAILURE]: 'Error en tu pago - Acción requerida',
    [NotificationType.RENEWAL_REMINDER]: 'Tu suscripción se renueva pronto - {planName}',
    [NotificationType.PLAN_CHANGE_CONFIRMATION]: 'Cambio de plan confirmado',
    [NotificationType.ADDON_EXPIRATION_WARNING]: 'Tu add-on {addonName} expira pronto',
    [NotificationType.ADDON_EXPIRED]: 'Tu add-on {addonName} ha expirado',
    [NotificationType.ADDON_RENEWAL_CONFIRMATION]: 'Add-on renovado - {addonName}',
    [NotificationType.TRIAL_ENDING_REMINDER]: 'Tu período de prueba termina pronto',
    [NotificationType.TRIAL_EXPIRED]: 'Tu período de prueba ha finalizado',
    [NotificationType.ADMIN_PAYMENT_FAILURE]: '[Admin] Fallo de pago - {userEmail}',
    [NotificationType.ADMIN_SYSTEM_EVENT]: '[Admin] Evento del sistema - {eventType}',
    [NotificationType.FEEDBACK_REPORT]: '[{reportType}] {reportTitle}',
    [NotificationType.SUBSCRIPTION_CANCELLED]: 'Tu suscripción {planName} ha sido cancelada',
    [NotificationType.SUBSCRIPTION_PAUSED]:
        'Tu suscripción {planName} ha sido pausada - Acción requerida',
    [NotificationType.SUBSCRIPTION_REACTIVATED]: 'Tu suscripción {planName} ha sido reactivada'
};

/**
 * Generic fallback subject for unknown notification types
 */
const FALLBACK_SUBJECT = 'Notificación de Hospeda';

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
        return data[key] !== undefined ? data[key] : match;
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

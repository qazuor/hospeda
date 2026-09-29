/**
 * @file ai-chat-copy.ts
 * @description Copy resolution for the listing AI chat widget (HOS-400,
 * HOS-1264): which i18n key each string lives under per vertical, the human
 * fallback used when a key does not resolve in the browser bundle, and the
 * mapping from an API failure to readable text.
 *
 * The namespace prefixes below are written as FULL string literals on purpose.
 * `test/lib/i18n-client-namespaces.guard.test.ts` discovers what the browser
 * names by scanning literals, so spelling `'gastronomy.aiChat'` out is what
 * makes that guard demand its entry in `CLIENT_I18N_KEY_PREFIXES`. A bare
 * `'gastronomy'` (the previous shape) was invisible to it, the prefix was never
 * shipped, and the panel printed raw keys (HOS-1264).
 *
 * @module lib/ai-chat-copy
 */

import type { AiChatEntityType } from '@repo/schemas';

/** Translation function shape used here (matches `createTranslations().t`). */
export type AiChatTranslate = (key: string, fallback?: string) => string;

/**
 * Where each vertical's chat copy lives. Full literals, see the file header.
 */
const AI_CHAT_PREFIX_BY_ENTITY_TYPE: Readonly<Record<AiChatEntityType, string>> = {
    accommodation: 'accommodations.aiChat',
    gastronomy: 'gastronomy.aiChat',
    experience: 'experience.aiChat'
};

/** The shared (vertical-agnostic) copy stays in the accommodations bundle. */
const SHARED_PREFIX = 'accommodations.aiChat';

/** The copy keys that differ per vertical; every other key is shared. */
const VERTICAL_SPECIFIC_KEYS = new Set([
    'fabLabel',
    'panelLabel',
    'headerDisclaimer',
    'priceDisclaimer',
    'unavailable'
]);

/**
 * Builds the i18n key for one chat copy string.
 *
 * @param entityType - The listing's vertical.
 * @param suffix - The key under `<ns>.aiChat.`.
 * @returns The fully-qualified key.
 */
export function aiChatCopyKey(entityType: AiChatEntityType, suffix: string): string {
    const prefix = VERTICAL_SPECIFIC_KEYS.has(suffix)
        ? AI_CHAT_PREFIX_BY_ENTITY_TYPE[entityType]
        : SHARED_PREFIX;
    return `${prefix}.${suffix}`;
}

/**
 * Sentinel passed as `t()`'s fallback to tell a real translation apart from a
 * miss. Necessary because `t()` returns the KEY ITSELF for an unknown key in
 * production (only DEV yields `[MISSING: ...]`) - which is exactly how a raw
 * `accommodations.aiChat.unavailable` ended up on screen (HOS-292) and, again,
 * three raw `gastronomy.aiChat.*` keys (HOS-1264).
 */
const UNRESOLVED = '__hospeda_unresolved__';

/** Looks like a dotted i18n key rather than human prose. */
const I18N_KEY_PATTERN = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;

/** Spanish noun phrase naming the thing being asked about, per vertical. */
const SUBJECT_BY_ENTITY_TYPE: Readonly<Record<AiChatEntityType, string>> = {
    accommodation: 'alojamiento',
    gastronomy: 'local',
    experience: 'experiencia'
};

/** Demonstrative ("este"/"esta") agreeing with the noun above. */
const DEMONSTRATIVE_BY_ENTITY_TYPE: Readonly<Record<AiChatEntityType, string>> = {
    accommodation: 'este',
    gastronomy: 'este',
    experience: 'esta'
};

/** "este alojamiento" / "este local" / "esta experiencia". */
function subjectOf(entityType: AiChatEntityType): string {
    return `${DEMONSTRATIVE_BY_ENTITY_TYPE[entityType]} ${SUBJECT_BY_ENTITY_TYPE[entityType]}`;
}

/** Human Spanish copy for the strings that name the vertical. */
function verticalFallback(entityType: AiChatEntityType, suffix: string): string | undefined {
    const subject = subjectOf(entityType);
    const noun = SUBJECT_BY_ENTITY_TYPE[entityType];
    switch (suffix) {
        case 'fabLabel':
            return `Preguntarle a la IA sobre ${subject}`;
        case 'panelLabel':
            return `Chat con IA — Preguntas sobre ${entityType === 'experience' ? 'la' : 'el'} ${noun}`;
        case 'headerDisclaimer':
            return `Las respuestas son generadas por IA y pueden contener errores. Verificá siempre la información con ${entityType === 'experience' ? 'la' : 'el'} ${noun}.`;
        case 'priceDisclaimer':
            return `Los precios y horarios pueden haber cambiado. Contactá ${entityType === 'experience' ? 'a la' : 'al'} ${noun} para confirmar.`;
        case 'unavailable':
            return `El chat de IA no está disponible para ${subject}.`;
        default:
            return undefined;
    }
}

/** Human Spanish copy for the vertical-agnostic strings. */
const SHARED_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
    placeholder: 'Escribí tu pregunta aquí…',
    send: 'Enviar',
    sending: 'Enviando…',
    thinking: 'Pensando…',
    errorDefault: 'No se pudo mostrar la respuesta. Por favor intentá de nuevo.',
    atCapMessage: 'Alcanzaste el límite de esta conversación.',
    newConversation: 'Nueva conversación',
    close: 'Cerrar chat',
    expand: 'Expandir panel',
    collapse: 'Reducir panel'
});

/**
 * Resolves one chat copy string, never returning a raw key.
 *
 * A miss (`t()` echoing the sentinel back) falls to human Spanish copy for the
 * vertical, and as a last resort to an empty string, which renders nothing
 * rather than a dotted identifier.
 *
 * @param input.t - Translation function.
 * @param input.entityType - The listing's vertical.
 * @param input.suffix - The key under `<ns>.aiChat.`.
 * @returns Readable copy.
 */
export function resolveAiChatCopy({
    t,
    entityType,
    suffix
}: {
    readonly t: AiChatTranslate;
    readonly entityType: AiChatEntityType;
    readonly suffix: string;
}): string {
    const translated = t(aiChatCopyKey(entityType, suffix), UNRESOLVED);
    if (translated !== UNRESOLVED) return translated;
    return verticalFallback(entityType, suffix) ?? SHARED_FALLBACKS[suffix] ?? '';
}

/**
 * Localized copy per error code, used when the API's `message` is not a key we
 * can resolve. ENTITLEMENT_REQUIRED is handled separately through
 * {@link resolveAiChatCopy} so it uses the vertical's own copy.
 */
function errorFallback(entityType: AiChatEntityType, code: string): string | undefined {
    const subject = subjectOf(entityType);
    const fallbacks: Readonly<Record<string, string>> = {
        UNAUTHORIZED: 'Necesitás iniciar sesión para usar el chat.',
        NOT_FOUND: `No encontramos ${subject}.`,
        LIMIT_REACHED: `El chat de IA no está disponible para ${subject} en este momento.`,
        MODERATION_BLOCKED: 'Tu mensaje no pasa las políticas de uso. Probá reformularlo.',
        RATE_LIMIT_EXCEEDED: 'Demasiadas consultas seguidas. Esperá un momento e intentá de nuevo.',
        ENGINE_EXHAUSTED:
            'Los proveedores de IA no están disponibles temporalmente. Intentá más tarde.',
        FEATURE_DISABLED: 'El chat de IA está deshabilitado temporalmente.',
        CEILING_HIT: 'Se alcanzó el límite de costo de IA. Intentá más tarde.',
        SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible. Intentá más tarde.',
        NETWORK_INTERRUPTED: 'Se cortó la conexión. Reintentá.',
        INTERNAL_ERROR: 'Ocurrió un error inesperado. Intentá de nuevo.'
    };
    return fallbacks[code];
}

/**
 * Turns an API failure into copy a person can read.
 *
 * Precedence: the API `message` when it is a resolvable key (it distinguishes
 * consumer-side from owner-side quota, which share `LIMIT_REACHED`), then the
 * code, then generic copy. `ENTITLEMENT_REQUIRED` resolves to the vertical's own
 * `unavailable` string. The raw message is never rendered.
 *
 * @param input.t - Translation function.
 * @param input.entityType - The listing's vertical.
 * @param input.code - API error code, if any.
 * @param input.message - API error message, if any.
 * @returns Readable copy.
 */
export function resolveChatError({
    t,
    entityType,
    code,
    message
}: {
    readonly t: AiChatTranslate;
    readonly entityType: AiChatEntityType;
    readonly code: string | null;
    readonly message: string | null;
}): string {
    if (message && I18N_KEY_PATTERN.test(message)) {
        const translated = t(message, UNRESOLVED);
        if (translated !== UNRESOLVED) return translated;
    }

    if (code === 'ENTITLEMENT_REQUIRED') {
        return resolveAiChatCopy({ t, entityType, suffix: 'unavailable' });
    }

    if (code) {
        const translated = t(`accommodations.aiChat.error.${code}`, UNRESOLVED);
        if (translated !== UNRESOLVED) return translated;
        const fallback = errorFallback(entityType, code);
        if (fallback) return fallback;
    }

    return resolveAiChatCopy({ t, entityType, suffix: 'errorDefault' });
}

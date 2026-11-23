/**
 * Catalog entries of the conversation emails, sent from `apps/api` by the
 * conversation mailer and the two conversation crons.
 *
 * @module catalog/entries/conversation
 */

import {
    buildConversationNewMessageSubject,
    buildConversationTokenDay15Subject,
    buildConversationTokenDay25Subject,
    CONVERSATION_ACCESS_LINK_SUBJECT,
    CONVERSATION_VERIFY_SUBJECT
} from '../../templates/conversation/subjects.js';
import {
    ConversationNewMessage,
    ConversationNewMessageAnon,
    ConversationTokenExpiringDay15,
    ConversationTokenExpiringDay25,
    ConversationVerify
} from '../../templates/index.js';
import { defineEmailCatalogEntry } from '../define-entry.js';
import { SAMPLE_ACCOMMODATION_NAME, SAMPLE_SITE_URL } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

type ConversationLocale = 'es' | 'en' | 'pt';

/** Sample of the guest verification and access-link emails. */
interface ConversationVerifySample {
    readonly accommodationName: string;
    readonly url: string;
    readonly guestName: string;
    readonly locale: ConversationLocale;
}

/** Sample of the new-message emails. */
interface ConversationNewMessageSample {
    readonly accommodationName: string;
    readonly guestIdentity: string;
    readonly messages: { excerpt: string; timestamp: string }[];
    readonly ctaUrl: string;
    readonly locale: ConversationLocale;
}

/** Sample of the access-link expiry reminders. */
interface ConversationTokenSample {
    readonly accommodationName: string;
    readonly renewUrl: string;
    readonly expiryDate: string;
    readonly locale: ConversationLocale;
}

const VERIFY_SAMPLE: ConversationVerifySample = {
    accommodationName: SAMPLE_ACCOMMODATION_NAME,
    url: `${SAMPLE_SITE_URL}/es/mensajes/verificar?token=token-de-ejemplo-123`,
    guestName: 'Huésped de Ejemplo',
    locale: 'es'
};

const SHORT_MESSAGES = [
    {
        excerpt: 'Hola, ¿tienen disponibilidad para el fin de semana largo?',
        timestamp: '15/01 10:30'
    }
];

const MANY_MESSAGES = [
    {
        excerpt: 'Hola, ¿tienen disponibilidad para el fin de semana largo?',
        timestamp: '15/01 10:30'
    },
    { excerpt: 'Somos dos adultos y un niño de 6 años.', timestamp: '15/01 10:32' },
    {
        excerpt:
            'También queríamos saber si aceptan mascotas pequeñas, si hay estacionamiento techado dentro del predio y si el desayuno está incluido en la tarifa o se cobra aparte por persona y por día de estadía.',
        timestamp: '15/01 10:35'
    },
    { excerpt: 'Este cuarto mensaje no se muestra en el email.', timestamp: '15/01 10:40' }
];

function newMessageScenarios(ctaUrl: string) {
    return [
        {
            id: 'one-message',
            label: 'Un mensaje',
            input: {
                accommodationName: SAMPLE_ACCOMMODATION_NAME,
                guestIdentity: 'Huésped de Ejemplo',
                messages: SHORT_MESSAGES,
                ctaUrl,
                locale: 'es'
            }
        },
        {
            id: 'several-messages',
            label: 'Varios mensajes (se muestran 3, uno recortado)',
            input: {
                accommodationName: SAMPLE_ACCOMMODATION_NAME,
                guestIdentity: 'Huésped de Ejemplo',
                messages: MANY_MESSAGES,
                ctaUrl,
                locale: 'es'
            }
        }
    ] as const satisfies readonly {
        id: string;
        label: string;
        input: ConversationNewMessageSample;
    }[];
}

const TOKEN_SAMPLE: ConversationTokenSample = {
    accommodationName: SAMPLE_ACCOMMODATION_NAME,
    renewUrl: `${SAMPLE_SITE_URL}/es/mensajes/renovar?token=token-de-ejemplo-123`,
    expiryDate: '30 de enero de 2026',
    locale: 'es'
};

/** The six conversation emails. */
export const CONVERSATION_ENTRIES: readonly EmailCatalogEntry[] = [
    defineEmailCatalogEntry<ConversationVerifySample>({
        sendPath: 'conversation',
        id: 'verify',
        name: 'Verificación de email del huésped',
        domain: 'conversation',
        audience: 'user',
        scenarios: [{ id: 'default', label: 'Huésped anónimo', input: VERIFY_SAMPLE }],
        render: ({ scenario }) => ({
            subject: CONVERSATION_VERIFY_SUBJECT,
            react: ConversationVerify({
                accommodationName: scenario.accommodationName,
                verificationUrl: scenario.url,
                guestName: scenario.guestName,
                locale: scenario.locale
            }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<ConversationVerifySample>({
        sendPath: 'conversation',
        id: 'access-link',
        name: 'Enlace de acceso a la conversación',
        domain: 'conversation',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Huésped anónimo',
                input: {
                    ...VERIFY_SAMPLE,
                    url: `${SAMPLE_SITE_URL}/es/mensajes/acceso?token=token-de-ejemplo-456`
                }
            }
        ],
        render: ({ scenario }) => ({
            subject: CONVERSATION_ACCESS_LINK_SUBJECT,
            react: ConversationVerify({
                accommodationName: scenario.accommodationName,
                verificationUrl: scenario.url,
                guestName: scenario.guestName,
                locale: scenario.locale
            }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<ConversationNewMessageSample>({
        sendPath: 'conversation',
        id: 'new-message',
        name: 'Nuevo mensaje (usuario registrado)',
        domain: 'conversation',
        audience: 'user',
        scenarios: newMessageScenarios(
            `${SAMPLE_SITE_URL}/es/mensajes/00000000-0000-4000-8000-0000000000c1`
        ),
        render: ({ scenario }) => ({
            subject: buildConversationNewMessageSubject({
                accommodationName: scenario.accommodationName
            }),
            react: ConversationNewMessage({ ...scenario, messages: [...scenario.messages] }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<ConversationNewMessageSample>({
        sendPath: 'conversation',
        id: 'new-message-anon',
        name: 'Nuevo mensaje (huésped anónimo)',
        domain: 'conversation',
        audience: 'user',
        scenarios: newMessageScenarios(`${SAMPLE_SITE_URL}/guest/messages/token-de-ejemplo-789`),
        render: ({ scenario }) => ({
            subject: buildConversationNewMessageSubject({
                accommodationName: scenario.accommodationName
            }),
            react: ConversationNewMessageAnon({ ...scenario, messages: [...scenario.messages] }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<ConversationTokenSample>({
        sendPath: 'conversation',
        id: 'token-expiring-day15',
        name: 'Enlace de acceso vence en 15 días',
        domain: 'conversation',
        audience: 'user',
        scenarios: [{ id: 'default', label: 'Huésped anónimo', input: TOKEN_SAMPLE }],
        render: ({ scenario }) => ({
            subject: buildConversationTokenDay15Subject({
                accommodationName: scenario.accommodationName
            }),
            react: ConversationTokenExpiringDay15(scenario),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<ConversationTokenSample>({
        sendPath: 'conversation',
        id: 'token-expiring-day25',
        name: 'Último aviso: enlace de acceso vence en 5 días',
        domain: 'conversation',
        audience: 'user',
        scenarios: [{ id: 'default', label: 'Huésped anónimo', input: TOKEN_SAMPLE }],
        render: ({ scenario }) => ({
            subject: buildConversationTokenDay25Subject({
                accommodationName: scenario.accommodationName
            }),
            react: ConversationTokenExpiringDay25(scenario),
            warnings: []
        })
    })
];

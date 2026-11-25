/**
 * Catalog entries of the alliance, host-trade, partner, listing and calendar
 * notifications (`services/notification-templates/community.ts`).
 *
 * @module catalog/entries/notification-community
 */

import {
    type AccommodationCalendarFeedBrokenPayload,
    type AllianceClaimInvitePayload,
    type AllianceLeadDecisionPayload,
    type HostTradeReplyModeratedPayload,
    type HostTradeReviewReceivedPayload,
    type HostTradeRevokedPayload,
    type HostTradeUsageConfirmationReminderPayload,
    type HostTradeUsageConfirmationRequestPayload,
    type HostTradeUsageConfirmedPayload,
    type HostTradeUsageRejectedPayload,
    type ListingLocationExceptionDecisionPayload,
    NotificationType,
    type PartnerMentionsLoggedPayload,
    type PartnerRevokedPayload,
    type VipPromotionsPausedPayload,
    type VipPromotionsWeeklyDigestPayload
} from '../../types/notification.types.js';
import { defineNotificationEntry } from '../define-entry.js';
import { SAMPLE_RECIPIENT, SAMPLE_SITE_URL } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

const SAMPLE_LEAD_ID = '00000000-0000-4000-8000-0000000000c1';
const SAMPLE_USAGE_URL = `${SAMPLE_SITE_URL}/es/mi-cuenta/beneficios/ejemplo`;

/** The alliance, host-trade, partner, listing and calendar notifications. */
export const NOTIFICATION_COMMUNITY_ENTRIES: readonly EmailCatalogEntry[] = [
    defineNotificationEntry<AllianceClaimInvitePayload>({
        type: NotificationType.ALLIANCE_CLAIM_INVITE,
        name: 'Invitación a confirmar postulación de aliado',
        domain: 'alliance',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Invitación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ALLIANCE_CLAIM_INVITE,
                    leadId: SAMPLE_LEAD_ID,
                    programLabel: 'Proveedor',
                    claimUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/aliados?lead=${SAMPLE_LEAD_ID}&claim=token-de-ejemplo-123`,
                    expiresAt: '2026-03-15T12:00:00.000Z'
                }
            }
        ]
    }),
    defineNotificationEntry<AllianceLeadDecisionPayload>({
        type: NotificationType.ALLIANCE_LEAD_DECISION,
        name: 'Decisión sobre postulación de aliado',
        domain: 'alliance',
        audience: 'user',
        scenarios: [
            {
                id: 'approved',
                label: 'Aprobada',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ALLIANCE_LEAD_DECISION,
                    leadId: SAMPLE_LEAD_ID,
                    programLabel: 'Proveedor',
                    outcome: 'approved'
                }
            },
            {
                id: 'rejected',
                label: 'Rechazada',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ALLIANCE_LEAD_DECISION,
                    leadId: SAMPLE_LEAD_ID,
                    programLabel: 'Proveedor',
                    outcome: 'rejected'
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeUsageConfirmationRequestPayload>({
        type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REQUEST,
        name: 'Pedido de confirmación de uso del beneficio',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Pedido de confirmación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REQUEST,
                    counterpartName: 'Plomería de Ejemplo',
                    servicedAt: '2026-02-10',
                    expiresAt: '2026-02-24T12:00:00.000Z',
                    actionUrl: SAMPLE_USAGE_URL
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeUsageConfirmationReminderPayload>({
        type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REMINDER,
        name: 'Recordatorio de confirmación de uso del beneficio',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Recordatorio',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REMINDER,
                    counterpartName: 'Plomería de Ejemplo',
                    expiresAt: '2026-02-24T12:00:00.000Z',
                    actionUrl: SAMPLE_USAGE_URL
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeUsageConfirmedPayload>({
        type: NotificationType.HOST_TRADE_USAGE_CONFIRMED,
        name: 'Uso del beneficio confirmado',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'can-review',
                label: 'Con invitación a valorar',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_CONFIRMED,
                    counterpartName: 'Plomería de Ejemplo',
                    canReview: true,
                    reviewUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/beneficios/ejemplo/valorar`
                }
            },
            {
                id: 'cannot-review',
                label: 'Sin invitación a valorar',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_CONFIRMED,
                    counterpartName: 'Ana Ejemplo',
                    canReview: false
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeUsageRejectedPayload>({
        type: NotificationType.HOST_TRADE_USAGE_REJECTED,
        name: 'Uso del beneficio rechazado',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'with-note',
                label: 'Con nota',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_REJECTED,
                    counterpartName: 'Plomería de Ejemplo',
                    note: 'No recuerdo haber recibido este servicio (ejemplo).'
                }
            },
            {
                id: 'without-note',
                label: 'Sin nota',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_USAGE_REJECTED,
                    counterpartName: 'Plomería de Ejemplo'
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeReviewReceivedPayload>({
        type: NotificationType.HOST_TRADE_REVIEW_RECEIVED,
        name: 'Valoración recibida',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'benefit-respected',
                label: 'Beneficio respetado',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_REVIEW_RECEIVED,
                    listingName: 'Plomería de Ejemplo',
                    overallRating: 5,
                    respectedBenefit: true,
                    actionUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/valoraciones/ejemplo`
                }
            },
            {
                id: 'benefit-not-respected',
                label: 'Beneficio no respetado',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_REVIEW_RECEIVED,
                    listingName: 'Plomería de Ejemplo',
                    overallRating: 2,
                    respectedBenefit: false,
                    actionUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/valoraciones/ejemplo`
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeReplyModeratedPayload>({
        type: NotificationType.HOST_TRADE_REPLY_MODERATED,
        name: 'Respuesta moderada',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'approved',
                label: 'Aprobada',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_REPLY_MODERATED,
                    outcome: 'approved',
                    actionUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/valoraciones/ejemplo`
                }
            },
            {
                id: 'rejected',
                label: 'Rechazada con motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_REPLY_MODERATED,
                    outcome: 'rejected',
                    reason: 'La respuesta incluye datos de contacto personales (ejemplo).',
                    actionUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/valoraciones/ejemplo`
                }
            }
        ]
    }),
    defineNotificationEntry<HostTradeRevokedPayload>({
        type: NotificationType.HOST_TRADE_REVOKED,
        name: 'Ficha del directorio dada de baja',
        domain: 'host-trade',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Baja con motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.HOST_TRADE_REVOKED,
                    listingName: 'Plomería de Ejemplo',
                    reason: 'Dejó de responder a los anfitriones (ejemplo).'
                }
            }
        ]
    }),
    defineNotificationEntry<PartnerRevokedPayload>({
        type: NotificationType.PARTNER_REVOKED,
        name: 'Aliado dado de baja',
        domain: 'partner',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Baja con motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PARTNER_REVOKED,
                    partnerName: 'Comercio de Ejemplo',
                    reason: 'Incumplimiento de las condiciones del programa (ejemplo).'
                }
            }
        ]
    }),
    defineNotificationEntry<PartnerMentionsLoggedPayload>({
        type: NotificationType.PARTNER_MENTIONS_LOGGED,
        name: 'Difusión del aliado registrada',
        domain: 'partner',
        audience: 'user',
        scenarios: [
            {
                id: 'with-links',
                label: 'Canales con enlace',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PARTNER_MENTIONS_LOGGED,
                    partnerName: 'Comercio de Ejemplo',
                    mentionedAtLabel: '15 de febrero de 2026',
                    mentions: [
                        {
                            channelLabel: 'Instagram',
                            url: 'https://hospeda.com.ar/publicaciones/ejemplo-1'
                        },
                        {
                            channelLabel: 'Newsletter',
                            url: 'https://hospeda.com.ar/publicaciones/ejemplo-2'
                        }
                    ]
                }
            },
            {
                id: 'without-links',
                label: 'Canal sin enlace',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PARTNER_MENTIONS_LOGGED,
                    partnerName: 'Comercio de Ejemplo',
                    mentionedAtLabel: '15 de febrero de 2026',
                    mentions: [{ channelLabel: 'WhatsApp', url: null }]
                }
            }
        ]
    }),
    defineNotificationEntry<ListingLocationExceptionDecisionPayload>({
        type: NotificationType.LISTING_LOCATION_EXCEPTION_APPROVED,
        name: 'Excepción de ubicación aprobada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'es',
                label: 'Español',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.LISTING_LOCATION_EXCEPTION_APPROVED,
                    locale: 'es',
                    decisionSubject: 'Aprobamos la excepción de ubicación de tu alojamiento',
                    listingName: 'Cabañas del Río (ejemplo)',
                    editorUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/propiedades/ejemplo/ubicacion`
                }
            },
            {
                id: 'en',
                locale: 'en',
                label: 'Inglés',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.LISTING_LOCATION_EXCEPTION_APPROVED,
                    locale: 'en',
                    decisionSubject: 'Your listing location exception was approved',
                    listingName: 'Cabañas del Río (ejemplo)',
                    editorUrl: `${SAMPLE_SITE_URL}/en/mi-cuenta/propiedades/ejemplo/ubicacion`
                }
            }
        ]
    }),
    defineNotificationEntry<ListingLocationExceptionDecisionPayload>({
        type: NotificationType.LISTING_LOCATION_EXCEPTION_REJECTED,
        name: 'Excepción de ubicación rechazada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'es-with-reason',
                label: 'Español, con motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.LISTING_LOCATION_EXCEPTION_REJECTED,
                    locale: 'es',
                    decisionSubject: 'No pudimos aprobar la excepción de ubicación',
                    listingName: 'Cabañas del Río (ejemplo)',
                    decisionReason:
                        'La dirección declarada está fuera de la zona de cobertura (ejemplo).',
                    editorUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/propiedades/ejemplo/ubicacion`
                }
            },
            {
                id: 'en-without-reason',
                locale: 'en',
                label: 'Inglés, sin motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.LISTING_LOCATION_EXCEPTION_REJECTED,
                    locale: 'en',
                    decisionSubject: 'We could not approve the location exception',
                    listingName: 'Cabañas del Río (ejemplo)',
                    editorUrl: `${SAMPLE_SITE_URL}/en/mi-cuenta/propiedades/ejemplo/ubicacion`
                }
            }
        ]
    }),
    defineNotificationEntry<AccommodationCalendarFeedBrokenPayload>({
        type: NotificationType.ACCOMMODATION_CALENDAR_FEED_BROKEN,
        name: 'Calendario externo desconectado',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Feed roto',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ACCOMMODATION_CALENDAR_FEED_BROKEN,
                    accommodationName: 'Cabañas del Río (ejemplo)',
                    providerLabel: 'Airbnb',
                    reconnectUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/propiedades/ejemplo/editar`
                }
            }
        ]
    }),
    defineNotificationEntry<VipPromotionsWeeklyDigestPayload>({
        type: NotificationType.VIP_PROMOTIONS_WEEKLY_DIGEST,
        name: 'Resumen semanal de promociones para VIP',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'es-three-promotions',
                label: 'Español, tres promociones (una Solo VIP)',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.VIP_PROMOTIONS_WEEKLY_DIGEST,
                    locale: 'es',
                    digestSubject: '3 promociones nuevas esta semana',
                    promotions: [
                        {
                            title: 'Fin de semana largo (ejemplo)',
                            benefit: '20% de descuento',
                            placeName: 'Cabañas del Río (ejemplo)',
                            placeUrl: `${SAMPLE_SITE_URL}/es/alojamientos/ejemplo/`,
                            vipOnly: false,
                            startsLabel: null
                        },
                        {
                            title: 'Cena para dos (ejemplo)',
                            benefit: '$ 5.000 de descuento',
                            placeName: 'Parrilla del Puerto (ejemplo)',
                            placeUrl: `${SAMPLE_SITE_URL}/es/comer-y-salir/ejemplo/`,
                            vipOnly: true,
                            startsLabel: 'Desde el 1 de diciembre'
                        },
                        {
                            title: 'Noche extra (ejemplo)',
                            benefit: 'Una noche gratis',
                            placeName: 'Posada Las Moras (ejemplo)',
                            placeUrl: `${SAMPLE_SITE_URL}/es/alojamientos/ejemplo-2/`,
                            vipOnly: false,
                            startsLabel: null
                        }
                    ],
                    moreCount: 0,
                    promotionsUrl: `${SAMPLE_SITE_URL}/es/promociones/`,
                    preferencesUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/preferencias/`
                }
            }
        ]
    }),
    defineNotificationEntry<VipPromotionsPausedPayload>({
        type: NotificationType.VIP_PROMOTIONS_PAUSED,
        name: 'Promociones Solo VIP pausadas',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'es-two-paused',
                label: 'Español, dos pausadas',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.VIP_PROMOTIONS_PAUSED,
                    locale: 'es',
                    pausedSubject: 'Pausamos 2 promociones «Solo VIP»',
                    promotionTitles: ['Fin de semana largo (ejemplo)', 'Cena para dos (ejemplo)'],
                    promotionsUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/promociones/`
                }
            }
        ]
    })
];

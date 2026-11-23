/**
 * Catalog entries of the admin, feedback, contact and AI notifications
 * (`services/notification-templates/admin.ts`).
 *
 * @module catalog/entries/notification-admin
 */

import {
    type AdminLeadReceivedPayload,
    type AdminNotificationPayload,
    type AiCostThresholdAlertPayload,
    type AiQuestionsWeeklyDigestPayload,
    type ContactSubmissionPayload,
    type FeedbackReportPayload,
    NotificationType
} from '../../types/notification.types.js';
import { defineNotificationEntry } from '../define-entry.js';
import { SAMPLE_ADMIN_URL, SAMPLE_RECIPIENT, SAMPLE_SITE_URL } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

const SAMPLE_ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';

/** The admin, feedback, contact and AI notifications. */
export const NOTIFICATION_ADMIN_ENTRIES: readonly EmailCatalogEntry[] = [
    defineNotificationEntry<AdminNotificationPayload>({
        type: NotificationType.ADMIN_PAYMENT_FAILURE,
        name: 'Pago fallido (admin)',
        domain: 'admin',
        audience: 'staff',
        scenarios: [
            {
                id: 'critical',
                label: 'Severidad crítica',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_PAYMENT_FAILURE,
                    affectedUserEmail: 'cliente.ejemplo@example.com',
                    affectedUserId: '00000000-0000-4000-8000-000000000002',
                    severity: 'critical',
                    eventDetails: {
                        amount: 15000,
                        currency: 'ARS',
                        failureReason: 'Fondos insuficientes (ejemplo)'
                    }
                }
            },
            {
                id: 'warning',
                label: 'Severidad advertencia',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_PAYMENT_FAILURE,
                    affectedUserEmail: 'cliente.ejemplo@example.com',
                    severity: 'warning',
                    eventDetails: {}
                }
            }
        ]
    }),
    defineNotificationEntry<AdminNotificationPayload>({
        type: NotificationType.ADMIN_SYSTEM_EVENT,
        name: 'Evento del sistema (admin)',
        domain: 'admin',
        audience: 'staff',
        scenarios: [
            {
                id: 'info',
                label: 'Informativo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_SYSTEM_EVENT,
                    severity: 'info',
                    eventDetails: {
                        eventType: 'cron.completed',
                        timestamp: '2026-02-15T10:00:00.000Z',
                        message: 'Tarea programada ejecutada correctamente (ejemplo)'
                    }
                }
            },
            {
                id: 'critical',
                label: 'Crítico',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_SYSTEM_EVENT,
                    severity: 'critical',
                    eventDetails: {
                        eventType: 'database.connection_lost',
                        timestamp: '2026-02-15T10:00:00.000Z',
                        message: 'Se perdió la conexión con la base de datos (ejemplo)'
                    }
                }
            }
        ]
    }),
    defineNotificationEntry<AdminLeadReceivedPayload>({
        type: NotificationType.ADMIN_LEAD_RECEIVED,
        name: 'Nuevo lead recibido (admin)',
        domain: 'admin',
        audience: 'staff',
        scenarios: [
            {
                id: 'complete',
                label: 'Con todos los datos',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_LEAD_RECEIVED,
                    leadId: '00000000-0000-4000-8000-0000000000c1',
                    funnelLabel: 'Aliados',
                    programLabel: 'Proveedor',
                    contactName: 'Ana Ejemplo',
                    contactEmail: 'ana.ejemplo@example.com',
                    contactPhone: '+54 9 3442 000000',
                    businessName: 'Comercio de Ejemplo',
                    message: 'Hola, quiero sumar mi negocio a Hospeda (ejemplo).',
                    adminUrl: `${SAMPLE_ADMIN_URL}/alliance/leads`,
                    submittedAtLabel: '15 de febrero de 2026, 10:00'
                }
            },
            {
                id: 'minimal',
                label: 'Solo datos obligatorios',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.ADMIN_LEAD_RECEIVED,
                    leadId: '00000000-0000-4000-8000-0000000000c2',
                    funnelLabel: 'Comercios',
                    programLabel: 'Comer y salir',
                    contactName: 'Ana Ejemplo',
                    contactEmail: 'ana.ejemplo@example.com',
                    adminUrl: `${SAMPLE_ADMIN_URL}/alliance/leads`,
                    submittedAtLabel: '15 de febrero de 2026, 10:00'
                }
            }
        ]
    }),
    defineNotificationEntry<FeedbackReportPayload>({
        type: NotificationType.FEEDBACK_REPORT,
        name: 'Reporte de feedback',
        domain: 'contact-feedback',
        audience: 'staff',
        scenarios: [
            {
                id: 'bug-complete',
                label: 'Error con detalle completo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.FEEDBACK_REPORT,
                    reportType: 'Error de JavaScript',
                    reportTitle: 'El botón de reservar no responde (ejemplo)',
                    reportDescription: 'Al hacer clic en reservar no pasa nada.',
                    severity: 'Alta',
                    stepsToReproduce: '1. Abrir un alojamiento\n2. Hacer clic en reservar',
                    expectedResult: 'Se abre el formulario de consulta',
                    actualResult: 'No ocurre nada',
                    attachmentUrls: ['https://hospeda.com.ar/archivos/captura-ejemplo.png'],
                    feedbackEnvironment: {
                        currentUrl: `${SAMPLE_SITE_URL}/es/alojamientos/ejemplo/`,
                        browser: 'Firefox 130',
                        os: 'Linux',
                        viewport: '1920x1080',
                        timestamp: '2026-02-15T10:00:00.000Z',
                        appSource: 'web',
                        deployVersion: '0.0.0-ejemplo',
                        userId: '00000000-0000-4000-8000-000000000001',
                        consoleErrors: ['TypeError: x is undefined (ejemplo)'],
                        errorInfo: {
                            message: 'TypeError: x is undefined (ejemplo)',
                            stack: 'at handler (app.js:1:1)'
                        }
                    }
                }
            },
            {
                id: 'suggestion-minimal',
                label: 'Sugerencia mínima',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.FEEDBACK_REPORT,
                    reportType: 'Sugerencia',
                    reportTitle: 'Agregar filtro por mascotas (ejemplo)',
                    reportDescription: 'Sería útil poder filtrar alojamientos pet friendly.',
                    feedbackEnvironment: {
                        timestamp: '2026-02-15T10:00:00.000Z',
                        appSource: 'web'
                    }
                }
            }
        ]
    }),
    defineNotificationEntry<ContactSubmissionPayload>({
        type: NotificationType.CONTACT_SUBMISSION,
        name: 'Consulta del formulario de contacto',
        domain: 'contact-feedback',
        audience: 'staff',
        scenarios: [
            {
                id: 'general',
                label: 'Consulta general',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.CONTACT_SUBMISSION,
                    contactType: 'general',
                    senderFirstName: 'Ana',
                    senderLastName: 'Ejemplo',
                    senderEmail: 'ana.ejemplo@example.com',
                    message: 'Hola, quería consultar por una cosa (ejemplo).',
                    submittedAt: '2026-02-15T10:00:00.000Z'
                }
            },
            {
                id: 'accommodation',
                label: 'Consulta por un alojamiento',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.CONTACT_SUBMISSION,
                    contactType: 'accommodation',
                    senderFirstName: 'Ana',
                    senderLastName: 'Ejemplo',
                    senderEmail: 'ana.ejemplo@example.com',
                    message: 'Quiero publicar mi alojamiento (ejemplo).',
                    accommodationId: SAMPLE_ACCOMMODATION_ID,
                    submittedAt: '2026-02-15T10:00:00.000Z'
                }
            }
        ]
    }),
    defineNotificationEntry<AiCostThresholdAlertPayload>({
        type: NotificationType.AI_COST_THRESHOLD_ALERT,
        name: 'Alerta de costo de IA',
        domain: 'ai',
        audience: 'staff',
        scenarios: [
            {
                id: 'global-80',
                label: 'Presupuesto global al 80%',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.AI_COST_THRESHOLD_ALERT,
                    scope: 'global',
                    thresholdPct: 80,
                    spentMicroUsd: 160_000_000,
                    ceilingMicroUsd: 200_000_000,
                    period: '2026-02'
                }
            },
            {
                id: 'feature-100',
                label: 'Funcionalidad al 100%',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.AI_COST_THRESHOLD_ALERT,
                    scope: 'feature',
                    feature: 'listing-questions',
                    thresholdPct: 100,
                    spentMicroUsd: 50_000_000,
                    ceilingMicroUsd: 50_000_000,
                    period: '2026-02'
                }
            }
        ]
    }),
    defineNotificationEntry<AiQuestionsWeeklyDigestPayload>({
        type: NotificationType.AI_QUESTIONS_WEEKLY_DIGEST,
        name: 'Resumen semanal de preguntas a la IA',
        domain: 'ai',
        audience: 'user',
        scenarios: [
            {
                id: 'es-two-listings',
                label: 'Español, dos alojamientos',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.AI_QUESTIONS_WEEKLY_DIGEST,
                    locale: 'es',
                    digestSubject: 'Tenés 3 preguntas sin responder en tus alojamientos',
                    listings: [
                        {
                            listingName: 'Cabañas del Río (ejemplo)',
                            unansweredCount: 2,
                            questions: ['¿Aceptan mascotas?', '¿Hay estacionamiento?'],
                            panelUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/propiedades/ejemplo-1/preguntas`
                        },
                        {
                            listingName: 'Casa de Campo (ejemplo)',
                            unansweredCount: 1,
                            questions: ['¿Tiene pileta?'],
                            panelUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/propiedades/ejemplo-2/preguntas`
                        }
                    ],
                    preferencesUrl: `${SAMPLE_SITE_URL}/es/mi-cuenta/preferencias`
                }
            },
            {
                id: 'en-one-listing',
                label: 'Inglés, un alojamiento',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.AI_QUESTIONS_WEEKLY_DIGEST,
                    locale: 'en',
                    digestSubject: 'You have 1 unanswered question on your listing',
                    listings: [
                        {
                            listingName: 'Cabañas del Río (ejemplo)',
                            unansweredCount: 1,
                            questions: ['Do you accept pets?'],
                            panelUrl: `${SAMPLE_SITE_URL}/en/mi-cuenta/propiedades/ejemplo-1/preguntas`
                        }
                    ],
                    preferencesUrl: `${SAMPLE_SITE_URL}/en/mi-cuenta/preferencias`
                }
            }
        ]
    })
];

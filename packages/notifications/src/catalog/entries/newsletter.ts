/**
 * Catalog entries of the newsletter emails.
 *
 * The campaign is sent by the newsletter delivery service with the campaign's
 * own subject. The double opt-in verify and welcome emails have templates and
 * subjects but no production sender yet (HOS-2535), so they are `wired: false`.
 *
 * @module catalog/entries/newsletter
 */

import {
    NewsletterCampaign,
    NewsletterVerifyEmail,
    NewsletterWelcomeEmail
} from '../../templates/newsletter/index.js';
import { NotificationType } from '../../types/notification.types.js';
import { getSubject } from '../../utils/subject-builder.js';
import { defineEmailCatalogEntry } from '../define-entry.js';
import { SAMPLE_SITE_URL } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

/** Sample of a newsletter campaign. */
interface NewsletterCampaignSample {
    readonly subject: string;
    readonly bodyHtml: string;
    readonly isTest: boolean;
}

/** Sample of the double opt-in emails. */
interface NewsletterOptInSample {
    readonly firstName?: string;
}

const CAMPAIGN_BODY_HTML =
    '<h2>Novedades del Litoral</h2><p>Este es un boletín de ejemplo con <strong>contenido ficticio</strong> para la vista previa.</p><ul><li>Fiesta de ejemplo en Concepción del Uruguay</li><li>Nuevos alojamientos de ejemplo</li></ul><p><a href="https://hospeda.com.ar/es/">Ver más en Hospeda</a></p>';

const UNSUBSCRIBE_URL = `${SAMPLE_SITE_URL}/es/newsletter/baja?token=token-de-ejemplo-123`;

/** The three newsletter emails. */
export const NEWSLETTER_ENTRIES: readonly EmailCatalogEntry[] = [
    defineEmailCatalogEntry<NewsletterCampaignSample>({
        sendPath: 'newsletter',
        id: 'campaign',
        name: 'Campaña de newsletter',
        domain: 'newsletter',
        scenarios: [
            {
                id: 'default',
                label: 'Envío real',
                input: {
                    subject: 'Novedades de Hospeda (ejemplo)',
                    bodyHtml: CAMPAIGN_BODY_HTML,
                    isTest: false
                }
            },
            {
                id: 'test-send',
                label: 'Envío de prueba',
                input: {
                    subject: 'Novedades de Hospeda (ejemplo)',
                    bodyHtml: CAMPAIGN_BODY_HTML,
                    isTest: true
                }
            }
        ],
        render: ({ scenario }) => ({
            subject: scenario.isTest ? `[PRUEBA] ${scenario.subject}` : scenario.subject,
            react: NewsletterCampaign({
                subject: scenario.subject,
                bodyHtml: scenario.bodyHtml,
                unsubscribeUrl: UNSUBSCRIBE_URL,
                isTest: scenario.isTest
            }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<NewsletterOptInSample>({
        sendPath: 'newsletter',
        id: 'verify',
        name: 'Confirmación de suscripción al newsletter',
        domain: 'newsletter',
        wired: false,
        scenarios: [
            { id: 'with-name', label: 'Con nombre', input: { firstName: 'Ana' } },
            { id: 'without-name', label: 'Sin nombre', input: {} }
        ],
        render: ({ scenario, deps }) => ({
            subject: getSubject(NotificationType.NEWSLETTER_VERIFICATION, {}),
            react: NewsletterVerifyEmail({
                ...scenario,
                verifyUrl: `${deps.siteUrl.replace(/\/$/, '')}/es/newsletter/confirmar?token=token-de-ejemplo-123`
            }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<NewsletterOptInSample>({
        sendPath: 'newsletter',
        id: 'welcome',
        name: 'Bienvenida al newsletter',
        domain: 'newsletter',
        wired: false,
        scenarios: [
            { id: 'with-name', label: 'Con nombre', input: { firstName: 'Ana' } },
            { id: 'without-name', label: 'Sin nombre', input: {} }
        ],
        render: ({ scenario, deps }) => ({
            subject: getSubject(NotificationType.NEWSLETTER_WELCOME, {}),
            react: NewsletterWelcomeEmail({ ...scenario, baseUrl: deps.siteUrl }),
            warnings: []
        })
    })
];

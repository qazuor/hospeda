/**
 * Catalog entry of the admin direct email (HOS-2685).
 *
 * Sent one message per recipient by the API's direct email service. It shares the
 * `newsletter` send path (the catalog key is `<sendPath>.<id>`, so its Brevo tag is
 * `template:newsletter.direct-email`) and the newsletter domain: the layout is the
 * same and it is composed in the same admin area.
 *
 * @module catalog/entries/direct-email
 */

import { DirectEmail } from '../../templates/direct-email/index.js';
import { defineEmailCatalogEntry } from '../define-entry.js';
import { SAMPLE_SITE_URL } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

/** Sample of a direct email. */
interface DirectEmailSample {
    readonly subject: string;
    readonly bodyHtml: string;
    readonly isTest: boolean;
}

const BODY_HTML =
    '<p>Hola, te escribo desde Hospeda para proponerte un acuerdo comercial (texto de ejemplo).</p><p>Podés ver cómo trabajamos en <a href="https://hospeda.com.ar/es/">Hospeda</a>. Si te interesa, respondé a este correo.</p>';

const OPT_OUT_URL = `${SAMPLE_SITE_URL}/es/correos/baja/?token=token-de-ejemplo-123`;

/** The direct email. */
export const DIRECT_EMAIL_ENTRIES: readonly EmailCatalogEntry[] = [
    defineEmailCatalogEntry<DirectEmailSample>({
        sendPath: 'newsletter',
        id: 'direct-email',
        name: 'Correo directo del admin',
        domain: 'newsletter',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Envío real',
                input: {
                    subject: 'Propuesta comercial (ejemplo)',
                    bodyHtml: BODY_HTML,
                    isTest: false
                }
            },
            {
                id: 'test-send',
                label: 'Envío de prueba',
                input: {
                    subject: 'Propuesta comercial (ejemplo)',
                    bodyHtml: BODY_HTML,
                    isTest: true
                }
            }
        ],
        render: ({ scenario }) => ({
            subject: scenario.isTest ? `[PRUEBA] ${scenario.subject}` : scenario.subject,
            react: DirectEmail({
                subject: scenario.isTest ? `[PRUEBA] ${scenario.subject}` : scenario.subject,
                bodyHtml: scenario.bodyHtml,
                optOutUrl: OPT_OUT_URL,
                isTest: scenario.isTest
            }),
            warnings: []
        })
    })
];

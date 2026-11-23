/**
 * Catalog entries of the partner application outbox mails
 * (`createPartnerApplicationRenderers`).
 *
 * The claim notice's renderer issues a claim secret; the host app injects a
 * non-writing fake for the preview (HOS-2519 D7, AC-4.6).
 *
 * @module catalog/entries/outbox-partner
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const PARTNER_ID = '00000000-0000-4000-8000-0000000000e1';
const PARTNER_NAME = 'Comercio de Ejemplo';

/** The two partner application mails. */
export const OUTBOX_PARTNER_ENTRIES: readonly EmailCatalogEntry[] = [
    defineOutboxEntry({
        template: 'verticals.partner-claim-notice',
        name: 'Aviso para reclamar la ficha de aliado',
        domain: 'partner',
        audience: 'user',
        scenarios: [
            {
                id: 'application-es',
                label: 'Postulación aprobada (español)',
                input: {
                    payload: {
                        partnerId: PARTNER_ID,
                        partnerName: PARTNER_NAME,
                        locale: 'es',
                        origin: 'application'
                    }
                }
            },
            {
                id: 'direct-es',
                label: 'Alta directa por el equipo (español)',
                input: {
                    payload: {
                        partnerId: PARTNER_ID,
                        partnerName: PARTNER_NAME,
                        locale: 'es',
                        origin: 'direct'
                    }
                }
            },
            {
                id: 'application-en',
                label: 'Postulación aprobada (inglés)',
                input: {
                    payload: {
                        partnerId: PARTNER_ID,
                        partnerName: PARTNER_NAME,
                        locale: 'en',
                        origin: 'application'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.partner-application-rejected',
        name: 'Postulación de aliado rechazada',
        domain: 'partner',
        audience: 'user',
        scenarios: [
            {
                id: 'es',
                label: 'Español',
                input: {
                    payload: {
                        applicationId: '00000000-0000-4000-8000-0000000000e2',
                        reapplyAfter: '2026-04-15T03:00:00.000Z',
                        locale: 'es'
                    }
                }
            },
            {
                id: 'pt',
                label: 'Portugués',
                input: {
                    payload: {
                        applicationId: '00000000-0000-4000-8000-0000000000e2',
                        reapplyAfter: '2026-04-15T03:00:00.000Z',
                        locale: 'pt'
                    }
                }
            }
        ]
    })
];

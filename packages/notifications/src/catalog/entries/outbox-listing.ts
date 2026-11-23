/**
 * Catalog entries of the listing outbox mails: the publication-machine
 * notices (`createVerticalListingRenderers`), the on-archive notice
 * (`createListingArchivedRenderers`) and the two pre-retention notices
 * (`createListingRetentionRenderers`).
 *
 * Listing ids are fake UUIDs; the preview's names reader answers a sample name
 * for any id (HOS-2519).
 *
 * @module catalog/entries/outbox-listing
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const L1 = '00000000-0000-4000-8000-000000000401';
const L2 = '00000000-0000-4000-8000-000000000402';
const L3 = '00000000-0000-4000-8000-000000000403';
const OWNER = '00000000-0000-4000-8000-000000000411';
const FIX_REQUEST = '00000000-0000-4000-8000-000000000412';
const ALERT = '00000000-0000-4000-8000-000000000413';
const REASON = 'La descripción incluye datos de contacto de ejemplo no permitidos.';
const ADDONS = [{ name: 'Destaque semanal (ejemplo)' }];

/** The listing notice mails. */
export const OUTBOX_LISTING_ENTRIES: readonly EmailCatalogEntry[] = [
    defineOutboxEntry({
        template: 'verticals.listing-business-lines-changed',
        name: 'Cambio de rubros de una ficha',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'added-and-removed',
                label: 'Rubros agregados y quitados',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L1,
                        listingName: 'Parador de Ejemplo',
                        changedAt: '2026-05-10T15:00:00.000Z',
                        addedLines: ['Cafetería'],
                        removedLines: ['Heladería'],
                        shownSections: ['Menú'],
                        hiddenSections: ['Promociones']
                    }
                }
            },
            {
                id: 'added-only',
                label: 'Solo rubros agregados',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L1,
                        listingName: 'Parador de Ejemplo',
                        changedAt: '2026-05-10T15:00:00.000Z',
                        addedLines: ['Cafetería', 'Panadería']
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-content-edited-by-support',
        name: 'Contenido editado por soporte',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'several-parts',
                label: 'Varias partes editadas',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        editedAt: '2026-05-12T14:30:00.000Z',
                        parts: ['texts', 'photos', 'hours']
                    }
                }
            },
            {
                id: 'single-part',
                label: 'Una sola parte editada',
                input: {
                    payload: {
                        vertical: 'experience',
                        listingId: L2,
                        editedAt: '2026-05-12T14:30:00.000Z',
                        parts: ['faq']
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.price-alert-closed',
        name: 'Alerta de precio cerrada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Alerta cerrada',
                input: { payload: { vertical: 'accommodation', listingId: L1, alertId: ALERT } }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-purged',
        name: 'Ficha borrada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'by-owner',
                label: 'Borrada por el titular',
                input: {
                    payload: { vertical: 'accommodation', listingId: L1, bySupport: false }
                }
            },
            {
                id: 'by-support',
                label: 'Borrada por soporte a pedido',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L2,
                        bySupport: true,
                        listingName: 'Parador de Ejemplo'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-moderated',
        name: 'Ficha moderada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Sin destaques recurrentes',
                input: {
                    payload: { vertical: 'accommodation', listingId: L1, reason: REASON }
                }
            },
            {
                id: 'with-recurring-addons',
                label: 'Con destaques recurrentes',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        reason: REASON,
                        recurringListingAddons: ADDONS
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-fix-requested',
        name: 'Pedido de arreglo en una ficha',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'with-date',
                label: 'Con fecha sugerida',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        reason: REASON,
                        suggestedDate: '2026-06-15'
                    }
                }
            },
            {
                id: 'without-date',
                label: 'Sin fecha sugerida',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L2,
                        reason: REASON,
                        suggestedDate: null
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-fix-reported',
        name: 'Arreglo informado por el titular (aviso al equipo)',
        domain: 'listing',
        audience: 'staff',
        scenarios: [
            {
                id: 'with-date',
                label: 'Con fecha sugerida',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        ownerId: OWNER,
                        fixRequestId: FIX_REQUEST,
                        reason: REASON,
                        suggestedDate: '2026-06-15',
                        requestedAt: '2026-05-10T15:00:00.000Z',
                        reportedAt: '2026-05-14T18:20:00.000Z'
                    }
                }
            },
            {
                id: 'without-date',
                label: 'Sin fecha sugerida',
                input: {
                    payload: {
                        vertical: 'experience',
                        listingId: L2,
                        ownerId: OWNER,
                        fixRequestId: FIX_REQUEST,
                        reason: REASON,
                        suggestedDate: null,
                        requestedAt: '2026-05-10T15:00:00.000Z',
                        reportedAt: '2026-05-14T18:20:00.000Z'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-moderation-level-changed',
        name: 'Cambio de nivel de moderación',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'still-moderated',
                label: 'Sigue moderada, sin arreglo abierto',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        reason: REASON,
                        fixRequestOpen: false
                    }
                }
            },
            {
                id: 'returned-with-fix-open',
                label: 'Vuelve a borrador con arreglo abierto',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        reason: REASON,
                        returnedTo: 'DRAFT',
                        fixRequestOpen: true,
                        recurringListingAddons: ADDONS
                    }
                }
            },
            {
                id: 'quota-full',
                label: 'Sin lugar en la suscripción',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L2,
                        reason: REASON,
                        returnedTo: 'UNPUBLISHED_BY_BILLING',
                        quotaFull: true,
                        fixRequestOpen: false
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-moderation-lifted',
        name: 'Moderación levantada',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'published',
                label: 'Vuelve publicada',
                input: {
                    payload: { vertical: 'accommodation', listingId: L1, returnedTo: 'PUBLISHED' }
                }
            },
            {
                id: 'draft',
                label: 'Vuelve a borrador',
                input: {
                    payload: { vertical: 'venue', listingId: L2, returnedTo: 'DRAFT' }
                }
            },
            {
                id: 'quota-full',
                label: 'Aprobada pero sin cupo',
                input: {
                    payload: {
                        vertical: 'experience',
                        listingId: L3,
                        returnedTo: 'UNPUBLISHED_BY_BILLING',
                        quotaFull: true
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-restitution',
        name: 'Fichas restituidas',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'all-restored',
                label: 'Todas las fichas restituidas',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        restoredListingIds: [L1, L2],
                        notRestoredListingIds: [],
                        criterion: 'LAST_FELL_FIRST_BACK'
                    }
                }
            },
            {
                id: 'partially-restored',
                label: 'Algunas restituidas y otras no',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        restoredListingIds: [L1],
                        notRestoredListingIds: [L2, L3],
                        criterion: 'LAST_FELL_FIRST_BACK'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-archived',
        name: 'Ficha archivada por inactividad',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'published-pb4',
                label: 'Ficha publicada (se restituye sola)',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        transition: 'PB4',
                        deletionAnnouncedAt: '2026-08-10T03:00:00.000Z',
                        listingAddonCount: 0
                    }
                }
            },
            {
                id: 'draft-pb5-with-addons',
                label: 'Borrador con destaques',
                input: {
                    payload: {
                        vertical: 'venue',
                        listingId: L2,
                        transition: 'PB5',
                        deletionAnnouncedAt: '2026-08-10T03:00:00.000Z',
                        listingAddonCount: 2
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-retention-before-archive',
        name: 'Aviso previo al archivado',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'published-pb4',
                label: 'Ficha publicada sin cobertura',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        transition: 'PB4',
                        archiveAt: '2026-07-01T03:00:00.000Z'
                    }
                }
            },
            {
                id: 'draft-pb5',
                label: 'Borrador sin publicar',
                input: {
                    payload: {
                        vertical: 'experience',
                        listingId: L2,
                        transition: 'PB5',
                        archiveAt: '2026-07-01T03:00:00.000Z'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'verticals.listing-retention-before-deletion',
        name: 'Aviso previo al borrado del contenido',
        domain: 'listing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Ficha archivada',
                input: {
                    payload: {
                        vertical: 'accommodation',
                        listingId: L1,
                        deletionAt: '2026-09-01T03:00:00.000Z'
                    }
                }
            }
        ]
    })
];

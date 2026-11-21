/**
 * @file portal-destination.ts
 * @description Facts about a {@link PortalDestination} that are not its URL
 * (HOS-2326, spec HOS-2335 §5.1): the Spanish label a link is shown with, and
 * whether the link carries an identifier.
 */

import {
    PORTAL_PAGE_LABELS,
    PORTAL_ROUTE_TEMPLATES,
    type PortalDestination,
    type PortalDestinationKind
} from './portal-routes';

/** Spanish label of the link to each kind of destination. */
export const PORTAL_DESTINATION_LABELS: Readonly<Record<PortalDestinationKind, string>> = {
    listingEditor: 'Abrir el editor de la publicación',
    ownerListings: 'Ver mis publicaciones',
    createListing: 'Publicar en Hospeda',
    plans: 'Ver los planes',
    subscription: 'Ver mi suscripción',
    addons: 'Ver mis complementos',
    inquiry: 'Ver mis consultas',
    providerDirectory: 'Ver el directorio de proveedores',
    declareBenefitUsage: 'Registrar un uso del beneficio',
    benefitUsages: 'Ver mis usos de beneficio',
    providerPanel: 'Abrir mi panel de proveedor',
    aiAssistants: 'Administrar mis asistentes de IA',
    aiAssistantsHistory: 'Ver lo que hicieron mis asistentes de IA',
    faq: 'Ver las preguntas frecuentes',
    contact: 'Contactar a Hospeda',
    partnerPanel: 'Abrir mi panel de partner',
    helpLanding: 'Abrir el centro de ayuda',
    helpArticle: 'Leer la guía en el centro de ayuda',
    page: 'Abrir la página'
};

/**
 * The Spanish label a link to a destination is shown with.
 *
 * @param args - The destination
 * @returns The label
 */
export function describePortalDestination({
    destination
}: {
    readonly destination: PortalDestination;
}): string {
    if (destination.kind === 'page') {
        return PORTAL_PAGE_LABELS[destination.page];
    }
    return PORTAL_DESTINATION_LABELS[destination.kind];
}

/**
 * Whether a destination names no particular record: no listing id, inquiry id
 * or provider slug. Only such a link may accompany a "not found" answer, because
 * a link built around an id would confirm that the id exists (error contract,
 * HOS-2335 AC-C4).
 *
 * @param args - The destination
 * @returns `true` when the link carries no identifier
 */
export function isNonIdentifyingDestination({
    destination
}: {
    readonly destination: PortalDestination;
}): boolean {
    switch (destination.kind) {
        case 'listingEditor':
            return false;
        case 'inquiry':
            return destination.conversationId === undefined;
        case 'providerDirectory':
            return destination.slug === undefined;
        case 'declareBenefitUsage':
            return false;
        case 'page':
            // A page names a record exactly when its template has a dynamic segment.
            return !PORTAL_ROUTE_TEMPLATES[destination.page].includes('[');
        default:
            return true;
    }
}

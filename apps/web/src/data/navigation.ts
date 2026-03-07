/**
 * @file navigation.ts
 * @description Static navigation data for the navbar and footer.
 * Defines the primary nav links (with anchors for homepage scrolling)
 * and footer link columns organized by section.
 */
import type { FooterLinks, NavLink } from './types';

/** Primary navigation links rendered in the top navbar */
export const NAV_LINKS: readonly NavLink[] = [
    {
        labelKey: 'nav.accommodations',
        label: 'Alojamientos',
        anchor: '#accommodations',
        path: 'alojamientos'
    },
    { labelKey: 'nav.destinations', label: 'Destinos', anchor: '#destinations', path: 'destinos' },
    { labelKey: 'nav.events', label: 'Eventos', anchor: '#events', path: 'eventos' },
    { labelKey: 'nav.blog', label: 'Notas', anchor: '#posts', path: 'publicaciones' }
] as const;

/** Footer link columns organized by section */
export const FOOTER_LINKS: FooterLinks = {
    Explore: [
        { labelKey: 'nav.accommodations', label: 'Alojamientos', path: 'alojamientos' },
        { labelKey: 'nav.destinations', label: 'Destinos', path: 'destinos' },
        { labelKey: 'nav.events', label: 'Eventos', path: 'eventos' },
        { labelKey: 'nav.blog', label: 'Notas', path: 'publicaciones' }
    ],
    Destinations: [
        { labelKey: 'footer.destinationColon', label: 'Colon', path: 'destinos/colon' },
        {
            labelKey: 'footer.destinationGualeguaychu',
            label: 'Gualeguaychu',
            path: 'destinos/gualeguaychu'
        },
        { labelKey: 'footer.destinationCdu', label: 'Concordia', path: 'destinos/concordia' },
        {
            labelKey: 'footer.destinationFederation',
            label: 'Federacion',
            path: 'destinos/federacion'
        },
        {
            labelKey: 'footer.destinationPaysandu',
            label: 'Villa Elisa',
            path: 'destinos/villa-elisa'
        }
    ],
    Owners: [
        { labelKey: 'footer.listProperty', label: 'Publica tu alojamiento', path: 'propietarios' },
        {
            labelKey: 'footer.ownerPlans',
            label: 'Planes para propietarios',
            path: 'precios/propietarios'
        },
        { labelKey: 'footer.touristPlans', label: 'Planes para turistas', path: 'precios/turistas' }
    ],
    Hospeda: [
        { labelKey: 'footer.aboutUs', label: 'Sobre nosotros', path: 'quienes-somos' },
        { labelKey: 'footer.benefits', label: 'Como funciona', path: 'beneficios' },
        { labelKey: 'footer.contact', label: 'Contacto', path: 'contacto' },
        { labelKey: 'footer.terms', label: 'Terminos de uso', path: 'terminos-condiciones' },
        { labelKey: 'footer.privacy', label: 'Politica de privacidad', path: 'privacidad' }
    ]
} as const;

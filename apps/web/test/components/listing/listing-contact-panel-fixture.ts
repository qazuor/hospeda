import type { ListingContactPanelProps } from '@/components/listing/contact/ListingContactPanel.client';

/** Public listing fixture for the contact sheet. */
export const props: ListingContactPanelProps = {
    panelId: 'inquiry-panel',
    accommodationName: 'Casa del Río',
    ownerName: 'Ana Torres',
    accommodation: {
        id: '04c13742-a25d-4c9d-8bf7-add1add1add1',
        deletedAt: null,
        type: 'HOUSE',
        destinationId: 'dest',
        destinationName: 'Colón',
        price: 155500,
        currency: 'ARS',
        ownerId: 'owner'
    },
    price: {
        amount: 155500,
        currency: 'ARS',
        unitLabelKey: 'accommodations.detail.listingContact.units.perNight',
        onRequest: false
    },
    hasWhatsapp: false,
    whatsappPlansHref: '/es/planes/turistas/precios/',
    locale: 'es',
    capacity: 4
};

import { PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the Contact section of event.
 *
 * The id stays `contact-media` on purpose even though the media fields are
 * gone (HOS-390): the section id is referenced by the form's section ordering
 * and by tests, and renaming it would be churn with no behavioural payoff.
 */
export const createContactMediaConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'contact-media',
    title: 'Contacto',
    description: 'Información de contacto del evento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'contact.email',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email de Contacto',
            description: 'Correo electrónico para consultas',
            placeholder: 'contacto@evento.com',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'email',
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
        },
        {
            id: 'contact.phone',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono de Contacto',
            description: 'Número de teléfono para consultas',
            placeholder: '+54 9 11 1234-5678',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'contact.website',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Sitio Web',
            description: 'URL del sitio web del evento',
            placeholder: 'https://www.evento.com',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url',
                pattern: '^https?:\\/\\/.*'
            }
        }
        // HOS-390: `media.featuredImage` (IMAGE) and `media.gallery` (GALLERY)
        // were REMOVED here. Event photos live in the relational `event_media`
        // table and are managed exclusively via the Gallery tab
        // (`/events/:id/gallery`, `ContentGalleryManager`), never through this
        // form. Leaving them would write a JSONB blob nothing reads any more —
        // the read switch composes `media` from the table.
    ]
});

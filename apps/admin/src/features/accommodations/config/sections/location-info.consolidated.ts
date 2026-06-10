import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Location section — aligned to the real backend shape
 * (`@repo/schemas#AccommodationLocationSchema`):
 *
 *   location: {
 *     coordinates?: { lat: string, long: string },
 *     street?: string (2-50),
 *     number?: string (1-10),
 *     floor?: string (1-10),
 *     apartment?: string (1-10)
 *   }
 *
 * The geographic context (city, state, country, postal code) lives on the
 * `destinationId` FK and is projected as `cityDestination` (SPEC-095) — those
 * fields are intentionally absent here.
 *
 * Earlier this config declared `address`, `city`, `state`, `country` and
 * `postalCode` flat TEXT fields plus flat `latitude` / `longitude` NUMBER
 * fields. None of those matched the backend shape, so the PATCH bodies were
 * silently stripped on save and the page never persisted changes. Replaced
 * during the view/edit redesign.
 */
export const createLocationInfoConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => ({
    id: 'location-info',
    title: 'Ubicación y contacto',
    description: 'Dónde está el alojamiento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
    },
    fields: [
        {
            id: 'location.street',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Calle',
            description: 'Nombre de la calle',
            placeholder: 'Av. Costanera',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                minLength: 2,
                maxLength: 50
            }
        },
        {
            id: 'location.number',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Número',
            description: 'Altura',
            placeholder: '1234',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                minLength: 1,
                maxLength: 10
            }
        },
        {
            id: 'location.floor',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Piso',
            description: 'Piso del edificio (opcional)',
            placeholder: '3',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                minLength: 1,
                maxLength: 10
            }
        },
        {
            id: 'location.apartment',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Departamento',
            description: 'Unidad / departamento (opcional)',
            placeholder: 'B',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                minLength: 1,
                maxLength: 10
            }
        },
        {
            id: 'location.coordinates',
            type: FieldTypeEnum.COORDINATES,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Coordenadas',
            description:
                'Punto en el mapa. Arrastrá el marcador o hacé click para ubicarlo. También podés ingresar latitud y longitud manualmente.',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                type: 'COORDINATES',
                addressFields: {
                    street: 'location.street',
                    number: 'location.number',
                    // SPEC-095 projection: city name lives at cityDestination.name.
                    cityContext: 'cityDestination.name'
                },
                geocodingCountryCodes: ['ar']
            }
        }
    ]
});

import { PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the Location section of point of interest.
 *
 * HOS-144 §6.3: `coordinates` is a synthetic form field (not a real key on
 * the `PointOfInterest` domain entity, which has plain top-level numeric
 * `lat`/`long` columns). `usePointOfInterestPage.ts` seeds this field from
 * `{ lat, long }` on read (stringified, matching `CoordinatesField`'s
 * `{ lat: string, long: string }` value shape) and splits it back into
 * numeric `lat`/`long` on submit. Likewise `keywords` is rendered as a
 * "one keyword per line" textarea (§6.5) and split/trimmed/filtered back
 * into `text[]` on submit — both transforms live in the page hook's submit
 * seam, not in this config.
 */
export const createLocationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'location',
    title: 'Ubicación',
    description: 'Dirección, coordenadas y palabras clave del punto de interés',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
        edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
    },
    fields: [
        {
            id: 'address',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Dirección',
            description: 'Dirección de calle tal como figura en el dataset de origen',
            placeholder: 'Av. Costanera 1234',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                minLength: 3,
                maxLength: 300
            }
        },
        {
            id: 'keywords',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Palabras Clave',
            description:
                'Una palabra clave por línea. Alimenta la futura lista de permitidos de búsqueda AI.',
            placeholder: 'costanera\nrío uruguay\natardecer',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                minRows: 3,
                maxLength: 1500
            }
        },
        {
            id: 'coordinates',
            type: FieldTypeEnum.COORDINATES,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Coordenadas',
            description:
                'Punto en el mapa. Arrastrá el marcador o hacé click para ubicarlo. También podés ingresar latitud y longitud manualmente.',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                type: 'COORDINATES',
                addressFields: {
                    street: 'address'
                },
                geocodingCountryCodes: ['ar']
            }
        }
    ]
});

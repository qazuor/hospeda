import { PermissionEnum, PointOfInterestTypeEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the Basic Info section of point of interest.
 *
 * HOS-144 §6.3: unlike `attractions`, POI has no plain `name`/`description`
 * columns — display content lives in `nameI18n`/`descriptionI18n`
 * (HOS-138, `I18nText`), rendered via `I18N_TEXT`/`I18N_TEXTAREA`. `type`
 * stays a plain required `SELECT` unchanged from how attractions' equivalent
 * field works (NG-5 — no derivation/semantics change here).
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales del punto de interés',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
        edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
    },
    fields: [
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description:
                'Identificador estable del punto de interés (también usado como clave i18n)',
            placeholder: 'plaza-general-artigas',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:[-_][a-z0-9]+)*$'
            }
        },
        {
            id: 'nameI18n',
            type: FieldTypeEnum.I18N_TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del punto de interés en cada idioma (ES / EN / PT)',
            placeholder: 'Ingresa el nombre del punto de interés',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                maxLength: 150,
                minLength: 2
            }
        },
        {
            id: 'descriptionI18n',
            type: FieldTypeEnum.I18N_TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción del punto de interés en cada idioma (ES / EN / PT)',
            placeholder: 'Describe el punto de interés',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                minRows: 3,
                maxLength: 500
            }
        },
        {
            id: 'type',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Tipo',
            description:
                'Categoría cerrada legacy/transitoria (HOS-138) — el modelo de categorías M2M (HOS-139) será la fuente de verdad a futuro',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: PointOfInterestTypeEnum.BEACH, label: 'Playa' },
                    { value: PointOfInterestTypeEnum.STADIUM, label: 'Estadio' },
                    { value: PointOfInterestTypeEnum.PARK, label: 'Parque' },
                    { value: PointOfInterestTypeEnum.MUSEUM, label: 'Museo' },
                    { value: PointOfInterestTypeEnum.PLAZA, label: 'Plaza' },
                    { value: PointOfInterestTypeEnum.MONUMENT, label: 'Monumento' },
                    { value: PointOfInterestTypeEnum.VIEWPOINT, label: 'Mirador' },
                    { value: PointOfInterestTypeEnum.NATURAL, label: 'Natural' },
                    { value: PointOfInterestTypeEnum.OTHER, label: 'Otro' }
                ]
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono para el punto de interés',
            placeholder: 'mountain',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 1
            }
        }
    ]
});

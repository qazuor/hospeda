import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Basic Info section configuration for Feature entity.
 *
 * SPEC-266: `name` column dropped from the schema — display label is now
 * resolved at runtime from `@repo/i18n` using `accommodations.featureNames.<slug>`.
 * `applicableVerticals` added as a required checkbox-group field (min 1 vertical).
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos principales de la característica',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.FEATURE_CREATE],
        edit: [PermissionEnum.FEATURE_UPDATE]
    },
    fields: [
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Slug',
            description: 'Identificador único para URLs',
            placeholder: 'vista-al-mar',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.I18N_TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción de la característica en cada idioma (ES / EN / PT)',
            placeholder: 'Describe qué incluye esta característica',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono a mostrar',
            placeholder: 'beach-umbrella',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                maxLength: 100
            }
        },
        {
            id: 'displayWeight',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Peso de Visualización',
            description:
                'Prioridad de visualización (1-100). Mayor valor = aparece primero en tarjetas',
            placeholder: '50',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                min: 1,
                max: 100,
                step: 1
            }
        },
        {
            /**
             * SPEC-266: applicableVerticals — which verticals this feature applies to.
             * Rendered as a checkbox group via FieldTypeEnum.SELECT_MULTIPLE.
             * Validated by FeatureCreateInputSchema (min 1 vertical required).
             */
            id: 'applicableVerticals',
            type: FieldTypeEnum.SELECT_MULTIPLE,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Verticales aplicables',
            description:
                'Verticales en los que esta característica puede usarse (mínimo 1). ' +
                '"Alojamiento" incluye todas las propiedades de hospedaje; ' +
                '"Gastronomía" aplica a restaurantes y bares; "Experiencia" a actividades.',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: 'accommodation', label: 'Alojamiento' },
                    { value: 'gastronomy', label: 'Gastronomía' },
                    { value: 'experience', label: 'Experiencia' }
                ]
            }
        }
    ]
});

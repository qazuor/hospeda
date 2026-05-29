import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedEntityConfig } from '../types/consolidated-config.types';

/**
 * Spec §4.10 (Create mínimo → Edit): the create page MUST NOT show the
 * full consolidated config — that would be the same overwhelming wall of
 * empty fields the redesign is trying to avoid. The host fills only what's
 * needed to persist a DRAFT, then lands in `/edit` where the accordion +
 * quality score guide the rest.
 *
 * The five fields here mirror `AccommodationCreateDraftHttpSchema` in
 * `@repo/schemas`:
 *
 * | Field          | Schema rule                | Audience |
 * | -------------- | -------------------------- | -------- |
 * | name           | string 3-100 (required)    | host + staff |
 * | summary        | string 10-300 (required)   | host + staff |
 * | type           | AccommodationTypeEnum      | host + staff |
 * | destinationId  | uuid (async select)        | host + staff |
 * | ownerId        | uuid (async select)        | staff only |
 *
 * The HOST does not see Propietario because their own id is the implicit
 * owner — the backend resolves it from the session. Staff creating on
 * behalf of a host MUST select the owner explicitly, otherwise the draft
 * is attributed to the staff member instead of the host they meant to set
 * up.
 */
export const createAccommodationMinimalCreateConfig = (
    t: ReturnType<typeof useTranslations>['t'],
    accommodationTypeOptions: SelectOption[],
    {
        includeOwner
    }: {
        /**
         * Whether to render the Propietario (ownerId) field. Pass `true`
         * for staff/admin so they can create on behalf of a host; pass
         * `false` for HOST users — their id will be assigned by the
         * backend from the session.
         */
        readonly includeOwner: boolean;
    }
): ConsolidatedEntityConfig => {
    const accommodationName = t('admin-entities.entities.accommodation.singular');

    return {
        sections: [
            {
                id: 'minimal-create',
                title: 'Datos principales',
                description: 'Lo mínimo para guardar tu anuncio como borrador.',
                layout: LayoutTypeEnum.GRID,
                modes: ['create'],
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_CREATE],
                    edit: [PermissionEnum.ACCOMMODATION_CREATE]
                },
                fields: [
                    {
                        id: 'name',
                        type: FieldTypeEnum.TEXT,
                        required: true,
                        modes: ['create'],
                        label: t('fields.accommodation.name.label'),
                        placeholder: t('fields.accommodation.name.placeholder')
                    },
                    {
                        id: 'summary',
                        type: FieldTypeEnum.TEXTAREA,
                        required: true,
                        modes: ['create'],
                        label: 'Resumen',
                        placeholder: 'Una frase atractiva (10-300 caracteres).'
                    },
                    {
                        id: 'type',
                        type: FieldTypeEnum.SELECT,
                        required: true,
                        modes: ['create'],
                        label: t('fields.accommodation.type.label'),
                        placeholder: t('fields.accommodation.type.placeholder'),
                        typeConfig: {
                            options: accommodationTypeOptions
                        }
                    },
                    {
                        id: 'destinationId',
                        type: FieldTypeEnum.DESTINATION_SELECT,
                        required: true,
                        modes: ['create'],
                        label: t('fields.accommodation.destinationId.label'),
                        placeholder: t('fields.accommodation.destinationId.placeholder'),
                        typeConfig: {
                            searchMode: 'client',
                            minCharToSearch: 1,
                            showAvatar: false,
                            clearable: true
                        }
                    },
                    ...(includeOwner
                        ? [
                              {
                                  id: 'ownerId',
                                  type: FieldTypeEnum.USER_SELECT,
                                  required: true,
                                  modes: ['create' as const],
                                  label: t('fields.accommodation.ownerId.label'),
                                  placeholder: t('fields.accommodation.ownerId.placeholder'),
                                  // Owner picker shows the standard user search. Staff are
                                  // expected to pick a host; the backend will reject the
                                  // create if the selected user isn't allowed to own.
                                  // NOTE: roleFilter was tempting here but the admin users
                                  // API rejects `roles=HOST` as "Invalid pagination
                                  // parameters" today — bringing this back is a separate
                                  // backend ticket. Initial load 400 was noisier than the
                                  // mild UX cost of an unfiltered picker.
                                  typeConfig: {
                                      searchMode: 'server' as const,
                                      minCharToSearch: 2,
                                      showAvatar: true,
                                      clearable: false
                                  }
                              }
                          ]
                        : [])
                ]
            }
        ],
        metadata: {
            title: accommodationName,
            description: t('admin-entities.entities.accommodation.description'),
            entityName: accommodationName,
            entityNamePlural: t('admin-entities.entities.accommodation.plural')
        }
    };
};

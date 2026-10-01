import { createContentModerationTermSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { EntityCreatePageBase } from '@/components/entity-pages';
import { useCreateModerationTerm } from '@/features/content-moderation/hooks/useModerationTermQuery';
import {
    buildModerationCategoryOptions,
    buildModerationTermKindOptions
} from '@/features/content-moderation/moderation-term-options';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

export const Route = createFileRoute('/_authed/content/moderation-terms/new')({
    component: ModerationTermCreatePage,
    errorComponent: createErrorComponent('ModerationTerm'),
    pendingComponent: createPendingComponent()
});

function ModerationTermCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateModerationTerm();
    const { t } = useTranslations();

    const entityName = t('content-moderation.terms.singular');
    const entityNamePlural = t('content-moderation.terms.plural');

    // Derived from `createContentModerationTermSchema` — the same object the
    // submit handler validates with — so the form cannot offer a value that
    // `safeParse` then refuses. It used to offer `self_harm`, which is not a
    // member of ModerationCategoryEnum (HOS-1068).
    const { options: kindOptions } = buildModerationTermKindOptions({ t });
    const { options: categoryOptions } = buildModerationCategoryOptions({ t });

    const createConfig: EntityCreateConfig = {
        entityType: 'contentModerationTerm',
        title: t('content-moderation.terms.create'),
        description: t('content-moderation.terms.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/moderation-terms',
        submitLabel: t('content-moderation.terms.create'),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('content-moderation.terms.messages.created'),
        successToastMessage: t('content-moderation.terms.messages.created'),
        errorToastTitle: t('content-moderation.terms.messages.createError'),
        errorMessage: t('content-moderation.terms.messages.createError')
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={createContentModerationTermSchema}
                createConsolidatedConfig={() => ({
                    sections: [
                        {
                            id: 'basic-info',
                            title: t('content-moderation.terms.title'),
                            layout: LayoutTypeEnum.GRID,
                            modes: ['create', 'edit', 'view'],
                            fields: [
                                {
                                    id: 'term',
                                    label: t('content-moderation.terms.form.termLabel'),
                                    type: FieldTypeEnum.TEXT,
                                    required: true,
                                    placeholder: t('content-moderation.terms.form.termPlaceholder')
                                },
                                {
                                    id: 'kind',
                                    label: t('content-moderation.terms.form.kindLabel'),
                                    type: FieldTypeEnum.SELECT,
                                    required: true,
                                    typeConfig: { options: kindOptions }
                                },
                                {
                                    id: 'category',
                                    label: t('content-moderation.terms.form.categoryLabel'),
                                    type: FieldTypeEnum.SELECT,
                                    required: true,
                                    typeConfig: { options: categoryOptions }
                                },
                                {
                                    id: 'severity',
                                    label: t('content-moderation.terms.form.severityLabel'),
                                    type: FieldTypeEnum.NUMBER,
                                    required: false,
                                    defaultValue: 1.0,
                                    typeConfig: {
                                        type: 'NUMBER',
                                        min: 0,
                                        max: 1,
                                        step: 0.1
                                    }
                                },
                                {
                                    id: 'enabled',
                                    label: t('content-moderation.terms.form.enabledLabel'),
                                    type: FieldTypeEnum.SWITCH,
                                    defaultValue: true
                                }
                            ]
                        }
                    ] satisfies SectionConfig[],
                    metadata: { entityName, entityNamePlural }
                })}
                configDeps={[]}
                // biome-ignore lint/suspicious/noExplicitAny: EntityCreatePageBase expects loose mutation type
                createMutation={createMutation as any}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

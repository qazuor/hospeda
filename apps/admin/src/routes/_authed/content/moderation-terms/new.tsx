import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { useCreateModerationTerm } from '@/features/content-moderation/hooks/useModerationTermQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, createContentModerationTermSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

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
                                    config: {
                                        options: [
                                            {
                                                value: 'word',
                                                label: t('content-moderation.terms.kinds.word')
                                            },
                                            {
                                                value: 'domain',
                                                label: t('content-moderation.terms.kinds.domain')
                                            }
                                        ]
                                    }
                                },
                                {
                                    id: 'category',
                                    label: t('content-moderation.terms.form.categoryLabel'),
                                    type: FieldTypeEnum.SELECT,
                                    required: true,
                                    config: {
                                        options: [
                                            {
                                                value: 'hate',
                                                label: t('content-moderation.categories.hate')
                                            },
                                            {
                                                value: 'sexual',
                                                label: t('content-moderation.categories.sexual')
                                            },
                                            {
                                                value: 'violence',
                                                label: t('content-moderation.categories.violence')
                                            },
                                            {
                                                value: 'harassment',
                                                label: t('content-moderation.categories.harassment')
                                            },
                                            {
                                                value: 'self_harm',
                                                label: t('content-moderation.categories.self_harm')
                                            },
                                            {
                                                value: 'spam',
                                                label: t('content-moderation.categories.spam')
                                            },
                                            {
                                                value: 'other',
                                                label: t('content-moderation.categories.other')
                                            }
                                        ]
                                    }
                                },
                                {
                                    id: 'severity',
                                    label: t('content-moderation.terms.form.severityLabel'),
                                    type: FieldTypeEnum.NUMBER,
                                    required: false,
                                    defaultValue: 1.0,
                                    config: {
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
                    ],
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

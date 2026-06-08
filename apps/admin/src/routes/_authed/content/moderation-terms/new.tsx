import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { useCreateModerationTerm } from '@/features/content-moderation/hooks/useModerationTermQuery';
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

    const createConfig: EntityCreateConfig = {
        entityType: 'contentModerationTerm',
        title: 'Crear término',
        description: 'Gestionar términos y dominios bloqueados para moderación de contenido',
        entityName: 'término',
        entityNamePlural: 'términos',
        basePath: '/content/moderation-terms',
        submitLabel: 'Crear',
        savingLabel: 'Guardando...',
        successToastTitle: 'Término creado',
        successToastMessage: 'El término se creó exitosamente',
        errorToastTitle: 'Error al crear',
        errorMessage: 'No se pudo crear el término'
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
                            title: 'Información básica',
                            layout: LayoutTypeEnum.GRID,
                            modes: ['create', 'edit', 'view'],
                            fields: [
                                {
                                    id: 'term',
                                    label: 'Término',
                                    type: FieldTypeEnum.TEXT,
                                    required: true,
                                    placeholder: 'Ej: spam, dominio-malicioso.com'
                                },
                                {
                                    id: 'kind',
                                    label: 'Tipo',
                                    type: FieldTypeEnum.SELECT,
                                    required: true,
                                    config: {
                                        options: [
                                            { value: 'word', label: 'Palabra' },
                                            { value: 'domain', label: 'Dominio' }
                                        ]
                                    }
                                },
                                {
                                    id: 'category',
                                    label: 'Categoría',
                                    type: FieldTypeEnum.SELECT,
                                    required: true,
                                    config: {
                                        options: [
                                            { value: 'hate', label: 'Odio' },
                                            { value: 'sexual', label: 'Sexual' },
                                            { value: 'violence', label: 'Violencia' },
                                            { value: 'harassment', label: 'Acoso' },
                                            { value: 'self_harm', label: 'Autolesión' },
                                            { value: 'spam', label: 'Spam' },
                                            { value: 'other', label: 'Otro' }
                                        ]
                                    }
                                },
                                {
                                    id: 'severity',
                                    label: 'Severidad (0-1)',
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
                                    label: 'Habilitado',
                                    type: FieldTypeEnum.SWITCH,
                                    defaultValue: true
                                }
                            ]
                        }
                    ],
                    metadata: { entityName: 'término', entityNamePlural: 'términos' }
                })}
                configDeps={[]}
                // biome-ignore lint/suspicious/noExplicitAny: EntityCreatePageBase expects loose mutation type
                createMutation={createMutation as any}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

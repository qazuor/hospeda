import { EntityFormProvider, EntityFormSection, FormModeEnum } from '@/components/entity-form';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { unflattenValues } from '@/components/entity-form/utils/unflatten-values.utils';
import { EntityPageHeader } from '@/components/entity-header/EntityPageHeader';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Card, CardContent } from '@/components/ui-wrapped/Card';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { parseApiValidationErrors } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import { useTranslations } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { Suspense, useMemo, useState } from 'react';
import type { ZodSchema } from 'zod';
import type { EntityCreateConfig } from './EntityCreateContent';

/**
 * Props for EntityCreatePageBase.
 *
 * Intentionally compatible with `EntityCreateContentProps` so existing
 * routes can swap the import with no other changes.
 */
export interface EntityCreatePageBaseProps {
    readonly config: EntityCreateConfig;
    readonly createConsolidatedConfig: () => {
        sections: ConsolidatedSectionConfig[] | SectionConfig[];
        metadata?: Record<string, unknown>;
    };
    readonly createMutation: {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };
    readonly onNavigate: (path: string) => void;
    readonly configDeps?: readonly unknown[];
    /** Optional wrapper around the form content (e.g., PlanLimitGate). */
    readonly formWrapper?: (children: React.ReactNode) => React.ReactNode;
    readonly zodSchema?: ZodSchema;
}

/**
 * EntityCreatePageBase — visual successor of `EntityCreateContent`, aligned
 * with the new view / edit shell (SPEC-154 Phase 5-B, spec §4.10).
 *
 * Differences vs. the legacy `EntityCreateContent`:
 * - Chrome uses the shared `EntityPageHeader` (sticky, mode='create',
 *   Cancel + Create buttons) instead of an inline Card header.
 * - Drops `FormSidebarLayout` + `SmartNavigation` + `SmartBreadcrumbs`. The
 *   minimal-create flow has a single short form; multi-step navigation is
 *   not warranted.
 * - Drops the accordion wrapper. Each visible section renders flat inside a
 *   single `Card` so the user sees every required field at once.
 *
 * Behaviour that stays identical:
 * - Same input contract (`EntityCreateConfig`, consolidated config factory,
 *   mutation, navigate). Drop-in replacement.
 * - `afterCreateRedirectMode: 'edit'` routes to `${basePath}/${newId}/edit`
 *   on success; legacy default `'view'` routes to `${basePath}/${newId}`.
 * - API validation errors are parsed via `parseApiValidationErrors` and
 *   shown both as field errors and a toast.
 */
export function EntityCreatePageBase({
    config,
    createConsolidatedConfig,
    createMutation,
    onNavigate,
    configDeps = [],
    formWrapper,
    zodSchema
}: EntityCreatePageBaseProps) {
    const { addToast } = useToast();
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;

    const [values, setValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const { sections, entityConfig } = useMemo(() => {
        const consolidatedConfig = createConsolidatedConfig();
        const createSections = filterSectionsByMode(
            consolidatedConfig.sections as ConsolidatedSectionConfig[],
            'create'
        );

        return {
            sections: createSections,
            entityConfig: {
                id: `${config.entityType}-new`,
                entityType: config.entityType,
                title: config.title,
                description: config.description,
                entityName:
                    (consolidatedConfig.metadata?.entityName as string) || config.entityName,
                entityNamePlural:
                    (consolidatedConfig.metadata?.entityNamePlural as string) ||
                    config.entityNamePlural,
                sections: createSections,
                viewSections: [],
                editSections: createSections,
                routes: {
                    base: config.basePath,
                    view: `${config.basePath}/$id`,
                    edit: `${config.basePath}/$id/edit`,
                    sections: {},
                    editSections: {}
                },
                permissions: {
                    view: ['view'],
                    edit: ['edit'],
                    create: ['create'],
                    delete: ['delete']
                }
            }
        };
        // biome-ignore lint/correctness/useExhaustiveDependencies: spread configDeps deliberately to mirror EntityCreateContent's contract
    }, [config, createConsolidatedConfig, ...configDeps]);

    const userPermissions = useUserPermissions();

    /** Handle field value changes and clear field errors. */
    const handleFieldChange = (fieldId: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = unflattenValues(values);
            adminLogger.debug(`[${config.entityType}Create] Saving values`, payload);
            const result = await createMutation.mutateAsync(payload);

            addToast({
                title: config.successToastTitle,
                message: config.successToastMessage,
                variant: 'success'
            });

            const newId = (result as { id: string }).id;
            const redirectMode = config.afterCreateRedirectMode ?? 'view';
            const targetPath =
                redirectMode === 'edit'
                    ? `${config.basePath}/${newId}/edit`
                    : `${config.basePath}/${newId}`;
            onNavigate(targetPath);
        } catch (error) {
            adminLogger.error(`Failed to create ${config.entityType}`, error);

            let toastMessage = config.errorMessage;
            const apiBody = (error as { body?: unknown }).body;
            const fieldErrors = parseApiValidationErrors({ error: apiBody, t: tAny });

            if (Object.keys(fieldErrors).length === 0 && error instanceof Error) {
                toastMessage = error.message;
            }

            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }

            addToast({
                title: config.errorToastTitle,
                message: toastMessage,
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onNavigate(config.basePath);
    };

    const renderSections = () =>
        sections.map((section: SectionConfig, index: number) => (
            <EntityFormSection
                key={section.id || `section-${index}`}
                config={section}
                values={values}
                errors={errors}
                onFieldChange={handleFieldChange}
                onFieldBlur={(fieldId) => {
                    adminLogger.log('Field blurred:', fieldId);
                }}
                disabled={isSaving}
                entityData={values}
                // TYPE-WORKAROUND: userPermissions typed as PermissionEnum[] upstream but EntityFormSection expects string[]; enums are structurally string-assignable.
                userPermissions={userPermissions as unknown as string[]}
            />
        ));

    const formContent = (
        <div className="space-y-4 p-6">
            <h1 className="sr-only">{config.title}</h1>

            <EntityErrorBoundary>
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center p-8">
                            <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    }
                >
                    <EntityFormProvider
                        config={entityConfig}
                        mode={FormModeEnum.CREATE}
                        initialValues={{}}
                        userPermissions={userPermissions as PermissionEnum[]}
                        onSave={handleSave}
                        zodSchema={zodSchema}
                    >
                        <EntityPageHeader
                            mode="create"
                            title={config.title}
                            subtitle={config.description}
                            createActions={{
                                onCancel: handleCancel,
                                onCreate: handleSave,
                                isCreating: isSaving
                            }}
                        />

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSave();
                            }}
                        >
                            <Card>
                                <CardContent className="space-y-6 py-6">
                                    {renderSections()}
                                </CardContent>
                            </Card>
                        </form>
                    </EntityFormProvider>
                </Suspense>
            </EntityErrorBoundary>
        </div>
    );

    return formWrapper ? formWrapper(formContent) : formContent;
}

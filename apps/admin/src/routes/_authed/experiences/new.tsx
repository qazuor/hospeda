/**
 * Experience create page — allows admins to create a new experience listing.
 *
 * Uses `EntityCreatePageBase` with the experience consolidated config.
 * Supports an optional owner assignment via OwnerSelect (existing users only).
 * Gate-protected by COMMERCE_CREATE.
 *
 * Mirrors the gastronomy create page pattern (SPEC-240 T-028).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createExperienceConsolidatedConfig } from '@/features/experience';
import { useCreateExperienceMutation } from '@/features/experience';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { ExperienceAdminCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/experiences/new')({
    component: ExperienceCreatePage,
    errorComponent: createErrorComponent('Experience'),
    pendingComponent: createPendingComponent()
});

/**
 * Create page for a new experience listing.
 *
 * The create form includes all commerce identity fields, experience-specific
 * fields (type, priceUnit, priceFrom, isPriceOnRequest), and operational fields.
 * An optional owner can be assigned on creation via the ownerId field in the
 * identity section (backed by OwnerSelect in the consolidated config).
 */
function ExperienceCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();

    // TYPE-WORKAROUND: EntityCreatePageBase expects a generic mutation shape;
    // useCreateExperienceMutation returns a strongly-typed variant that is
    // structurally compatible at runtime (brand-only mismatch, safe at the call site).
    const createMutation = useCreateExperienceMutation() as unknown as {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };

    const entityName = t('admin-entities.entities.experience.singular');
    const entityNamePlural = t('admin-entities.entities.experience.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'experience',
        title: t('admin-entities.experience.create.title'),
        description: t('admin-entities.entities.experience.description'),
        entityName,
        entityNamePlural,
        basePath: '/experiences',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.experience.create.successTitle'),
        successToastMessage: t('admin-entities.experience.create.successMessage'),
        errorToastTitle: t('admin-entities.experience.create.errorTitle'),
        errorMessage: t('admin-entities.experience.create.errorMessage')
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.COMMERCE_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={ExperienceAdminCreateInputSchema}
                createConsolidatedConfig={() => createExperienceConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

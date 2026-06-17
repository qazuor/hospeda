/**
 * Gastronomy create page — allows admins to create a new gastronomy listing.
 *
 * Uses `EntityCreatePageBase` with the gastronomy consolidated config.
 * Supports an optional owner assignment via OwnerSelect (existing users only —
 * new-owner provisioning is out of scope for this task).
 * Gate-protected by COMMERCE_CREATE.
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreatePageBase } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { createGastronomyConsolidatedConfig } from '@/features/gastronomy';
import { useCreateGastronomyMutation } from '@/features/gastronomy';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { GastronomyAdminCreateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/gastronomies/new')({
    component: GastronomyCreatePage,
    errorComponent: createErrorComponent('Gastronomy'),
    pendingComponent: createPendingComponent()
});

/**
 * Create page for a new gastronomy listing.
 *
 * The create form includes all commerce identity fields, gastronomy-specific
 * fields (type, priceRange, menuUrl), and operational fields.  An optional
 * owner can be assigned on creation via the ownerId field in the identity
 * section (backed by OwnerSelect in the consolidated config).
 */
function GastronomyCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();

    // TYPE-WORKAROUND: EntityCreatePageBase expects a generic mutation shape;
    // useCreateGastronomyMutation returns a strongly-typed variant that is
    // structurally compatible at runtime (brand-only mismatch, safe at the call site).
    const createMutation = useCreateGastronomyMutation() as unknown as {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };

    const entityName = t('admin-entities.entities.gastronomy.singular');
    const entityNamePlural = t('admin-entities.entities.gastronomy.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'gastronomy',
        title: t('admin-entities.gastronomy.create.title'),
        description: t('admin-entities.entities.gastronomy.description'),
        entityName,
        entityNamePlural,
        basePath: '/gastronomies',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.gastronomy.create.successTitle'),
        successToastMessage: t('admin-entities.gastronomy.create.successMessage'),
        errorToastTitle: t('admin-entities.gastronomy.create.errorTitle'),
        errorMessage: t('admin-entities.gastronomy.create.errorMessage')
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.COMMERCE_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={GastronomyAdminCreateInputSchema}
                createConsolidatedConfig={() => createGastronomyConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

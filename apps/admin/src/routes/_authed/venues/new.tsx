/**
 * Venue create page — allows admins to create a new venue listing.
 *
 * Uses `EntityCreatePageBase` with the venue consolidated config.
 * Supports an optional owner assignment via OwnerSelect (existing users only —
 * new-owner provisioning is out of scope for this task).
 * Gate-protected by VENUE_CREATE.
 */

import { PermissionEnum, VenueAdminCreateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { EntityCreatePageBase } from '@/components/entity-pages';
import { createVenueConsolidatedConfig, useCreateVenueMutation } from '@/features/venue';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

export const Route = createFileRoute('/_authed/venues/new')({
    component: VenueCreatePage,
    errorComponent: createErrorComponent('Gastronomy'),
    pendingComponent: createPendingComponent()
});

/**
 * Create page for a new venue listing.
 *
 * The create form includes all listing identity fields, venue-specific
 * fields (type, priceRange, menuUrl), and operational fields.  An optional
 * owner can be assigned on creation via the ownerId field in the identity
 * section (backed by OwnerSelect in the consolidated config).
 */
function VenueCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();

    // TYPE-WORKAROUND: EntityCreatePageBase expects a generic mutation shape;
    // useCreateVenueMutation returns a strongly-typed variant that is
    // structurally compatible at runtime (brand-only mismatch, safe at the call site).
    const createMutation = useCreateVenueMutation() as unknown as {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };

    const entityName = t('admin-entities.entities.venue.singular');
    const entityNamePlural = t('admin-entities.entities.venue.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'venue',
        title: t('admin-entities.venue.create.title'),
        description: t('admin-entities.entities.venue.description'),
        entityName,
        entityNamePlural,
        basePath: '/venues',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: t('admin-entities.venue.create.successTitle'),
        successToastMessage: t('admin-entities.venue.create.successMessage'),
        errorToastTitle: t('admin-entities.venue.create.errorTitle'),
        errorMessage: t('admin-entities.venue.create.errorMessage')
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.VENUE_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                zodSchema={VenueAdminCreateInputSchema}
                createConsolidatedConfig={() => createVenueConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

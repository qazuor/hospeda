import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { EntityCreatePageBase } from '@/components/entity-pages';
import { createPointOfInterestConsolidatedConfig } from '@/features/points-of-interest/config';
import { buildPointOfInterestSubmitPayload } from '@/features/points-of-interest/hooks/usePointOfInterestPage';
import { useCreatePointOfInterestMutation } from '@/features/points-of-interest/hooks/usePointOfInterestQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { adminLogger } from '@/utils/logger';

export const Route = createFileRoute('/_authed/content/points-of-interest/new')({
    component: PointOfInterestCreatePage,
    errorComponent: createErrorComponent('PointOfInterest'),
    pendingComponent: createPendingComponent()
});

function PointOfInterestCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const rawCreateMutation = useCreatePointOfInterestMutation();

    // HOS-144 §6.3: the create form collects the synthetic `coordinates`
    // ({ lat, long } strings from CoordinatesField) and "one keyword per
    // line" `keywords` textarea value — neither matches the API's flat
    // numeric lat/long columns or `keywords: text[]` shape. Wrap the raw
    // mutation's `mutateAsync` with the same submit-payload builder
    // `usePointOfInterestPage` uses for updates, so `EntityCreatePageBase`
    // can keep passing raw, unflattened form values without knowing about
    // the transform. Invalid coordinate input throws instead of silently
    // persisting garbage — `EntityCreatePageBase`'s existing catch already
    // toasts `error.message` (HOS-144 judgment-day FIX 1/FIX 3).
    const createMutation = {
        mutateAsync: (values: Record<string, unknown>) => {
            const result = buildPointOfInterestSubmitPayload({ values, mode: 'create' });
            if (!result.ok) {
                adminLogger.error('[PointOfInterestCreatePage] Invalid coordinates on submit', {
                    error: result.error
                });
                throw new Error(t('error.form.validation-failed'));
            }
            return rawCreateMutation.mutateAsync(result.payload);
        },
        isPending: rawCreateMutation.isPending
    };

    const entityName = t('admin-entities.entities.pointOfInterest.singular');
    const entityNamePlural = t('admin-entities.entities.pointOfInterest.plural');

    const createConfig: EntityCreateConfig = {
        entityType: 'pointOfInterest',
        title: 'Nuevo Punto de Interés',
        description: t('admin-entities.entities.pointOfInterest.description'),
        entityName,
        entityNamePlural,
        basePath: '/content/points-of-interest',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        successToastTitle: 'Punto de interés creado',
        successToastMessage: 'El punto de interés se creó exitosamente',
        errorToastTitle: 'Error al crear el punto de interés',
        errorMessage: 'No pudimos crear el punto de interés. Probá de nuevo.',
        // HOS-144 §6.2: categories/destinations require an existing POI id
        // (HOS-143's endpoints are all `/{id}/categories`, `/{id}/destinations`),
        // so create lands on the edit page rather than the view page.
        afterCreateRedirectMode: 'edit'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POINT_OF_INTEREST_CREATE]}>
            <EntityCreatePageBase
                config={createConfig}
                createConsolidatedConfig={() => createPointOfInterestConsolidatedConfig(t)}
                configDeps={[t]}
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
            />
        </RoutePermissionGuard>
    );
}

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent } from '@/components/ui-wrapped/Card';
import { createAccommodationMinimalCreateConfig } from '@/features/accommodations/config/accommodation-minimal-create.config';
import { useCreateAccommodationMutation } from '@/features/accommodations/hooks/useAccommodationQuery';
import { PlanLimitGate } from '@/features/billing/PlanLimitGate';
import { useAccommodationCount } from '@/features/billing/use-limit-counts';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import { LimitKey } from '@repo/billing';
import {
    AccommodationCreateDraftHttpSchema,
    AccommodationTypeEnum,
    PermissionEnum,
    RoleEnum
} from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * Operator roles that act on behalf of any owner and therefore must
 * bypass the per-actor plan-limit gate (SPEC-117 M-1). Plan limits apply
 * to the actual accommodation owners, not to admins creating entities for
 * them.
 *
 * Per spec §4.10, these same roles ALSO see the Propietario field on the
 * minimal create form so they can assign the draft to the right host.
 * Hosts creating their own draft skip the field — the backend resolves
 * `ownerId` from the session.
 */
const PLAN_LIMIT_BYPASS_ROLES: readonly RoleEnum[] = [
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.CLIENT_MANAGER
];

export const Route = createFileRoute('/_authed/accommodations/new')({
    component: AccommodationCreatePage,
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

function AccommodationCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const { user } = useAuthContext();
    const createMutation = useCreateAccommodationMutation();
    const accommodationTypeOptions = useAccommodationTypeOptions(AccommodationTypeEnum);
    const { count: accommodationCount } = useAccommodationCount();

    const entityName = t('admin-entities.entities.accommodation.singular');
    const entityNamePlural = t('admin-entities.entities.accommodation.plural');

    const bypassesPlanLimit = PLAN_LIMIT_BYPASS_ROLES.includes(user?.role as RoleEnum);
    // Owner picker is staff-only — hosts implicitly create their own drafts.
    const includeOwnerField = bypassesPlanLimit;

    const createConfig: EntityCreateConfig = {
        entityType: 'accommodation',
        title: t('admin-entities.list.new').replace('{entity}', entityName),
        description: t('admin-entities.entities.accommodation.description'),
        entityName,
        entityNamePlural,
        basePath: '/accommodations',
        submitLabel: t('admin-entities.form.title.create').replace('{entity}', entityName),
        savingLabel: t('admin-entities.messages.saving'),
        // SPEC-117 D-TOAST.1 — title ≠ body.
        successToastTitle: 'Alojamiento creado',
        successToastMessage: 'El alojamiento se creó exitosamente',
        errorToastTitle: 'Error al crear el alojamiento',
        errorMessage: 'No pudimos crear el alojamiento. Probá de nuevo.',
        // Spec §4.10: create mínimo → edit. The accordion + quality score
        // on /edit guide the host through completing the listing.
        afterCreateRedirectMode: 'edit'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={AccommodationCreateDraftHttpSchema}
                createConsolidatedConfig={() =>
                    createAccommodationMinimalCreateConfig(t, accommodationTypeOptions, {
                        includeOwner: includeOwnerField
                    })
                }
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
                configDeps={[t, accommodationTypeOptions, includeOwnerField]}
                formWrapper={(children) =>
                    bypassesPlanLimit ? (
                        <>{children}</>
                    ) : (
                        <PlanLimitGate
                            limitKey={LimitKey.MAX_ACCOMMODATIONS}
                            currentCount={accommodationCount}
                            fallback={
                                <Card>
                                    <CardContent className="py-8">
                                        <div className="mx-auto max-w-md space-y-4 text-center">
                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/15">
                                                <Icon
                                                    name="alertTriangle"
                                                    className="h-8 w-8 text-warning"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground text-lg">
                                                    {t(
                                                        'admin-entities.limits.accommodationLimitReached'
                                                    )}
                                                </h3>
                                                <p className="mt-2 text-muted-foreground text-sm">
                                                    {t(
                                                        'admin-entities.limits.accommodationLimitDesc'
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex justify-center gap-3 pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        navigate({ to: '/accommodations' })
                                                    }
                                                >
                                                    {t('admin-entities.actions.back')}
                                                </Button>
                                                <Button
                                                    onClick={() =>
                                                        navigate({ to: '/billing/plans' })
                                                    }
                                                >
                                                    {t('admin-entities.actions.viewPlans')}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            }
                        >
                            {children}
                        </PlanLimitGate>
                    )
                }
            />
        </RoutePermissionGuard>
    );
}

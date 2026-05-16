import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent } from '@/components/ui-wrapped/Card';
import { createAccommodationConsolidatedConfig } from '@/features/accommodations/config';
import { useCreateAccommodationMutation } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import { LimitGate } from '@qazuor/qzpay-react';
import {
    AccommodationCreateInputSchema,
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

    const entityName = t('admin-entities.entities.accommodation.singular');
    const entityNamePlural = t('admin-entities.entities.accommodation.plural');

    const bypassesPlanLimit = PLAN_LIMIT_BYPASS_ROLES.includes(user?.role as RoleEnum);

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
        errorMessage: 'No pudimos crear el alojamiento. Probá de nuevo.'
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                zodSchema={AccommodationCreateInputSchema}
                createConsolidatedConfig={() =>
                    createAccommodationConsolidatedConfig(t, accommodationTypeOptions)
                }
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
                configDeps={[t, accommodationTypeOptions]}
                formWrapper={(children) =>
                    bypassesPlanLimit ? (
                        <>{children}</>
                    ) : (
                        <LimitGate
                            limitKey="max_accommodations"
                            fallback={
                                <Card>
                                    <CardContent className="py-8">
                                        <div className="mx-auto max-w-md space-y-4 text-center">
                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                                                <Icon
                                                    name="alertTriangle"
                                                    className="h-8 w-8 text-amber-600 dark:text-amber-400"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-amber-900 text-lg dark:text-amber-100">
                                                    {t(
                                                        'admin-entities.limits.accommodationLimitReached'
                                                    )}
                                                </h3>
                                                <p className="mt-2 text-amber-800 text-sm dark:text-amber-200">
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
                        </LimitGate>
                    )
                }
            />
        </RoutePermissionGuard>
    );
}

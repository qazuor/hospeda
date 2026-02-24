import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityCreateContent } from '@/components/entity-pages';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent } from '@/components/ui-wrapped/Card';
import { createAccommodationConsolidatedConfig } from '@/features/accommodations/config';
import { useCreateAccommodationMutation } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import { LimitGate } from '@qazuor/qzpay-react';
import { AccommodationTypeEnum, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';

export const Route = createFileRoute('/_authed/accommodations/new')({
    component: AccommodationCreatePage,
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

function AccommodationCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const createMutation = useCreateAccommodationMutation();
    const accommodationTypeOptions = useAccommodationTypeOptions(AccommodationTypeEnum);

    const createConfig: EntityCreateConfig = useMemo(
        () => ({
            entityType: 'accommodation',
            title: `${t('admin-entities.list.new')} ${t('admin-entities.entities.accommodation.singular')}`,
            description: t('admin-entities.entities.accommodation.description'),
            entityName: 'Alojamiento',
            entityNamePlural: 'Alojamientos',
            basePath: '/accommodations',
            submitLabel: 'Crear Alojamiento',
            savingLabel: 'Creando...',
            successToastTitle: 'Alojamiento creado',
            successToastMessage: 'El alojamiento se ha creado exitosamente',
            errorToastTitle: 'Error al crear',
            errorMessage: 'Error inesperado al crear el alojamiento'
        }),
        [t]
    );

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
            <EntityCreateContent
                config={createConfig}
                createConsolidatedConfig={() =>
                    createAccommodationConsolidatedConfig(t, accommodationTypeOptions)
                }
                createMutation={createMutation}
                onNavigate={(path) => navigate({ to: path })}
                configDeps={[t, accommodationTypeOptions]}
                formWrapper={(children) => (
                    <LimitGate
                        limitKey="max_accommodations"
                        fallback={
                            <Card>
                                <CardContent className="py-8">
                                    <div className="mx-auto max-w-md space-y-4 text-center">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                                            <Icon
                                                name="alertTriangle"
                                                className="h-8 w-8 text-amber-600"
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-amber-900 text-lg">
                                                Límite de alojamientos alcanzado
                                            </h3>
                                            <p className="mt-2 text-amber-800 text-sm">
                                                Has alcanzado el límite máximo de alojamientos
                                                permitidos en tu plan actual. Actualiza tu plan para
                                                crear más alojamientos.
                                            </p>
                                        </div>
                                        <div className="flex justify-center gap-3 pt-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => navigate({ to: '/accommodations' })}
                                            >
                                                Volver
                                            </Button>
                                            <Button
                                                onClick={() => navigate({ to: '/billing/plans' })}
                                            >
                                                Ver planes
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        }
                    >
                        {children}
                    </LimitGate>
                )}
            />
        </RoutePermissionGuard>
    );
}

/**
 * @file _authed/social/credentials/index.tsx
 * @description Admin social credential vault list page (HOS-64 G-4, T-029).
 *
 * Card-based layout (mirrors `_authed/ai/credentials.tsx`) since the list is
 * bounded to the 4 fixed social credential keys. Read-only for now — the
 * create/rotate (T-030) and edit/delete (T-031) dialogs are added on top of
 * this page in follow-up tasks.
 *
 * Permission guard: SOCIAL_SETTINGS_MANAGE (reused per T-001).
 * SECURITY: masked cards only — ciphertext/iv/authTag/plaintext never appear.
 */

import { LoaderIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Card, CardContent } from '@/components/ui/card';
import { useSocialCredentialsQuery } from '@/features/social-credentials';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { CreateCredentialDialog } from './-components/CreateCredentialDialog';
import { CredentialsList } from './-components/CredentialsList';

export const Route = createFileRoute('/_authed/social/credentials/')({
    component: SocialCredentialsPage,
    errorComponent: createErrorComponent('SocialCredentials'),
    pendingComponent: createPendingComponent()
});

/** Admin social credential vault list page. */
function SocialCredentialsPage() {
    const { data: credentials, isLoading, error } = useSocialCredentialsQuery();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_SETTINGS_MANAGE]}>
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Credenciales sociales</h1>
                        <p className="text-muted-foreground">
                            Gestiona los secretos del pipeline de automatización social (Make.com,
                            IA, PIN de operador). Los valores se almacenan de forma segura y se
                            muestran enmascarados.
                        </p>
                    </div>
                    <CreateCredentialDialog />
                </div>

                {isLoading && (
                    <div
                        className="flex items-center justify-center py-12"
                        data-testid="social-credentials-loading"
                    >
                        <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {error && (
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-8">
                            <p
                                className="text-destructive text-sm"
                                role="alert"
                                data-testid="social-credentials-error"
                            >
                                No se pudieron cargar las credenciales.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {!isLoading && !error && (credentials?.length ?? 0) === 0 && (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p
                                className="text-muted-foreground"
                                data-testid="social-credentials-empty"
                            >
                                No hay credenciales configuradas.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {!isLoading && !error && (credentials?.length ?? 0) > 0 && (
                    <CredentialsList credentials={credentials ?? []} />
                )}
            </div>
        </RoutePermissionGuard>
    );
}

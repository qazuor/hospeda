/**
 * Application Logs Page
 *
 * Admin panel for viewing persisted application log entries (SPEC-184 T-013).
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { AppLogsPanel } from '@/features/app-logs';
import { requireAdminApiAccess } from '@/lib/admin-api-access';
import { LogsIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/ops/logs')({
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: AppLogsPage
});

function AppLogsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <LogsIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Logs de aplicación</h1>
                        <p className="text-muted-foreground">
                            Registro de eventos WARN y ERROR emitidos por los servicios del sistema.
                        </p>
                    </div>
                </div>

                {/* Logs panel */}
                <AppLogsPanel />
            </div>
        </SidebarPageLayout>
    );
}

/**
 * Cron Jobs Panel Component
 *
 * Main panel for displaying and managing all cron jobs
 */
import { Card, CardContent } from '@/components/ui/card';
import { Activity, AlertCircle, Clock } from 'lucide-react';
import { useCronJobsQuery } from '../hooks';
import { CronJobCard } from './CronJobCard';

export function CronJobsPanel() {
    const { data, isLoading, error, isRefetching } = useCronJobsQuery();

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="mt-4 text-muted-foreground text-sm">
                        Cargando tareas programadas...
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="py-12 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                    <p className="mt-4 text-destructive">Error al cargar tareas programadas</p>
                    <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.jobs.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">
                        No hay tareas programadas registradas
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats header */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">Total de tareas</p>
                                <p className="mt-1 font-bold text-2xl">{data.totalJobs}</p>
                            </div>
                            <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">Tareas activas</p>
                                <p className="mt-1 font-bold text-2xl text-green-600">
                                    {data.enabledJobs}
                                </p>
                            </div>
                            <Activity className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">
                                    Tareas deshabilitadas
                                </p>
                                <p className="mt-1 font-bold text-2xl text-orange-600">
                                    {data.totalJobs - data.enabledJobs}
                                </p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Auto-refresh indicator */}
            {isRefetching && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Actualizando...</span>
                </div>
            )}

            {/* Job cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                {data.jobs.map((job) => (
                    <CronJobCard
                        key={job.name}
                        job={job}
                    />
                ))}
            </div>

            {/* Footer info */}
            <Card className="border-dashed bg-muted/50">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                Información sobre tareas programadas
                            </p>
                            <ul className="space-y-1 text-muted-foreground text-xs">
                                <li>
                                    • Las tareas programadas se ejecutan automáticamente según su
                                    programación
                                </li>
                                <li>
                                    • Puedes ejecutar manualmente cualquier tarea activa usando el
                                    botón "Ejecutar ahora"
                                </li>
                                <li>
                                    • El modo "Dry Run" ejecuta la tarea sin hacer cambios reales en
                                    la base de datos
                                </li>
                                <li>• La lista se actualiza automáticamente cada minuto</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

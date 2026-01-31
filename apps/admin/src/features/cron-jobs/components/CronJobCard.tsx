/**
 * Cron Job Card Component
 *
 * Displays a single cron job with details and manual trigger option
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, Clock, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useTriggerCronJobMutation } from '../hooks';
import type { CronJob, CronJobResult } from '../types';

interface CronJobCardProps {
    job: CronJob;
}

export function CronJobCard({ job }: CronJobCardProps) {
    const [dryRun, setDryRun] = useState(true);
    const [lastResult, setLastResult] = useState<CronJobResult | null>(null);

    const { mutate: triggerJob, isPending, isError, error } = useTriggerCronJobMutation();

    const handleTrigger = () => {
        triggerJob(
            { jobName: job.name, dryRun },
            {
                onSuccess: (response) => {
                    setLastResult(response.data);
                }
            }
        );
    };

    // Format cron schedule for display
    const formatSchedule = (schedule: string): string => {
        const scheduleMap: Record<string, string> = {
            '0 0 * * *': 'Diariamente a medianoche',
            '*/5 * * * *': 'Cada 5 minutos',
            '0 * * * *': 'Cada hora',
            '0 0 * * 0': 'Semanalmente (domingos)',
            '0 0 1 * *': 'Mensualmente (día 1)'
        };

        return scheduleMap[schedule] || schedule;
    };

    return (
        <Card className={job.enabled ? '' : 'opacity-60'}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{job.name}</CardTitle>
                            {job.enabled ? (
                                <Badge
                                    variant="default"
                                    className="bg-green-100 text-green-800"
                                >
                                    Activo
                                </Badge>
                            ) : (
                                <Badge variant="secondary">Deshabilitado</Badge>
                            )}
                        </div>
                        <CardDescription>{job.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Schedule info */}
                <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Programación:</span>
                    <span className="font-medium">{formatSchedule(job.schedule)}</span>
                </div>

                {/* Manual trigger section */}
                {job.enabled && (
                    <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor={`dry-run-${job.name}`}
                                    className="font-medium text-sm"
                                >
                                    Modo de prueba (Dry Run)
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    Ejecutar sin hacer cambios reales
                                </p>
                            </div>
                            <Switch
                                id={`dry-run-${job.name}`}
                                checked={dryRun}
                                onCheckedChange={setDryRun}
                                disabled={isPending}
                            />
                        </div>

                        <Button
                            onClick={handleTrigger}
                            disabled={isPending}
                            size="sm"
                            className="w-full"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Ejecutando...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Ejecutar ahora
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Last execution result */}
                {lastResult && (
                    <div
                        className={`rounded-lg border p-3 ${
                            lastResult.success
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            {lastResult.success ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                            ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                            )}
                            <div className="flex-1 space-y-1">
                                <p
                                    className={`font-medium text-sm ${
                                        lastResult.success ? 'text-green-900' : 'text-red-900'
                                    }`}
                                >
                                    {lastResult.success
                                        ? 'Ejecución exitosa'
                                        : 'Error en ejecución'}
                                </p>
                                <p
                                    className={`text-xs ${
                                        lastResult.success ? 'text-green-700' : 'text-red-700'
                                    }`}
                                >
                                    {lastResult.message}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Procesados:</span>{' '}
                                        <span className="font-medium">{lastResult.processed}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Errores:</span>{' '}
                                        <span className="font-medium">{lastResult.errors}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Duración:</span>{' '}
                                        <span className="font-medium">
                                            {lastResult.durationMs}ms
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Modo:</span>{' '}
                                        <span className="font-medium">
                                            {lastResult.dryRun ? 'Prueba' : 'Real'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {isError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                            <div>
                                <p className="font-medium text-red-900 text-sm">
                                    Error al ejecutar
                                </p>
                                <p className="text-red-700 text-xs">{error?.message}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

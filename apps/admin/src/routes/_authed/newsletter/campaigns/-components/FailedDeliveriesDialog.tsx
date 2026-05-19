/**
 * @file FailedDeliveriesDialog.tsx
 * @description Modal that lists the failed-delivery rows of a campaign
 * (SPEC-101 T-101-41). Triggered from the CampaignMetricsPanel "Ver
 * errores" button.
 *
 * The recipient email arrives masked from the API
 * (`api/v1/admin/newsletter/campaigns/:id/errors`) — never shows the full
 * address (AC-101-11.3). The dialog paginates 20 rows at a time.
 */

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useCampaignErrors } from '@/hooks/newsletter';
import { useState } from 'react';

export interface FailedDeliveriesDialogProps {
    /** Campaign UUID. */
    readonly campaignId: string;
    /** Whether the dialog is currently open. */
    readonly open: boolean;
    /** Open-state setter (Shadcn Dialog convention). */
    readonly onOpenChange: (next: boolean) => void;
}

const PAGE_SIZE = 20;

export function FailedDeliveriesDialog({
    campaignId,
    open,
    onOpenChange
}: FailedDeliveriesDialogProps) {
    const [page, setPage] = useState<number>(1);
    const { data, isLoading, error } = useCampaignErrors(campaignId, page, PAGE_SIZE);

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Entregas fallidas</DialogTitle>
                </DialogHeader>

                {isLoading && (
                    <p className="text-muted-foreground text-sm">Cargando entregas fallidas…</p>
                )}

                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar las entregas fallidas. Intentá de nuevo.
                    </p>
                )}

                {!isLoading && !error && items.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground text-sm">
                        No hay entregas fallidas en esta campaña.
                    </p>
                )}

                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                        <table
                            className="w-full text-sm"
                            aria-label="Tabla de entregas fallidas"
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Email</th>
                                    <th className="px-3 py-2 font-medium">Error</th>
                                    <th className="px-3 py-2 font-medium">Reintentos</th>
                                    <th className="px-3 py-2 font-medium">Última actualización</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="border-t"
                                    >
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {row.maskedEmail}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {row.errorMessage ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">{row.retryCount}</td>
                                        <td className="px-3 py-2 text-muted-foreground text-xs">
                                            {row.updatedAt
                                                ? new Date(row.updatedAt).toLocaleString('es-AR')
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    {pagination && pagination.totalPages > 1 ? (
                        <span className="text-muted-foreground text-xs">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total}{' '}
                            resultados
                        </span>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        {pagination && pagination.totalPages > 1 && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Siguiente
                                </Button>
                            </>
                        )}
                        <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

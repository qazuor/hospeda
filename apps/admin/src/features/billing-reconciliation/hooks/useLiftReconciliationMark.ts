/**
 * @file useLiftReconciliationMark.ts
 * Mutation for administrative action 7 (ACC:7, S15).
 *
 * @module useLiftReconciliationMark
 */

import type { ReconciliationMarkLiftRequest, ReconciliationMarkLiftResponse } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Inputs required to lift the mark version the person reviewed. */
export interface LiftReconciliationMarkInput {
    /** UUID of the mark to lift. */
    readonly markId: string;
    /** Version shown in the actionable list. */
    readonly expectedVersion: number;
    /** Payments the person explicitly resolved without refund. */
    readonly resolveWithoutRefund: ReconciliationMarkLiftRequest['resolveWithoutRefund'];
    /** Optional audit note. */
    readonly note?: string;
}

/**
 * Builds the action 7 path for one reconciliation mark.
 *
 * @param input - The mark identifier.
 * @returns The exact administrative lift path.
 */
export function buildReconciliationMarkLiftPath({ markId }: { readonly markId: string }): string {
    return `/api/v1/admin/billing-reconciliation/marks/${markId}/lift`;
}

/**
 * Lifts a reconciliation mark and refreshes the actionable mark list on success.
 *
 * @returns A TanStack Query mutation for action 7.
 */
export function useLiftReconciliationMarkMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            markId,
            expectedVersion,
            resolveWithoutRefund,
            note
        }: LiftReconciliationMarkInput): Promise<ReconciliationMarkLiftResponse> => {
            const trimmedNote = note?.trim() ?? '';
            const body: ReconciliationMarkLiftRequest = {
                expectedVersion,
                resolveWithoutRefund,
                ...(trimmedNote.length > 0 ? { note: trimmedNote } : {})
            };
            const response = await fetchApi<{ data: ReconciliationMarkLiftResponse }>({
                path: buildReconciliationMarkLiftPath({ markId }),
                method: 'POST',
                body
            });
            return response.data.data;
        },
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['billing-reconciliation', 'marks'] })
    });
}

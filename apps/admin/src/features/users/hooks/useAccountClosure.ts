/**
 * @file useAccountClosure.ts
 * Query and mutation for administrative action 24 (HOS-1494): close an account
 * at its owner's request, with a mandatory reason.
 *
 * The preview (`GET /api/v1/admin/users/{id}/close-on-request`) says whose
 * account it is and which of the three preconditions of the manual closure is
 * still missing; it informs the confirmation and decides nothing. The closure
 * (`POST` on the same path with `{ reason }`) re-reads everything under its own
 * locks and answers 409 when something changed in between.
 *
 * @module useAccountClosure
 */

import type { AccountClosurePreview } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { userQueryKeys } from './useUserQuery';

/**
 * Builds the admin path of the action 24 routes for one account.
 *
 * @param input - The account's id.
 * @returns The `/api/v1/admin/users/{id}/close-on-request` path.
 */
export function buildAccountClosurePath({ userId }: { readonly userId: string }): string {
    return `/api/v1/admin/users/${userId}/close-on-request`;
}

/**
 * Query key of the action 24 preview of one account. Kept outside the user
 * detail key on purpose: the preview is fetched only while the dialog is open.
 *
 * @param input - The account's id.
 * @returns The TanStack Query key.
 */
export function accountClosurePreviewQueryKey({ userId }: { readonly userId: string }) {
    return [...userQueryKeys.all, 'close-on-request', userId] as const;
}

/** Input of {@link useAccountClosurePreview}. RO-RO. */
export interface UseAccountClosurePreviewInput {
    /** UUID of the account. */
    readonly userId: string;
    /** Whether to fetch; the card enables it only while its dialog is open. */
    readonly enabled: boolean;
}

/**
 * Reads the action 24 preview of one account. Never retries: a 403 or a 404 is
 * an answer the dialog shows, not a transient failure.
 *
 * @param input - The account's id and whether the query runs.
 * @returns A TanStack Query result holding {@link AccountClosurePreview}.
 */
export function useAccountClosurePreview({ userId, enabled }: UseAccountClosurePreviewInput) {
    return useQuery({
        queryKey: accountClosurePreviewQueryKey({ userId }),
        queryFn: async (): Promise<AccountClosurePreview> => {
            const response = await fetchApi<{ data: AccountClosurePreview }>({
                path: buildAccountClosurePath({ userId })
            });
            return response.data.data;
        },
        enabled: enabled && userId.length > 0,
        retry: false,
        staleTime: 0
    });
}

/** Input of the action 24 mutation. RO-RO. */
export interface CloseAccountOnRequestInput {
    /** UUID of the account to close. */
    readonly userId: string;
    /** Why the owner asked for it; it is kept in the audit log. */
    readonly reason: string;
}

/** Body the closure route answers on success. */
export interface CloseAccountOnRequestResult {
    /** Always `true` when the route answers 200. */
    readonly closed: boolean;
}

/**
 * Mutation hook for action 24. On success it invalidates every cached user
 * query (detail, lists and the preview), since the account is now closed.
 *
 * @returns A TanStack Query mutation taking {@link CloseAccountOnRequestInput}.
 */
export function useCloseAccountOnRequestMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            userId,
            reason
        }: CloseAccountOnRequestInput): Promise<CloseAccountOnRequestResult> => {
            const response = await fetchApi<{ data?: CloseAccountOnRequestResult }>({
                path: buildAccountClosurePath({ userId }),
                method: 'POST',
                body: { reason }
            });
            return { closed: response.data.data?.closed === true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
        }
    });
}

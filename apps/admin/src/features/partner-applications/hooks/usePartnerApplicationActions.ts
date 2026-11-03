import type {
    PartnerApplicationApproveSchema,
    PartnerApplicationCancelWaitSchema,
    PartnerApplicationRejectSchema
} from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

type ApproveBody = import('zod').infer<typeof PartnerApplicationApproveSchema>;
type RejectBody = import('zod').infer<typeof PartnerApplicationRejectSchema>;
type CancelWaitBody = import('zod').infer<typeof PartnerApplicationCancelWaitSchema>;

export function usePartnerApplicationActions() {
    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['partner-application-panel'] });
    const approve = useMutation({
        mutationFn: async ({ id, name, type, reason }: { id: string } & ApproveBody) =>
            fetchApi({
                path: `/api/v1/admin/partner-applications/${id}/approve`,
                method: 'POST',
                body: { name, type, reason }
            }),
        onSuccess: invalidate
    });
    const reject = useMutation({
        mutationFn: async ({ id, reason }: { id: string } & RejectBody) =>
            fetchApi({
                path: `/api/v1/admin/partner-applications/${id}/reject`,
                method: 'POST',
                body: { reason }
            }),
        onSuccess: invalidate
    });
    const cancelWait = useMutation({
        mutationFn: async ({ id, reason }: { id: string } & CancelWaitBody) =>
            fetchApi({
                path: `/api/v1/admin/partner-applications/${id}/cancel-wait`,
                method: 'POST',
                body: { reason }
            }),
        onSuccess: invalidate
    });
    return { approve, reject, cancelWait };
}

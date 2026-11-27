import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { newsletterCampaignQueryKeys } from './use-newsletter-campaigns';

/** Wire diagnostics from the write-free newsletter resolver. */
export const campaignResolutionReportSchema = z.object({
    blocks: z.array(
        z.object({
            blockKey: z.string(),
            candidates: z.array(z.string()),
            dropped: z.array(
                z.object({
                    id: z.string(),
                    reason: z.enum([
                        'not_published',
                        'deleted',
                        'below_min_reviews',
                        'destination_mismatch'
                    ])
                })
            ),
            repeatsUsed: z.number().int().nonnegative(),
            belowMin: z.boolean(),
            action: z.enum(['send', 'skip_run', 'hide_block', 'send_anyway'])
        })
    )
});

/** Validated resolution diagnostics, shared by preview and send confirmation. */
export type CampaignResolutionReport = z.infer<typeof campaignResolutionReportSchema>;

const previewSchema = z.object({
    html: z.string(),
    segments: z.array(z.string()).optional(),
    report: campaignResolutionReportSchema
});
const documentSchema = z.object({ content: z.array(z.object({ type: z.string() })).optional() });

/** Detect root-level dynamic nodes without interpreting their configuration. */
export function hasDynamicBlocks({ bodyJson }: { readonly bodyJson: unknown }): boolean {
    const parsed = documentSchema.safeParse(bodyJson);
    return parsed.success && !!parsed.data.content?.some((node) => node.type === 'dynamicBlock');
}

/** Resolve the persisted campaign; cache follows the campaign's saved revision. */
export function useCampaignResolution({
    id,
    revision,
    enabled = true
}: {
    readonly id: string;
    readonly revision?: unknown;
    readonly enabled?: boolean;
}) {
    return useQuery({
        queryKey: [...newsletterCampaignQueryKeys.detail(id), 'resolve-preview', revision],
        queryFn: async ({ signal }) => {
            const result = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/newsletter/campaigns/${id}/resolve-preview`,
                method: 'POST',
                signal
            });
            return previewSchema.parse(result.data.data);
        },
        enabled: enabled && !!id,
        throwOnError: false,
        staleTime: 0,
        gcTime: 0
    });
}

/** Extract only validated below-minimum diagnostics from the API error envelope. */
export function getBelowMinimumReport({
    error
}: {
    readonly error: unknown;
}): CampaignResolutionReport | null {
    if (!(error instanceof ApiError) || error.status !== 422) return null;
    const parsed = z
        .object({
            error: z.object({
                code: z.literal('DYNAMIC_BLOCK_BELOW_MIN'),
                details: z.object({ report: campaignResolutionReportSchema })
            })
        })
        .safeParse(error.body);
    return parsed.success ? parsed.data.error.details.report : null;
}

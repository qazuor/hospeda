import { z } from '../../../utils/zod';

/** Public per-block diagnostics returned to newsletter administrators. */
export const CampaignResolutionReportSchema = z.object({
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
            repeatsUsed: z.number().int().min(0),
            belowMin: z.boolean(),
            action: z.enum(['send', 'skip_run', 'hide_block', 'send_anyway'])
        })
    )
});

/** Dry-run content and report; no snapshot is persisted. */
export const CampaignResolvePreviewSchema = z.object({
    html: z.string(),
    segments: z.array(z.string()).optional(),
    report: CampaignResolutionReportSchema
});

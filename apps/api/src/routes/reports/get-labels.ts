import { LinearLabelsResponseSchema } from '../../schemas/bug-report.schema';
import { getLinearLabels } from '../../services/linear.service';
import { createSimpleRoute } from '../../utils/route-factory';

/**
 * GET /api/v1/reports/labels
 * Returns available Linear labels for bug report categorization.
 * Requires authentication. Results are cached in the Linear service for 5 minutes.
 */
export const getLabelsRoute = createSimpleRoute({
    method: 'get',
    path: '/labels',
    summary: 'Get bug report labels',
    description: 'Returns available labels for bug report categorization from Linear',
    tags: ['Reports'],
    responseSchema: LinearLabelsResponseSchema,
    handler: async () => {
        const result = await getLinearLabels();
        return { labels: result.data };
    },
    options: {
        authorizationLevel: 'protected',
        cacheTTL: 300
    }
});

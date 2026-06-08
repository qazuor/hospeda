import { createEntityHooks } from '@/lib/factories/createEntityHooks';
import type { ContentModerationTerm } from '@repo/schemas';

/**
 * Entity hooks for moderation terms CRUD operations.
 */
export const {
    useList: useModerationTermsList,
    useDetail: useModerationTermDetail,
    useCreate: useCreateModerationTerm,
    useUpdate: useUpdateModerationTerm,
    useDelete: useDeleteModerationTerm
} = createEntityHooks<ContentModerationTerm>({
    entityName: 'moderation-terms',
    apiEndpoint: '/api/v1/admin/content-moderation/terms'
});

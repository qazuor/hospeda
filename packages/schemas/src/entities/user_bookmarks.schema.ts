import type { UserBookmarkType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for user bookmarks (many-to-many between user and entities).
 */
export const rUserBookmarksSchema: z.ZodType<UserBookmarkType> = BaseEntitySchema.extend({
    userId: z.string().uuid({ message: 'error:userBookmark.userIdInvalid' }),
    entityId: z.string().uuid({ message: 'error:userBookmark.entityIdInvalid' }),
    entityType: z.string({ required_error: 'error:userBookmark.entityTypeRequired' })
});

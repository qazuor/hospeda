import { z } from 'zod';

/**
 * Post Statistics Schemas
 *
 * This file contains schemas related to post statistics and engagement:
 * - Engagement stats (likes, comments, shares)
 * - Post-specific statistical data
 */

// ============================================================================
// ENGAGEMENT STATS SCHEMA
// ============================================================================

/**
 * Schema for post engagement statistics
 * Used for tracking likes, comments, shares on posts
 */
export const PostEngagementStatsSchema = z.object({
    likes: z
        .number({
            message: 'zodError.post.engagementStats.likes.invalidType'
        })
        .int({ message: 'zodError.post.engagementStats.likes.int' })
        .min(0, { message: 'zodError.post.engagementStats.likes.min' })
        .default(0),
    comments: z
        .number({
            message: 'zodError.post.engagementStats.comments.invalidType'
        })
        .int({ message: 'zodError.post.engagementStats.comments.int' })
        .min(0, { message: 'zodError.post.engagementStats.comments.min' })
        .default(0),
    shares: z
        .number({
            message: 'zodError.post.engagementStats.shares.invalidType'
        })
        .int({ message: 'zodError.post.engagementStats.shares.int' })
        .min(0, { message: 'zodError.post.engagementStats.shares.min' })
        .default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostEngagementStats = z.infer<typeof PostEngagementStatsSchema>;

import { LimitKey } from '../types/plan.types.js';

/**
 * All limit definitions for the Hospeda billing system.
 * Values are defined per plan in plans.config.ts.
 * This file defines the metadata for each limit key.
 */
export const LIMIT_METADATA: Record<LimitKey, { name: string; description: string }> = {
    [LimitKey.MAX_ACCOMMODATIONS]: {
        name: 'Maximum accommodations',
        description: 'Maximum number of accommodations that can be published'
    },
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: {
        name: 'Photos per accommodation',
        description: 'Maximum number of photos per accommodation'
    },
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: {
        name: 'Active promotions',
        description: 'Maximum number of active promotions simultaneously'
    },
    [LimitKey.MAX_FAVORITES]: {
        name: 'Favorites',
        description: 'Maximum number of accommodations saved as favorites'
    },
    [LimitKey.MAX_PROPERTIES]: {
        name: 'Properties',
        description: 'Maximum number of properties in a complex'
    },
    [LimitKey.MAX_STAFF_ACCOUNTS]: {
        name: 'Staff accounts',
        description: 'Maximum number of staff accounts per complex'
    },
    // AI usage limits (SPEC-173)
    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: {
        name: 'AI text improvements per month',
        description: 'Maximum number of AI text improvement requests allowed per calendar month'
    },
    [LimitKey.MAX_AI_CHAT_PER_MONTH]: {
        name: 'AI chat interactions per month',
        description: 'Maximum number of AI chat assistant interactions allowed per calendar month'
    },
    [LimitKey.MAX_AI_SEARCH_PER_MONTH]: {
        name: 'AI search queries per month',
        description: 'Maximum number of AI-powered search queries allowed per calendar month'
    },
    [LimitKey.MAX_AI_SUPPORT_PER_MONTH]: {
        name: 'AI support interactions per month',
        description:
            'Maximum number of AI support assistant interactions allowed per calendar month'
    }
};

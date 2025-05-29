// common/helpers.types.ts

import type { TagType } from '../entities/tag/tag.types.ts';
import type { LifecycleStatusEnum } from '../enums/lifecycle-state.enum.js';
import type { ModerationStatusEnum } from '../enums/state.enum.js';
import type { VisibilityEnum } from '../enums/visibility.enum.js';
import type { AdminInfoType } from './admin.types.js';
import type { UserId } from './id.types.js';
import type { SeoType } from './seo.types.js';

/* ---------------------------------------- */
/*           Helper Composition Types       */
/* ---------------------------------------- */

export type WithAudit = {
    createdAt: Date;
    updatedAt: Date;
    createdById: UserId;
    updatedById: UserId;
    deletedAt?: Date;
    deletedById?: UserId;
};

export type WithReviewState = {
    reviewsCount?: number;
    averageRating?: number;
};

export type WithModerationState = {
    moderationState: ModerationStatusEnum;
};

export type WithLifecycleState = {
    lifecycleState: LifecycleStatusEnum;
};

export type WithVisibility = {
    visibility: VisibilityEnum;
};

export interface WithAdminInfo {
    adminInfo?: AdminInfoType;
}

export interface WithTags {
    tags?: TagType[];
}

export interface WithSeo {
    seo?: SeoType;
}

export type WithRelations<T extends object> = {
    [K in keyof T]?: T[K];
};

/* ---------------------------------------- */
/*         Generic Utility Types            */
/* ---------------------------------------- */

export type With<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type WithOptional<T, K extends keyof T> = T & Partial<Pick<T, K>>;

export type Writable<T> = { -readonly [P in keyof T]: T[P] };

export type NewEntityInput<T extends { id: string; createdAt: Date }> = Omit<
    T,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

export type PartialEntity<T> = Partial<Writable<T>>;

// packages/types/src/entities/post/post.input.types.ts

import type { PostSponsorType } from '@repo/types/entities/post/post.sponsor.types.js';
import type { PostSponsorshipType } from '@repo/types/entities/post/post.sponsorship.types.js';
import type { NewEntityInput, Writable } from '../../../common/helpers.types.js';
import type { PostType } from '../post.types.js';

/**
 * Partial editable structure of a PostType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPost = Partial<Writable<PostType>>;

/**
 * Input structure used to create a new post.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostInput = NewEntityInput<PostType>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 */
export type UpdatePostInput = PartialPost;

/**
 * Partial editable structure of a PostSponsorType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPostSponsor = Partial<Writable<PostSponsorType>>;

/**
 * Input structure used to create a new post sponsor.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostSponsorInput = NewEntityInput<PostSponsorType>;

/**
 * Input structure used to update an existing post sponsor.
 * All fields are optional for partial patching.
 */
export type UpdatePostSponsorInput = PartialPostSponsor;

/**
 * Partial editable structure of a PostSponsorshipType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPostSponsorship = Partial<Writable<PostSponsorshipType>>;

/**
 * Input structure used to create a new post.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostSponsorshipInput = NewEntityInput<PostSponsorshipType>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 */
export type UpdatePostSponsorshipInput = PartialPostSponsorship;

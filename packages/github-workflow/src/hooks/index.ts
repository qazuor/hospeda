/**
 * Git hooks for automated workflow triggers
 *
 * @module hooks
 */

export { runPreCommitHook, type PreCommitOptions } from './pre-commit.js';
export { runPostCommitHook, type PostCommitOptions } from './post-commit.js';

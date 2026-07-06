/**
 * @file userSearchHistory/index.ts
 *
 * Re-exports for the SearchHistoryService (SPEC-289).
 */

export type {
    DeleteOneSearchHistoryInput,
    ListSearchHistoryInput,
    ListSearchHistoryOutput,
    RecordSearchHistoryInput
} from './userSearchHistory.service.js';
export {
    DeleteOneSearchHistoryInputSchema,
    ListSearchHistoryInputSchema,
    RecordSearchHistoryInputSchema,
    SearchHistoryService
} from './userSearchHistory.service.js';

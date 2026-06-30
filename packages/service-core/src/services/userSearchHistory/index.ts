/**
 * @file userSearchHistory/index.ts
 *
 * Re-exports for the SearchHistoryService (SPEC-289).
 */
export {
    SearchHistoryService,
    RecordSearchHistoryInputSchema,
    ListSearchHistoryInputSchema,
    DeleteOneSearchHistoryInputSchema
} from './userSearchHistory.service.js';
export type {
    RecordSearchHistoryInput,
    ListSearchHistoryInput,
    ListSearchHistoryOutput,
    DeleteOneSearchHistoryInput
} from './userSearchHistory.service.js';

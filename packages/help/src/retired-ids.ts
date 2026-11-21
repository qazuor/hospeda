/**
 * @file retired-ids.ts
 * @description Help article ids that were retired and must never be reused
 * (HOS-2410 `docs/data-model.md` §1, R-4). A refusal or an agent may still send
 * an old id (`helpTopicId`), so a new article under it would answer the wrong
 * question. The generator rejects an article whose id is listed here.
 */

/** Retired article ids. Append only. */
export const HELP_RETIRED_IDS: readonly string[] = [];

/**
 * @file owner-review-window.ts
 * @description The page-window cap of the owner review read (HOS-2330), apart
 * from the reader so the tool's input schema can use it without importing the
 * module that touches the database.
 */

/**
 * Most reviews one vertical is asked for when a page is assembled. Pages merge
 * the verticals by date, so page N needs the newest `N * pageSize` rows of each;
 * the review models cap one read at 200.
 */
export const OWNER_REVIEWS_MAX_WINDOW = 200;

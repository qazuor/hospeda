/**
 * Static owner trial length promised by the 24-hour-cached FAQ and features pages,
 * which do not read the database, and used as the fallback by
 * `resolveGenericOwnerTrialDays`. Reading the value from plans is HOS-528.
 */
export const OWNER_TRIAL_DAYS = 30;

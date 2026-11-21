/**
 * The provider watch battery (HOS-1512): engine, guards, catalog and transport.
 *
 * @module battery
 */

export {
    isWatchReference,
    WATCH_REFERENCE_PREFIX
} from './catalog/watch-subjects';
export {
    CLEANUP_CANCEL_LABEL,
    type RunWatchBatteryInput,
    type RunWatchBatteryResult,
    runWatchBattery
} from './run-watch-battery';
export {
    diffMeasurementShapes,
    diffShapes,
    jsonEqual,
    type MeasurementShapeDifference,
    projectForShape,
    shapeOf
} from './shape';
export type {
    JsonValue,
    MeasurementShapes,
    ShapeMap,
    WatchAccount,
    WatchAlert,
    WatchAlertKind,
    WatchAuthorization,
    WatchAuthorizationMiss,
    WatchContext,
    WatchEffect,
    WatchEntry,
    WatchGuardCode,
    WatchMeasurementOutcome,
    WatchMeasurementRecord,
    WatchMethod,
    WatchRequest,
    WatchResponse,
    WatchRunOutcome,
    WatchRunRecord,
    WatchSettings,
    WatchShapeBaseline,
    WatchTransport
} from './types';
export { WATCH_ACCOUNTS, WATCH_EFFECTS, WatchGuardError } from './types';
export {
    REPORTED_ONLY_KEYS,
    rowsOf,
    validateWatchCatalog,
    validateWatchCoverage,
    WATCH_CATALOG,
    WATCHED_BY_HAND,
    type WatchedByHand
} from './watch-catalog';
export {
    assertAccountMatches,
    assertAuthorizationCoversMoneyCatalog,
    assertBudgetMatches,
    assertProductionAuthorized,
    expectedAuthorizationSum,
    marketDayOf,
    marketMonthOf,
    WATCH_TEST_ACCOUNT_TAG
} from './watch-guards';
export { assertHeadersAllowed, WATCH_ALLOWED_HEADERS } from './watch-headers';
export { normalizeRequestPath, WATCH_INTERNAL_ORIGIN } from './watch-path';
export { watchWriteKey } from './watch-send';
export { createWatchTransport } from './watch-transport';

/**
 * The provider watch battery (HOS-1512): engine, guards, catalog and transport.
 *
 * @module battery
 */

export {
    type RunWatchBatteryInput,
    type RunWatchBatteryResult,
    runWatchBattery
} from './run-watch-battery';
export { diffShapes, jsonEqual, shapeOf } from './shape';
export type {
    JsonValue,
    MeasurementShapes,
    ShapeMap,
    WatchAccount,
    WatchAlert,
    WatchAlertKind,
    WatchAuthorization,
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
    WatchShapeBaseline,
    WatchTransport
} from './types';
export { WATCH_ACCOUNTS, WATCH_EFFECTS, WatchGuardError } from './types';
export { validateWatchCatalog, WATCH_CATALOG } from './watch-catalog';
export {
    assertAccountMatches,
    assertBudgetMatches,
    assertProductionAuthorized,
    marketMonthOf,
    WATCH_TEST_ACCOUNT_TAG
} from './watch-guards';
export { createWatchTransport } from './watch-transport';

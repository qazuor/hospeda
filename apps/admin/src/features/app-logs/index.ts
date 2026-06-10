/**
 * App Logs Feature Module (SPEC-184 migration)
 *
 * Barrel exports for application log viewer functionality.
 * The bespoke AppLogsPanel / AppLogFilters / hooks have been replaced by
 * the createEntityListPage framework — see config/app-logs.config.ts.
 */

// Types — canonical types from @repo/schemas (re-exported for convenience)
export type { AppLogEntry, AppLogEntryLevel } from '@repo/schemas';

// Preserved Widget cell components (reused by the framework column config)
export { AppLogLevelBadge } from './components/AppLogLevelBadge';
export { AppLogMessageCell } from './components/AppLogMessageCell';

// Framework-generated page components
export { AppLogsPageComponent, AppLogsRoute, appLogsConfig } from './config/app-logs.config';

/**
 * CLI commands for workflow automation
 *
 * @module commands
 */

export {
    executeSyncCommand,
    type SyncCommandOptions
} from './sync-command.js';

export {
    executeGenerateCommand,
    type GenerateCommandOptions
} from './generate-command.js';

export type { CommandResult } from './types.js';

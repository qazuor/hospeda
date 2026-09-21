import type { ClientCommand } from '../../registry.ts';
import { runGentleStatus } from './gentle-status.ts';

export const gentleStatusCommand: ClientCommand = {
    name: 'gentle-status',
    summary: 'Estado read-only de Gentle-AI, review y telemetría',
    scope: 'local',
    run: (argv) => runGentleStatus({ argv })
};

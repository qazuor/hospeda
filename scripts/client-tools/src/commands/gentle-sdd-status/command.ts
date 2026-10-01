import type { ClientCommand } from '../../registry.ts';
import { runGentleSddStatus } from './gentle-sdd-status.ts';

export const gentleSddStatusCommand: ClientCommand = {
    name: 'gentle-sdd-status',
    summary: 'Estado/routing SDD read-only de Gentle-AI',
    scope: 'local',
    run: (argv) => runGentleSddStatus({ argv })
};

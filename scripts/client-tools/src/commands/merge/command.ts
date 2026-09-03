import type { ClientCommand } from '../../registry.ts';
import { runMerge } from './merge.ts';

/** `hops merge` */
export const mergeCommand: ClientCommand = {
    name: 'merge',
    summary: '¿Se puede mergear el PR de esta branch? (dictamina, no mergea)',
    scope: 'local',
    run: (argv) => runMerge({ argv })
};

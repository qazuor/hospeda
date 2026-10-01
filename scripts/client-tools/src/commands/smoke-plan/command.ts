import type { ClientCommand } from '../../registry.ts';
import { runSmokePlan } from './smoke-plan.ts';

export const smokePlanCommand: ClientCommand = {
    name: 'smoke-plan',
    summary: 'Enumera gates de smoke requeridos por un issue (read-only)',
    scope: 'local',
    run: (argv) => runSmokePlan({ argv })
};

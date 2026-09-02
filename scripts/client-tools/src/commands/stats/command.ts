import type { ClientCommand } from '../../registry.ts';
import { runStats } from './stats.ts';

/** `hops stats` — repository and workflow statistics. */
export const statsCommand: ClientCommand = {
    name: 'stats',
    summary: 'Estadísticas del repo: código, tests, deuda, git, PRs, Linear',
    scope: 'local',
    run: (argv) => runStats({ argv })
};

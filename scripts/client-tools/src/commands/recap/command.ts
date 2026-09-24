import type { ClientCommand } from '../../registry.ts';
import { runRecap } from './recap.ts';

export const recapCommand: ClientCommand = {
    name: 'recap',
    summary: 'Resumen compacto read-only del worktree actual',
    scope: 'local',
    run: (argv) => runRecap({ argv })
};

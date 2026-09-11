import type { ClientCommand } from '../../registry.ts';
import { runWtClean } from './wt-clean.ts';

/** `hops wt-clean` — interactive worktree teardown. */
export const wtCleanCommand: ClientCommand = {
    name: 'wt-clean',
    summary: 'Borrado interactivo de worktrees (servers + DB + worktree + branch)',
    scope: 'local',
    run: (argv) => runWtClean({ argv })
};

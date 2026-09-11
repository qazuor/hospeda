import type { ClientCommand } from '../../registry.ts';
import { runServersDown, runServersUp } from './servers.ts';

/** `hops servers-up` — database + servers for a worktree. */
export const serversUpCommand: ClientCommand = {
    name: 'servers-up',
    summary: 'Levanta DB + servers del worktree (idempotente)',
    scope: 'local',
    run: (argv) => runServersUp({ argv })
};

/** `hops servers-down` — stop the servers, keep everything else. */
export const serversDownCommand: ClientCommand = {
    name: 'servers-down',
    summary: 'Para los servers del worktree (DB y worktree quedan)',
    scope: 'local',
    run: (argv) => runServersDown({ argv })
};

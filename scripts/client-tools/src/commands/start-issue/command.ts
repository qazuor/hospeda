import type { ClientCommand } from '../../registry.ts';
import { runStartIssue } from './start-issue.ts';

/** `hops start-issue` — worktree bootstrap for a Linear issue. */
export const startIssueCommand: ClientCommand = {
    name: 'start-issue',
    summary: 'Crea el worktree de un issue de Linear y abre Claude adentro',
    scope: 'local',
    run: (argv) => runStartIssue({ argv })
};

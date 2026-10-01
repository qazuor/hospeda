import type { ClientCommand } from '../../registry.ts';
import { runCloseIssue } from './close-issue.ts';

export const closeIssueCommand: ClientCommand = {
    name: 'close-issue',
    summary: 'Preflight read-only para cerrar un issue (requiere --plan)',
    scope: 'local',
    run: (argv) => runCloseIssue({ argv })
};

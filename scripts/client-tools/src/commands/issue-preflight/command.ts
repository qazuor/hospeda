import type { ClientCommand } from '../../registry.ts';
import { runIssuePreflight } from './issue-preflight.ts';

export const issuePreflightCommand: ClientCommand = {
    name: 'issue-preflight',
    summary: 'Consulta Linear y recursos de un issue sin mutar nada',
    scope: 'local',
    run: (argv) => runIssuePreflight({ argv })
};

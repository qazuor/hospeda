import type { ClientCommand } from '../../registry.ts';
import { runBranchPlan } from './branch-plan.ts';

export const promoteCommand: ClientCommand = {
    name: 'promote',
    summary: 'Plan read-only de promoción entre ramas',
    scope: 'local',
    run: (argv) => runBranchPlan({ argv, kind: 'promote' })
};

export const backMergeCommand: ClientCommand = {
    name: 'back-merge',
    summary: 'Plan read-only de back-merge entre ramas',
    scope: 'local',
    run: (argv) => runBranchPlan({ argv, kind: 'back-merge' })
};

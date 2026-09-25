import type { ClientCommand } from '../../registry.ts';
import { runDependabotReview } from './dependabot-review.ts';
export const dependabotReviewCommand: ClientCommand = {
    name: 'dependabot-review',
    summary: 'Analiza PRs de Dependabot sin mutar GitHub',
    scope: 'local',
    run: (argv) => runDependabotReview({ argv })
};

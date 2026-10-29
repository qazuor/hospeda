import type { Step5bResult } from './step-5b.service.js';

/** Maps a step 5b result to the process exit code. */
export function step5bExitCode({ status }: { readonly status: Step5bResult['status'] }): 0 | 1 {
    return status === 'completed' || status === 'already_done' || status === 'dry_run' ? 0 : 1;
}

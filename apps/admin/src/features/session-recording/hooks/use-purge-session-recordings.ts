import type { SessionRecordingPurgeRequest, SessionRecordingPurgeResponse } from '@repo/schemas';
import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Path of the manual purge endpoint (HOS-2347 retention). */
export const SESSION_RECORDING_PURGE_PATH = '/api/v1/admin/session-recording/purge';

/**
 * Mutation behind the "Limpiar ahora" button: asks the api to delete the Umami
 * replays, heatmap events and saved pointers older than the retention the admin
 * CONFIRMED. The api refuses with 409 when the stored period no longer matches.
 *
 * Resolves with the counts, the period actually used and whether the time budget
 * stopped it early. A rejection carries the api error: `status` 503 when the
 * Umami database connection is not configured, 409 with `body.error.reason`
 * `RECORDING_RETENTION_MISMATCH` or `RECORDING_PURGE_ALREADY_RUNNING`.
 */
export function usePurgeSessionRecordings() {
    return useMutation({
        mutationFn: async (
            input: SessionRecordingPurgeRequest
        ): Promise<SessionRecordingPurgeResponse> => {
            const response = await fetchApi<{ data: SessionRecordingPurgeResponse }>({
                path: SESSION_RECORDING_PURGE_PATH,
                method: 'POST',
                body: input
            });
            return response.data.data;
        }
    });
}

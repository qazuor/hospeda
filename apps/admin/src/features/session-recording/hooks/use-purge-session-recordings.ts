import type { SessionRecordingPurgeResponse } from '@repo/schemas';
import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Path of the manual purge endpoint (HOS-2347 retention). */
export const SESSION_RECORDING_PURGE_PATH = '/api/v1/admin/session-recording/purge';

/**
 * Mutation behind the "Limpiar ahora" button: asks the api to delete the Umami
 * replays and heatmap events older than the configured retention.
 *
 * Resolves with the counts the api deleted. A rejection carries the api error,
 * whose `status` is 503 when the Umami database connection is not configured.
 */
export function usePurgeSessionRecordings() {
    return useMutation({
        mutationFn: async (): Promise<SessionRecordingPurgeResponse> => {
            const response = await fetchApi<{ data: SessionRecordingPurgeResponse }>({
                path: SESSION_RECORDING_PURGE_PATH,
                method: 'POST'
            });
            return response.data.data;
        }
    });
}

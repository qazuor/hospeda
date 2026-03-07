/**
 * @repo/feedback - useFeedbackSubmit hook.
 *
 * Handles feedback form submission via multipart/form-data and manages
 * loading, error, and success states.
 */
import { useCallback, useState } from 'react';
import type { FeedbackFormData } from '../schemas/feedback.schema.js';

/**
 * Result returned by the API on a successful feedback submission.
 */
export interface FeedbackSubmitResult {
    /** Linear issue ID created for this report, or null if API was unavailable */
    linearIssueId: string | null;
    /** URL to the created Linear issue (if available) */
    linearIssueUrl?: string;
    /** Optional human-readable confirmation message */
    message?: string;
}

/**
 * Current state of the feedback submission process.
 */
export interface FeedbackSubmitState {
    /** True while the network request is in flight */
    isSubmitting: boolean;
    /** Error message if the last submission failed, otherwise null */
    error: string | null;
    /** Result data from the last successful submission, otherwise null */
    result: FeedbackSubmitResult | null;
}

/**
 * Input for `useFeedbackSubmit`.
 */
interface UseFeedbackSubmitInput {
    /** Base URL of the API server (e.g., 'http://localhost:3001') */
    apiUrl: string;
}

/**
 * Handles feedback form submission via multipart/form-data.
 *
 * Builds a `FormData` payload from the validated form values and optional
 * file attachments, posts it to `POST /api/v1/public/feedback`, and manages
 * `isSubmitting`, `error`, and `result` states throughout the lifecycle.
 *
 * Call `reset()` to clear all state (e.g., when reopening the form).
 *
 * @param input - Object containing the API base URL
 * @returns Object with current `state`, `submit` function, and `reset` function
 *
 * @example
 * ```tsx
 * function FeedbackForm() {
 *   const { state, submit, reset } = useFeedbackSubmit({ apiUrl: 'http://localhost:3001' });
 *   const handleSubmit = (data: FeedbackFormData) => submit(data, selectedFiles);
 *   if (state.result) return <SuccessScreen />;
 *   if (state.error) return <ErrorMessage message={state.error} />;
 * }
 * ```
 */
export function useFeedbackSubmit({ apiUrl }: UseFeedbackSubmitInput): {
    state: FeedbackSubmitState;
    submit: (data: FeedbackFormData, attachments?: File[], honeypotValue?: string) => Promise<void>;
    reset: () => void;
} {
    const [state, setState] = useState<FeedbackSubmitState>({
        isSubmitting: false,
        error: null,
        result: null
    });

    const submit = useCallback(
        async (data: FeedbackFormData, attachments?: File[], honeypotValue?: string) => {
            setState({ isSubmitting: true, error: null, result: null });

            try {
                const formData = new FormData();

                // Serialize form fields as a JSON blob under the 'data' key
                formData.append('data', JSON.stringify(data));

                // Honeypot field for bot detection (should be empty for real users)
                if (honeypotValue) {
                    formData.append('website', honeypotValue);
                }

                // Append each file under the shared 'attachments' key
                if (attachments) {
                    for (const file of attachments) {
                        formData.append('attachments', file);
                    }
                }

                const response = await fetch(`${apiUrl}/api/v1/public/feedback`, {
                    method: 'POST',
                    body: formData
                });

                let json: {
                    success: boolean;
                    error?: { message?: string };
                    data?: FeedbackSubmitResult;
                };

                try {
                    json = (await response.json()) as typeof json;
                } catch {
                    setState({
                        isSubmitting: false,
                        error: `Error del servidor (HTTP ${response.status})`,
                        result: null
                    });
                    return;
                }

                if (!response.ok || !json.success) {
                    setState({
                        isSubmitting: false,
                        error: json.error?.message ?? 'Error al enviar el reporte',
                        result: null
                    });
                    return;
                }

                setState({
                    isSubmitting: false,
                    error: null,
                    result: json.data ?? null
                });
            } catch (err) {
                setState({
                    isSubmitting: false,
                    error: err instanceof Error ? err.message : 'Error de conexion',
                    result: null
                });
            }
        },
        [apiUrl]
    );

    const reset = useCallback(() => {
        setState({ isSubmitting: false, error: null, result: null });
    }, []);

    return { state, submit, reset };
}

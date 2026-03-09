/**
 * @repo/feedback - useFeedbackSubmit hook.
 *
 * Handles feedback form submission via multipart/form-data and manages
 * loading, error, and success states.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_STRINGS } from '../config/strings.js';
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
 * Validates that the API URL uses a safe protocol (http or https).
 *
 * @param url - The API URL to validate
 * @returns true if the URL uses http: or https: protocol
 */
function isValidApiUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Serializes an error to a string for JSON payloads.
 * Avoids the `JSON.stringify(error) === '{}'` problem by extracting
 * the message and name properties explicitly.
 *
 * @param err - The caught error value
 * @returns A human-readable error string
 */
function serializeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        const str = JSON.stringify(err);
        return str === '{}' ? String(err) : str;
    } catch {
        return String(err);
    }
}

/**
 * Handles feedback form submission via multipart/form-data.
 *
 * Builds a `FormData` payload from the validated form values and optional
 * file attachments, posts it to `POST /api/v1/public/feedback`, and manages
 * `isSubmitting`, `error`, and `result` states throughout the lifecycle.
 *
 * Uses an AbortController to cancel in-flight requests when the component
 * unmounts, preventing setState on unmounted components.
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

    // AbortController ref to cancel in-flight requests on unmount
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup: abort any pending request when the component unmounts
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const submit = useCallback(
        async (data: FeedbackFormData, attachments?: File[], honeypotValue?: string) => {
            // Validate apiUrl origin before sending data
            if (!isValidApiUrl(apiUrl)) {
                setState({
                    isSubmitting: false,
                    error: 'URL de API invalida',
                    result: null
                });
                return;
            }

            // Abort any previous in-flight request
            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

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
                    body: formData,
                    signal: controller.signal
                });

                // Handle 429 rate limiting specifically
                if (response.status === 429) {
                    setState({
                        isSubmitting: false,
                        error: FEEDBACK_STRINGS.rateLimit.message,
                        result: null
                    });
                    return;
                }

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
                // Do not setState if the request was aborted (component unmounted)
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                setState({
                    isSubmitting: false,
                    error: serializeError(err) || 'Error de conexion',
                    result: null
                });
            }
        },
        [apiUrl]
    );

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        setState({ isSubmitting: false, error: null, result: null });
    }, []);

    return { state, submit, reset };
}

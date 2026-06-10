/**
 * AppLogMessageCell
 *
 * Renders the log message in truncated form with an expand-on-click toggle
 * that reveals the full message and, when present:
 * - request-context fields: requestId, userId, method, path
 * - the `data` payload pretty-printed as JSON.
 */
import { useState } from 'react';

/** Props for AppLogMessageCell */
export interface AppLogMessageCellProps {
    /** The log message text */
    readonly message: string;
    /** Optional structured payload to show when expanded */
    readonly data?: Record<string, unknown> | null;
    /** Correlation ID from the request context (nullable) */
    readonly requestId?: string | null;
    /** Authenticated user ID at the time of the log entry (nullable) */
    readonly userId?: string | null;
    /** HTTP method of the in-flight request (nullable) */
    readonly method?: string | null;
    /** Request path (nullable) */
    readonly path?: string | null;
}

/**
 * Renders a single labeled field in the expanded detail section.
 *
 * @param label - Human-readable field name.
 * @param value - Field value to display.
 * @param testId - data-testid attribute for the value span.
 */
function DetailField({
    label,
    value,
    testId
}: {
    readonly label: string;
    readonly value: string;
    readonly testId: string;
}) {
    return (
        <div className="flex gap-2 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
            <span
                className="break-all font-mono"
                data-testid={testId}
            >
                {value}
            </span>
        </div>
    );
}

/**
 * Renders a truncated log message with an expand toggle.
 * When expanded, shows the full message, any present request-context fields,
 * and the data payload as pretty-printed JSON.
 *
 * @param props - Component props.
 */
export function AppLogMessageCell({
    message,
    data,
    requestId,
    userId,
    method,
    path
}: AppLogMessageCellProps) {
    const [expanded, setExpanded] = useState(false);

    const hasData = data !== null && data !== undefined && Object.keys(data).length > 0;
    const hasRequestContext =
        Boolean(requestId) || Boolean(userId) || Boolean(method) || Boolean(path);

    return (
        <div className="max-w-md space-y-1">
            <button
                type="button"
                className="w-full text-left text-sm"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                data-testid="log-message-toggle"
            >
                {expanded ? (
                    <span
                        className="whitespace-pre-wrap break-words"
                        data-testid="log-message-full"
                    >
                        {message}
                    </span>
                ) : (
                    <span
                        className="line-clamp-2 break-words"
                        data-testid="log-message-preview"
                    >
                        {message}
                    </span>
                )}
            </button>

            {expanded && hasRequestContext && (
                <div
                    className="space-y-0.5 rounded bg-muted/60 px-2 py-1.5"
                    data-testid="log-request-context"
                >
                    {method && (
                        <DetailField
                            label="Method"
                            value={method}
                            testId="log-detail-method"
                        />
                    )}
                    {path && (
                        <DetailField
                            label="Path"
                            value={path}
                            testId="log-detail-path"
                        />
                    )}
                    {requestId && (
                        <DetailField
                            label="Request ID"
                            value={requestId}
                            testId="log-detail-request-id"
                        />
                    )}
                    {userId && (
                        <DetailField
                            label="User ID"
                            value={userId}
                            testId="log-detail-user-id"
                        />
                    )}
                </div>
            )}

            {expanded && hasData && (
                <pre
                    className="overflow-x-auto rounded bg-muted p-2 text-xs"
                    data-testid="log-message-data"
                >
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

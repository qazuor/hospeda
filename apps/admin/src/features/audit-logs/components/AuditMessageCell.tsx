/**
 * AuditMessageCell
 *
 * Renders the audit/security event summary in truncated form with an
 * expand-on-click toggle that reveals the full message and, when present, the
 * `data` payload pretty-printed as JSON.
 */
import { useState } from 'react';

/** Props for AuditMessageCell */
export interface AuditMessageCellProps {
    /** The event summary text */
    readonly message: string;
    /** Optional structured payload to show when expanded */
    readonly data?: Record<string, unknown> | null;
}

/**
 * Renders a truncated event summary with an expand toggle.
 * When expanded, shows the full message and the data payload as pretty JSON.
 *
 * @param props - Component props.
 */
export function AuditMessageCell({ message, data }: AuditMessageCellProps) {
    const [expanded, setExpanded] = useState(false);

    const hasData = data !== null && data !== undefined && Object.keys(data).length > 0;

    return (
        <div className="max-w-md space-y-1">
            <button
                type="button"
                className="w-full text-left text-sm"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                data-testid="audit-message-toggle"
            >
                {expanded ? (
                    <span
                        className="whitespace-pre-wrap break-words"
                        data-testid="audit-message-full"
                    >
                        {message}
                    </span>
                ) : (
                    <span
                        className="line-clamp-2 break-words"
                        data-testid="audit-message-preview"
                    >
                        {message}
                    </span>
                )}
            </button>

            {expanded && hasData && (
                <pre
                    className="overflow-x-auto rounded bg-muted p-2 text-xs"
                    data-testid="audit-message-data"
                >
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

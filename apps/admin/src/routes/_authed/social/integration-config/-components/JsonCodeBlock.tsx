/**
 * @file JsonCodeBlock.tsx
 * @description Pretty-printed read-only JSON code block (HOS-67 G-6, T-008).
 *
 * Shared by both Integration Config Export panels to render the OpenAPI
 * document / JSON Schemas as scrollable, monospace, pretty-printed JSON.
 */

/** Props for {@link JsonCodeBlock}. */
export interface JsonCodeBlockProps {
    /** The JSON-serializable value to pretty-print. */
    readonly data: unknown;
    /** `data-testid` for the `<pre>` element. */
    readonly testId?: string;
    /** Tailwind max-height utility class (default `max-h-96`). */
    readonly maxHeightClassName?: string;
}

/** Renders `data` as a scrollable, pretty-printed, read-only JSON block. */
export function JsonCodeBlock({
    data,
    testId,
    maxHeightClassName = 'max-h-96'
}: JsonCodeBlockProps) {
    const json = JSON.stringify(data, null, 2);

    return (
        <pre
            className={`overflow-auto rounded-md border bg-muted p-4 font-mono text-xs ${maxHeightClassName}`}
            data-testid={testId}
        >
            <code>{json}</code>
        </pre>
    );
}

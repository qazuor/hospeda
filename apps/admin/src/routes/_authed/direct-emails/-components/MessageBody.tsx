/**
 * @file MessageBody.tsx
 * @description Read-only view of a saved TipTap body (HOS-2685 detail page).
 * Reuses the shared editor in disabled mode so the saved document renders with
 * the same schema the admin wrote it with (no dynamic blocks).
 */

import type { TiptapDocument } from '@repo/utils';
import { RichTextEditor } from '@/components/newsletter/RichTextEditor';

/** Props for MessageBody. */
export interface MessageBodyProps {
    readonly bodyJson: unknown;
}

const NOOP = (): void => undefined;

/**
 * Read-only body.
 *
 * @param props - MessageBodyProps
 */
export function MessageBody({ bodyJson }: MessageBodyProps) {
    return (
        <RichTextEditor
            value={bodyJson as TiptapDocument}
            onChange={NOOP}
            disabled
            enableDynamicBlocks={false}
        />
    );
}

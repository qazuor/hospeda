/**
 * @file AiAssistantsNavReveal.client.tsx
 * @description Renders nothing. Un-hides the server-rendered "Asistentes de IA"
 * sidebar item when the user has connections while the MCP feature is off
 * (HOS-2184 T-028).
 *
 * The item is server-rendered with the `hidden` attribute so it keeps the
 * layout's scoped styles and the page stays session-blind. Hydration:
 * `client:idle`.
 */

import { useEffect } from 'react';
import { useAiAssistantsEntry } from '@/hooks/use-ai-assistants-entry';

/** Attribute that marks the item this island reveals. */
export const AI_ASSISTANTS_NAV_ITEM_ATTR = 'data-ai-assistants-entry';

/**
 * @example
 * ```astro
 * <li data-ai-assistants-entry hidden>...</li>
 * <AiAssistantsNavReveal client:idle />
 * ```
 */
export function AiAssistantsNavReveal(): null {
    const visible = useAiAssistantsEntry({ mcpEnabled: false, enabled: true });

    useEffect(() => {
        const item = document.querySelector<HTMLElement>(`[${AI_ASSISTANTS_NAV_ITEM_ATTR}]`);
        if (item) {
            item.hidden = !visible;
        }
    }, [visible]);

    return null;
}

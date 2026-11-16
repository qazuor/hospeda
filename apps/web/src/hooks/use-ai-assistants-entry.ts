/**
 * @file use-ai-assistants-entry.ts
 * @description Whether the "Asistentes de IA" account entry should show
 * (HOS-2184 T-028). Shared by the avatar menu, the mobile menu and the sidebar
 * reveal island so the three can never disagree.
 *
 * Rule: feature on, show it. Feature off or unknown, show it only when the
 * user has at least one connection (so they can disconnect). A failed lookup
 * hides it.
 */

import { useEffect, useState } from 'react';
import { getAiConnectionCount } from '@/lib/ai-connections-count';

/** Input of {@link useAiAssistantsEntry}. */
export interface UseAiAssistantsEntryParams {
    /**
     * Whether the MCP feature is on, as known by the server that mounted the
     * island. Omit it when unknown: the connection-count rule applies.
     */
    readonly mcpEnabled?: boolean;
    /** Only look up connections for a signed-in user. */
    readonly enabled: boolean;
}

/**
 * @param params - Flag hint and whether a user is signed in.
 * @returns `true` when the entry should be rendered.
 */
export function useAiAssistantsEntry({ mcpEnabled, enabled }: UseAiAssistantsEntryParams): boolean {
    const [hasConnections, setHasConnections] = useState(false);
    const needsLookup = enabled && mcpEnabled !== true;

    useEffect(() => {
        if (!needsLookup) {
            return;
        }
        let active = true;
        void getAiConnectionCount().then((count) => {
            if (active) {
                setHasConnections(count > 0);
            }
        });
        return () => {
            active = false;
        };
    }, [needsLookup]);

    if (!enabled) {
        return false;
    }
    return mcpEnabled === true || hasConnections;
}

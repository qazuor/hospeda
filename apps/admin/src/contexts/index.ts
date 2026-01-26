/**
 * React Contexts
 *
 * This module exports all React contexts used in the admin application.
 */

// Auth context
export { AuthContext, AuthProvider } from './auth-context';
export type { AuthContextValue } from './auth-context';

// Sidebar context
export {
    SidebarContext,
    SidebarProvider,
    useIsSidebarContextual,
    useSetSidebarConfig,
    useSidebarConfig,
    useSidebarContext
} from './sidebar-context';

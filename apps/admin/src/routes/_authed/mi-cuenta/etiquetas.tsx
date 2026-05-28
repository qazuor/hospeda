import { OwnTagManager } from '@/components/tags/OwnTagManager';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/mi-cuenta/etiquetas')({
    component: MyTagsPage
});

/**
 * "Mis Etiquetas" page — own USER tag manager accessible from the user account
 * area. Gated by admin panel authentication only (no special permission required
 * beyond being logged in). Any admin-panel user can manage their own personal
 * USER tags.
 *
 * @see OwnTagManager, AC-003-01..04, D-022, D-024, US-003
 * @see SPEC-086 T-032
 */
function MyTagsPage() {
    return (
        <div className="p-6">
            <OwnTagManager />
        </div>
    );
}

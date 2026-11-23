/**
 * AllianceApplicationsList — the caller's own alliance applications as a kit
 * `DataList` (HOS-2502, HOS-278 AC-14).
 *
 * Rendered on the server inside `AllianceApplicationsSection.astro` (no island).
 * Each row says the program, the submission date and the real state in words:
 * `pending` and `reviewing` share one tone because, to the applicant, they are
 * the same answer (we have it, we have not decided).
 *
 * @module components/account/AllianceApplicationsList
 */

import { DataList, ListRow, StatusPill, type StatusTone } from '@/components/account/ui';

/** Status of an application, as the API sends it. */
export type AllianceLeadStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

/** Tone of each application status. */
export const ALLIANCE_STATUS_TONE: Readonly<Record<AllianceLeadStatus, StatusTone>> = {
    pending: 'info',
    reviewing: 'info',
    approved: 'success',
    rejected: 'neutral'
};

/** One row, already translated and formatted by the page. */
export interface AllianceApplicationRow {
    /** Stable id of the application. */
    readonly id: string;
    /** Program name («Partner», «Sponsor»…). */
    readonly program: string;
    /** «Enviada el 3 de noviembre de 2026». */
    readonly submittedOn: string;
    /** Status wire value. */
    readonly status: AllianceLeadStatus;
    /** Translated status word. */
    readonly statusLabel: string;
}

/** Props of {@link AllianceApplicationsList}. */
export interface AllianceApplicationsListProps {
    /** Translated accessible name of the list. */
    readonly label: string;
    /** The applications, newest first. */
    readonly rows: readonly AllianceApplicationRow[];
}

/**
 * The applications list.
 *
 * @param props - See {@link AllianceApplicationsListProps}.
 * @returns A `DataList` with one `ListRow` per application.
 */
export function AllianceApplicationsList({ label, rows }: AllianceApplicationsListProps) {
    return (
        <DataList label={label}>
            {rows.map((row) => (
                <ListRow
                    key={row.id}
                    rowId={row.id}
                    title={row.program}
                    meta={row.submittedOn}
                    trailing={
                        <span data-status={row.status}>
                            <StatusPill tone={ALLIANCE_STATUS_TONE[row.status]}>
                                {row.statusLabel}
                            </StatusPill>
                        </span>
                    }
                />
            ))}
        </DataList>
    );
}

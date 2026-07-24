/**
 * AllianceLeadInbox
 *
 * Admin inbox for alliance leads (HOS-277 §6.4).
 *
 * Features:
 *  - Paginated table of leads (kind, contactName, email, status badge, createdAt).
 *  - Kind filter (all / partner / sponsor / editor / service_provider).
 *  - Status filter (all / pending / reviewing / approved / rejected).
 *  - Per-row "Handle" dialog: approve/reject radio + optional admin note.
 *
 * Deliberately has NO "Approve & provision" action (unlike `CommerceLeadInbox`,
 * its clone source): provisioning the corresponding partner/sponsor/editor/
 * HostTrade entry is a MANUAL admin step in V1 (HOS-277 §6.4 / NG-1). Only the
 * "Handle" action (approve/reject + note) exists here.
 *
 * Gate: ALLIANCE_LEAD_VIEW_ALL (read) / ALLIANCE_LEAD_MANAGE (handle).
 *
 * @module features/alliance-leads/components/AllianceLeadInbox
 */

import type { AllianceLead, AllianceLeadKind } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import {
    type AllianceLeadsQueryParams,
    useAllianceLeadsQuery,
    useMarkAllianceLeadHandledMutation
} from '../hooks/useAllianceLeads';
import { AllianceLeadStatusBadge } from './AllianceLeadStatusBadge';

// ---------------------------------------------------------------------------
// Handle dialog
// ---------------------------------------------------------------------------

type HandleDialogProps = {
    readonly lead: AllianceLead;
    readonly onClose: () => void;
};

/**
 * Modal dialog to approve or reject an alliance lead.
 * Uses HTML radio buttons (no RadioGroup dependency) + a Textarea for the note.
 */
function HandleDialog({ lead, onClose }: HandleDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useMarkAllianceLeadHandledMutation();

    const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
    const [adminNote, setAdminNote] = useState('');

    const handleSubmit = async () => {
        const result = await mutation.mutateAsync({
            id: lead.id,
            status: decision,
            adminNote: adminNote.trim() || undefined
        });

        const isApproved = result.status === 'approved';
        addToast({
            variant: isApproved ? 'success' : 'default',
            message: t(
                isApproved
                    ? 'admin-entities.allianceLeads.handle.successApproved'
                    : 'admin-entities.allianceLeads.handle.successRejected'
            )
        });

        onClose();
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('admin-entities.allianceLeads.handle.title')}</DialogTitle>
                <DialogDescription>
                    {lead.contactName} — {lead.email}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
                {/* Decision radio */}
                <fieldset className="space-y-2">
                    <legend className="font-medium text-sm">
                        {t('admin-entities.allianceLeads.handle.decisionLabel')}
                    </legend>
                    <div className="flex gap-6">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="radio"
                                name="decision"
                                value="approved"
                                checked={decision === 'approved'}
                                onChange={() => setDecision('approved')}
                                className="accent-primary"
                            />
                            <span className="text-sm">
                                {t('admin-entities.allianceLeads.handle.approve')}
                            </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="radio"
                                name="decision"
                                value="rejected"
                                checked={decision === 'rejected'}
                                onChange={() => setDecision('rejected')}
                                className="accent-primary"
                            />
                            <span className="text-sm">
                                {t('admin-entities.allianceLeads.handle.reject')}
                            </span>
                        </label>
                    </div>
                </fieldset>

                {/* Admin note */}
                <div className="space-y-1">
                    <Label htmlFor="admin-note">
                        {t('admin-entities.allianceLeads.handle.noteLabel')}
                    </Label>
                    <Textarea
                        id="admin-note"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder={t('admin-entities.allianceLeads.handle.notePlaceholder')}
                        rows={3}
                        maxLength={1000}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={mutation.isPending}
                >
                    {t('admin-entities.actions.cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={mutation.isPending}
                >
                    {mutation.isPending
                        ? t('admin-entities.allianceLeads.handle.submitting')
                        : t('admin-entities.allianceLeads.handle.submit')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

type RowActionsProps = {
    readonly lead: AllianceLead;
};

/**
 * Renders the per-row "Handle" action button. No "Provision owner" or
 * "Approve & provision" buttons exist here — see the module-level JSDoc.
 */
function RowActions({ lead }: RowActionsProps) {
    const { t } = useTranslations();
    const [handleOpen, setHandleOpen] = useState(false);

    const isHandled = lead.status === 'approved' || lead.status === 'rejected';

    return (
        <div className="flex items-center gap-2">
            <Dialog
                open={handleOpen}
                onOpenChange={setHandleOpen}
            >
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        variant={isHandled ? 'outline' : 'default'}
                    >
                        {t('admin-entities.allianceLeads.actions.handle')}
                    </Button>
                </DialogTrigger>
                {handleOpen && (
                    <HandleDialog
                        lead={lead}
                        onClose={() => setHandleOpen(false)}
                    />
                )}
            </Dialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main inbox component
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
    { value: '', label: 'admin-entities.allianceLeads.filter.allStatuses' },
    { value: 'pending', label: 'admin-entities.allianceLeads.status.pending' },
    { value: 'reviewing', label: 'admin-entities.allianceLeads.status.reviewing' },
    { value: 'approved', label: 'admin-entities.allianceLeads.status.approved' },
    { value: 'rejected', label: 'admin-entities.allianceLeads.status.rejected' }
] as const;

const KIND_OPTIONS = [
    { value: '', label: 'admin-entities.allianceLeads.filter.allKinds' },
    { value: 'partner', label: 'admin-entities.allianceLeads.kind.partner' },
    { value: 'sponsor', label: 'admin-entities.allianceLeads.kind.sponsor' },
    { value: 'editor', label: 'admin-entities.allianceLeads.kind.editor' },
    { value: 'service_provider', label: 'admin-entities.allianceLeads.kind.service_provider' }
] as const;

const KIND_LABEL_KEYS: Record<AllianceLeadKind, string> = {
    partner: 'admin-entities.allianceLeads.kind.partner',
    sponsor: 'admin-entities.allianceLeads.kind.sponsor',
    editor: 'admin-entities.allianceLeads.kind.editor',
    service_provider: 'admin-entities.allianceLeads.kind.service_provider'
};

const PAGE_SIZE = 20;

/**
 * Alliance Lead Inbox — admin UI for managing alliance lead submissions
 * (partner / sponsor / editor / service_provider).
 *
 * Renders a filterable (by kind and status), paginated table of alliance
 * leads with a per-row handle action. Data is fetched via TanStack Query.
 *
 * @example
 * ```tsx
 * <AllianceLeadInbox />
 * ```
 */
export function AllianceLeadInbox() {
    const { t } = useTranslations();

    const [statusFilter, setStatusFilter] = useState('');
    const [kindFilter, setKindFilter] = useState('');
    const [page, setPage] = useState(1);

    const queryParams: AllianceLeadsQueryParams = {
        page,
        pageSize: PAGE_SIZE,
        status: (statusFilter || undefined) as AllianceLeadsQueryParams['status'],
        kind: (kindFilter || undefined) as AllianceLeadsQueryParams['kind']
    };

    const { data, isLoading, isError } = useAllianceLeadsQuery(queryParams);

    const handleStatusChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        setPage(1);
    };

    const handleKindChange = (newKind: string) => {
        setKindFilter(newKind);
        setPage(1);
    };

    return (
        <div className="space-y-4">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <h1 className="font-semibold text-2xl">
                    {t('admin-entities.allianceLeads.page.title')}
                </h1>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="kind-filter"
                        className="shrink-0 font-medium text-sm"
                    >
                        {t('admin-entities.allianceLeads.filter.kindLabel')}
                    </Label>
                    <select
                        id="kind-filter"
                        value={kindFilter}
                        onChange={(e) => handleKindChange(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {KIND_OPTIONS.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                            >
                                {t(opt.label as Parameters<typeof t>[0])}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="status-filter"
                        className="shrink-0 font-medium text-sm"
                    >
                        {t('admin-entities.allianceLeads.filter.statusLabel')}
                    </Label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                            >
                                {t(opt.label as Parameters<typeof t>[0])}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            {isLoading && (
                <p className="py-8 text-center text-muted-foreground text-sm">
                    {t('admin-common.states.loading')}
                </p>
            )}

            {isError && (
                <p className="py-8 text-center text-destructive text-sm">
                    {t('admin-entities.allianceLeads.page.loadError')}
                </p>
            )}

            {!isLoading && !isError && data && (
                <>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.kind')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.contactName')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.email')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.status')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.createdAt')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.allianceLeads.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-8 text-center text-muted-foreground"
                                        >
                                            {t('admin-entities.allianceLeads.page.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    data.items.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            className="border-b last:border-0 hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3 font-medium">
                                                {t(
                                                    KIND_LABEL_KEYS[lead.kind] as Parameters<
                                                        typeof t
                                                    >[0]
                                                )}
                                            </td>
                                            <td className="px-4 py-3">{lead.contactName}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {lead.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <AllianceLeadStatusBadge status={lead.status} />
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {lead.createdAt
                                                    ? new Date(lead.createdAt).toLocaleDateString(
                                                          'es-AR'
                                                      )
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <RowActions lead={lead} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-entities.allianceLeads.pagination.info', {
                                    page: String(data.pagination.page),
                                    totalPages: String(data.pagination.totalPages),
                                    total: String(data.pagination.total)
                                })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    {t('admin-entities.allianceLeads.pagination.prev')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={page >= data.pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    {t('admin-entities.allianceLeads.pagination.next')}
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

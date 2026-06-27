/**
 * CommerceLeadInbox
 *
 * Admin inbox for commerce leads (SPEC-239 T-058).
 *
 * Features:
 *  - Paginated table of leads (businessName, contactName, email, domain,
 *    status badge, createdAt).
 *  - Status filter (all / pending / reviewing / approved / rejected).
 *  - Per-row "Handle" dialog: approve/reject radio + optional admin note.
 *  - Per-row "Provision owner" confirm dialog: creates COMMERCE_OWNER account
 *    and emails temp credentials.  Success toast shows {name, email} — NEVER
 *    a password.
 *
 * Gate: COMMERCE_VIEW_ALL (read) / COMMERCE_EDIT_ALL (handle + provision).
 *
 * @module features/commerce-leads/components/CommerceLeadInbox
 */

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
import type { CommerceLead } from '@repo/schemas';
import { useState } from 'react';
import {
    type CommerceLeadsQueryParams,
    useApproveAndProvisionMutation,
    useCommerceLeadsQuery,
    useMarkLeadHandledMutation,
    useProvisionOwnerMutation
} from '../hooks/useCommerceLeads';
import { CommerceLeadStatusBadge } from './CommerceLeadStatusBadge';

// ---------------------------------------------------------------------------
// Handle dialog
// ---------------------------------------------------------------------------

type HandleDialogProps = {
    readonly lead: CommerceLead;
    readonly onClose: () => void;
};

/**
 * Modal dialog to approve or reject a commerce lead.
 * Uses HTML radio buttons (no RadioGroup dependency) + a Textarea for the note.
 */
function HandleDialog({ lead, onClose }: HandleDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useMarkLeadHandledMutation();

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
                    ? 'admin-entities.commerceLeads.handle.successApproved'
                    : 'admin-entities.commerceLeads.handle.successRejected'
            )
        });

        onClose();
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('admin-entities.commerceLeads.handle.title')}</DialogTitle>
                <DialogDescription>
                    {lead.businessName} — {lead.contactName}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
                {/* Decision radio */}
                <fieldset className="space-y-2">
                    <legend className="font-medium text-sm">
                        {t('admin-entities.commerceLeads.handle.decisionLabel')}
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
                                {t('admin-entities.commerceLeads.handle.approve')}
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
                                {t('admin-entities.commerceLeads.handle.reject')}
                            </span>
                        </label>
                    </div>
                </fieldset>

                {/* Admin note */}
                <div className="space-y-1">
                    <Label htmlFor="admin-note">
                        {t('admin-entities.commerceLeads.handle.noteLabel')}
                    </Label>
                    <Textarea
                        id="admin-note"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder={t('admin-entities.commerceLeads.handle.notePlaceholder')}
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
                        ? t('admin-entities.commerceLeads.handle.submitting')
                        : t('admin-entities.commerceLeads.handle.submit')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// ---------------------------------------------------------------------------
// Provision owner dialog
// ---------------------------------------------------------------------------

type ProvisionDialogProps = {
    readonly lead: CommerceLead;
    readonly onClose: () => void;
};

/**
 * Confirmation dialog to provision a COMMERCE_OWNER account for a lead.
 * On success shows the returned {name, email} in a toast — NEVER a password.
 */
function ProvisionDialog({ lead, onClose }: ProvisionDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useProvisionOwnerMutation();

    const handleProvision = async () => {
        const result = await mutation.mutateAsync(lead.id);

        addToast({
            variant: 'success',
            message: t('admin-entities.commerceLeads.provision.successMessage', {
                name: result.name,
                email: result.email
            })
        });

        onClose();
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('admin-entities.commerceLeads.provision.title')}</DialogTitle>
                <DialogDescription>
                    {t('admin-entities.commerceLeads.provision.description', {
                        businessName: lead.businessName,
                        email: lead.email
                    })}
                </DialogDescription>
            </DialogHeader>

            {mutation.isError && (
                <p className="text-destructive text-sm">
                    {t('admin-entities.commerceLeads.provision.error')}
                </p>
            )}

            <DialogFooter>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={mutation.isPending}
                >
                    {t('admin-entities.actions.cancel')}
                </Button>
                <Button
                    onClick={handleProvision}
                    disabled={mutation.isPending}
                >
                    {mutation.isPending
                        ? t('admin-entities.commerceLeads.provision.submitting')
                        : t('admin-entities.commerceLeads.provision.confirm')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// ---------------------------------------------------------------------------
// Approve & provision dialog (SPEC-249 Part D)
// ---------------------------------------------------------------------------

type ApproveProvisionDialogProps = {
    readonly lead: CommerceLead;
    readonly onClose: () => void;
};

/**
 * Combined "Approve & provision" confirmation dialog. Approves the lead AND
 * creates its COMMERCE_OWNER account in a single action. Optional admin note.
 * Server-side idempotent via `lead.provisionedUserId`.
 */
function ApproveProvisionDialog({ lead, onClose }: ApproveProvisionDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useApproveAndProvisionMutation();

    const [adminNote, setAdminNote] = useState('');

    const handleConfirm = async () => {
        const result = await mutation.mutateAsync({
            id: lead.id,
            adminNote: adminNote.trim() || undefined
        });

        addToast({
            variant: 'success',
            message: result.provisioned
                ? t('admin-entities.commerceLeads.approveProvision.successMessage', {
                      email: lead.email
                  })
                : t('admin-entities.commerceLeads.approveProvision.alreadyProvisionedMessage')
        });

        onClose();
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {t('admin-entities.commerceLeads.approveProvision.title')}
                </DialogTitle>
                <DialogDescription>
                    {t('admin-entities.commerceLeads.approveProvision.description', {
                        businessName: lead.businessName,
                        email: lead.email
                    })}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-1 py-2">
                <Label htmlFor="approve-provision-note">
                    {t('admin-entities.commerceLeads.approveProvision.noteLabel')}
                </Label>
                <Textarea
                    id="approve-provision-note"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder={t('admin-entities.commerceLeads.approveProvision.notePlaceholder')}
                    rows={3}
                    maxLength={1000}
                />
            </div>

            {mutation.isError && (
                <p className="text-destructive text-sm">
                    {t('admin-entities.commerceLeads.approveProvision.error')}
                </p>
            )}

            <DialogFooter>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={mutation.isPending}
                >
                    {t('admin-entities.actions.cancel')}
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={mutation.isPending}
                >
                    {mutation.isPending
                        ? t('admin-entities.commerceLeads.approveProvision.submitting')
                        : t('admin-entities.commerceLeads.approveProvision.confirm')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

type RowActionsProps = {
    readonly lead: CommerceLead;
};

/**
 * Renders the per-row "Handle" and (optionally) "Provision owner" action buttons.
 * Each action opens a Shadcn Dialog.
 */
function RowActions({ lead }: RowActionsProps) {
    const { t } = useTranslations();
    const [handleOpen, setHandleOpen] = useState(false);
    const [provisionOpen, setProvisionOpen] = useState(false);
    const [approveProvisionOpen, setApproveProvisionOpen] = useState(false);

    const isHandled = lead.status === 'approved' || lead.status === 'rejected';
    const isAlreadyProvisioned = lead.provisionedUserId != null;

    return (
        <div className="flex items-center gap-2">
            {/* Handle dialog */}
            <Dialog
                open={handleOpen}
                onOpenChange={setHandleOpen}
            >
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        variant={isHandled ? 'outline' : 'default'}
                    >
                        {t('admin-entities.commerceLeads.actions.handle')}
                    </Button>
                </DialogTrigger>
                {handleOpen && (
                    <HandleDialog
                        lead={lead}
                        onClose={() => setHandleOpen(false)}
                    />
                )}
            </Dialog>

            {/* Combined "Approve & provision" — only for leads not yet handled */}
            {!isHandled && (
                <Dialog
                    open={approveProvisionOpen}
                    onOpenChange={setApproveProvisionOpen}
                >
                    <DialogTrigger asChild>
                        <Button size="sm">
                            {t('admin-entities.commerceLeads.actions.approveProvision')}
                        </Button>
                    </DialogTrigger>
                    {approveProvisionOpen && (
                        <ApproveProvisionDialog
                            lead={lead}
                            onClose={() => setApproveProvisionOpen(false)}
                        />
                    )}
                </Dialog>
            )}

            {/* Provision dialog — only show when approved and not yet provisioned */}
            {lead.status === 'approved' && !isAlreadyProvisioned && (
                <Dialog
                    open={provisionOpen}
                    onOpenChange={setProvisionOpen}
                >
                    <DialogTrigger asChild>
                        <Button
                            size="sm"
                            variant="secondary"
                        >
                            {t('admin-entities.commerceLeads.actions.provision')}
                        </Button>
                    </DialogTrigger>
                    {provisionOpen && (
                        <ProvisionDialog
                            lead={lead}
                            onClose={() => setProvisionOpen(false)}
                        />
                    )}
                </Dialog>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main inbox component
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
    { value: '', label: 'admin-entities.commerceLeads.filter.all' },
    { value: 'pending', label: 'admin-entities.commerceLeads.status.pending' },
    { value: 'reviewing', label: 'admin-entities.commerceLeads.status.reviewing' },
    { value: 'approved', label: 'admin-entities.commerceLeads.status.approved' },
    { value: 'rejected', label: 'admin-entities.commerceLeads.status.rejected' }
] as const;

const PAGE_SIZE = 20;

/**
 * Commerce Lead Inbox — admin UI for managing commerce lead submissions.
 *
 * Renders a filterable, paginated table of commerce leads with per-row
 * handle and provision-owner actions.  Data is fetched via TanStack Query.
 *
 * @example
 * ```tsx
 * <CommerceLeadInbox />
 * ```
 */
export function CommerceLeadInbox() {
    const { t } = useTranslations();

    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const queryParams: CommerceLeadsQueryParams = {
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        domain: undefined
    };

    const { data, isLoading, isError } = useCommerceLeadsQuery(queryParams);

    const handleStatusChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        setPage(1);
    };

    return (
        <div className="space-y-4">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <h1 className="font-semibold text-2xl">
                    {t('admin-entities.commerceLeads.page.title')}
                </h1>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
                <Label
                    htmlFor="status-filter"
                    className="shrink-0 font-medium text-sm"
                >
                    {t('admin-entities.commerceLeads.filter.label')}
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

            {/* Table */}
            {isLoading && (
                <p className="py-8 text-center text-muted-foreground text-sm">
                    {t('admin-common.states.loading')}
                </p>
            )}

            {isError && (
                <p className="py-8 text-center text-destructive text-sm">
                    {t('admin-entities.commerceLeads.page.loadError')}
                </p>
            )}

            {!isLoading && !isError && data && (
                <>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.businessName')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.contactName')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.email')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.domain')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.status')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.createdAt')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-entities.commerceLeads.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-8 text-center text-muted-foreground"
                                        >
                                            {t('admin-entities.commerceLeads.page.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    data.items.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            className="border-b last:border-0 hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3 font-medium">
                                                {lead.businessName}
                                            </td>
                                            <td className="px-4 py-3">{lead.contactName}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {lead.email}
                                            </td>
                                            <td className="px-4 py-3 capitalize">{lead.domain}</td>
                                            <td className="px-4 py-3">
                                                <CommerceLeadStatusBadge status={lead.status} />
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
                                {t('admin-entities.commerceLeads.pagination.info', {
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
                                    {t('admin-entities.commerceLeads.pagination.prev')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={page >= data.pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    {t('admin-entities.commerceLeads.pagination.next')}
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

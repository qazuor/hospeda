/**
 * PermissionPicker (SPEC-170)
 *
 * Searchable, category-grouped dialog for adding a per-user permission override.
 * Each permission shows one of four states:
 *  - grantable           → "Grant" action (creates a grant override)
 *  - inherited from role  → "Deny" action (creates a deny override) + badge
 *  - grant override       → "Granted" badge (manage/remove from the card)
 *  - deny override        → "Denied" badge (manage/remove from the card)
 *
 * Broad/sensitive permissions (`*ViewAll`, `*ReadAll`, `*hardDelete`) carry a
 * warning icon so the admin double-checks before granting (R-1).
 */
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { AddIcon, AlertTriangleIcon } from '@repo/icons';
import {
    type PermissionCategoryEnum,
    type PermissionEffect,
    PermissionEffectEnum,
    type PermissionEnum,
    getPermissionsByCategory
} from '@repo/schemas';

export interface PermissionPickerProps {
    readonly fromRole: readonly PermissionEnum[];
    readonly grantOverrides: readonly PermissionEnum[];
    readonly denyOverrides: readonly PermissionEnum[];
    readonly onAssign: (input: { permission: PermissionEnum; effect: PermissionEffect }) => void;
    readonly isAssigning?: boolean;
}

/** Broad-scope permissions that warrant a "double-check" warning before granting. */
const SENSITIVE_RE = /(viewall|readall|harddelete|view\.all|read\.all|hard\.delete)/i;

const isSensitive = (permission: string): boolean => SENSITIVE_RE.test(permission);

type PermissionState = 'grantable' | 'inherited' | 'grant' | 'deny';

export function PermissionPicker({
    fromRole,
    grantOverrides,
    denyOverrides,
    onAssign,
    isAssigning = false
}: PermissionPickerProps) {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);

    const byCategory = useMemo(() => getPermissionsByCategory(), []);

    const stateOf = useMemo(() => {
        const roleSet = new Set(fromRole);
        const grantSet = new Set(grantOverrides);
        const denySet = new Set(denyOverrides);
        return (permission: PermissionEnum): PermissionState => {
            if (grantSet.has(permission)) return 'grant';
            if (denySet.has(permission)) return 'deny';
            if (roleSet.has(permission)) return 'inherited';
            return 'grantable';
        };
    }, [fromRole, grantOverrides, denyOverrides]);

    const categoryLabel = (category: PermissionCategoryEnum): string => {
        const key = `admin-pages.access.permissions.categories.${category}` as TranslationKey;
        const label = t(key);
        // Fall back to the raw category when no label is defined.
        return label.startsWith('[MISSING') || label === key ? category : label;
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                >
                    <AddIcon className="mr-1.5 h-4 w-4" />
                    {t('admin-pages.access.users.permissions.addOverride')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-pages.access.users.permissions.addOverride')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-pages.access.users.permissions.changesTakeEffectNextRequest')}
                    </DialogDescription>
                </DialogHeader>

                <Command className="rounded-md border">
                    <CommandInput
                        placeholder={t('admin-pages.access.users.permissions.searchPermissions')}
                    />
                    <CommandList className="max-h-[50vh]">
                        <CommandEmpty>—</CommandEmpty>
                        {[...byCategory.entries()].map(([category, permissions]) => (
                            <CommandGroup
                                key={category}
                                heading={categoryLabel(category)}
                            >
                                {permissions.map((permission) => {
                                    const state = stateOf(permission);
                                    const sensitive = isSensitive(permission);
                                    return (
                                        <CommandItem
                                            key={permission}
                                            value={permission}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                                                {sensitive && (
                                                    <AlertTriangleIcon
                                                        className="h-3.5 w-3.5 shrink-0 text-warning"
                                                        aria-label={t(
                                                            'admin-pages.access.users.permissions.sensitivePermissionWarning'
                                                        )}
                                                    />
                                                )}
                                                <span className="truncate">{permission}</span>
                                            </span>
                                            <PermissionAction
                                                state={state}
                                                disabled={isAssigning}
                                                onGrant={() =>
                                                    onAssign({
                                                        permission,
                                                        effect: PermissionEffectEnum.GRANT
                                                    })
                                                }
                                                onDeny={() =>
                                                    onAssign({
                                                        permission,
                                                        effect: PermissionEffectEnum.DENY
                                                    })
                                                }
                                            />
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}

function PermissionAction({
    state,
    disabled,
    onGrant,
    onDeny
}: {
    readonly state: PermissionState;
    readonly disabled: boolean;
    readonly onGrant: () => void;
    readonly onDeny: () => void;
}) {
    const { t } = useTranslations();

    if (state === 'grant') {
        return (
            <Badge
                variant="outline"
                className="border-emerald-600/30 text-emerald-700 dark:text-emerald-400"
            >
                {t('admin-pages.access.users.permissions.effectGrant')}
            </Badge>
        );
    }
    if (state === 'deny') {
        return (
            <Badge variant="destructive">
                {t('admin-pages.access.users.permissions.effectDeny')}
            </Badge>
        );
    }
    if (state === 'inherited') {
        return (
            <div className="flex shrink-0 items-center gap-2">
                <Badge
                    variant="outline"
                    className="text-muted-foreground"
                >
                    {t('admin-pages.access.users.permissions.inheritedFromRole')}
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="text-destructive"
                    onClick={onDeny}
                >
                    {t('admin-pages.access.users.permissions.denyPermission')}
                </Button>
            </div>
        );
    }
    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="shrink-0 text-emerald-700 dark:text-emerald-400"
            onClick={onGrant}
        >
            {t('admin-pages.access.users.permissions.grantPermission')}
        </Button>
    );
}

/**
 * CommandPalette Component
 *
 * Visual shell for the search command palette (Cmd+K / Ctrl+K).
 * Currently shows a "Coming Soon" placeholder. Real search functionality
 * will be implemented in a future spec.
 */

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/components/ui/command';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { SearchIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';

/**
 * CommandPalette provides a keyboard-accessible search dialog.
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 */
export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const { t } = useTranslations();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setOpen((prev) => !prev);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <>
            {/* Search trigger button */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="hidden items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-accent lg:flex"
            >
                <SearchIcon className="h-4 w-4" />
                <span>{t('admin-nav.topbar.search')}</span>
                <kbd className="pointer-events-none ml-2 hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {/* Command dialog */}
            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title={t('admin-common.aria.search')}
                description={t('admin-common.comingSoon.search' as TranslationKey)}
            >
                <CommandInput
                    placeholder={t('admin-common.comingSoon.searchPlaceholder' as TranslationKey)}
                />
                <CommandList>
                    <CommandEmpty>
                        <div className="flex flex-col items-center gap-2 py-6">
                            <SearchIcon className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-muted-foreground text-sm">
                                {t('admin-common.comingSoon.search' as TranslationKey)}
                            </p>
                        </div>
                    </CommandEmpty>
                    <CommandGroup heading={t('admin-common.comingSoon.title' as TranslationKey)}>
                        <CommandItem disabled>
                            {t('admin-common.comingSoon.description' as TranslationKey)}
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}

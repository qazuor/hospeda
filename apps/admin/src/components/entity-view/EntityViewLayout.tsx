import { Button } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import {
    Download,
    Edit,
    Eye,
    EyeOff,
    Grid3X3,
    List,
    Loader2,
    Maximize2,
    Printer,
    RefreshCw,
    Settings
} from 'lucide-react';
import * as React from 'react';
import { EntityViewSection } from '../entity-form/EntityViewSection';
import { TabsLayout } from '../entity-form/layouts';
import type { ViewDisplayMode } from './context/EntityViewContext';
import { useEntityView } from './hooks/useEntityView';

/**
 * Props for EntityViewLayout component
 */
export interface EntityViewLayoutProps {
    /** Optional class name for styling */
    className?: string;
    /** Whether to show the header with actions */
    showHeader?: boolean;
    /** Whether to show the footer with info */
    showFooter?: boolean;
    /** Custom header content */
    headerContent?: React.ReactNode;
    /** Custom footer content */
    footerContent?: React.ReactNode;
    /** Whether to use sticky header */
    stickyHeader?: boolean;
    /** Whether to use sticky footer */
    stickyFooter?: boolean;
    /** Callback when edit mode is requested */
    onEditMode?: () => void;
    /** Whether edit mode is available */
    canEdit?: boolean;
}

/**
 * Main layout component for entity views
 * Orchestrates the entire view experience with sections, navigation, and actions
 */
export const EntityViewLayout = React.forwardRef<HTMLDivElement, EntityViewLayoutProps>(
    (
        {
            className,
            showHeader = true,
            showFooter = true,
            headerContent,
            footerContent,
            stickyHeader = true,
            stickyFooter = false,
            onEditMode,
            canEdit = false,
            ...props
        },
        ref
    ) => {
        const {
            config,
            values,
            userPermissions,
            displayMode,
            showEmptyFields,
            showEditControls,
            activeSectionId,
            isLoading,
            hasData,
            isEmpty,
            setDisplayMode,
            toggleShowEmptyFields,
            toggleShowEditControls,
            setActiveSection,
            handleFieldEdit,
            getVisibleSections,
            exportData,
            printView,
            refresh
        } = useEntityView();

        const visibleSections = getVisibleSections();

        // Handle section change
        const handleSectionChange = React.useCallback(
            (sectionId: string) => {
                setActiveSection(sectionId);
            },
            [setActiveSection]
        );

        // Handle display mode change
        const handleDisplayModeChange = React.useCallback(
            (mode: ViewDisplayMode) => {
                setDisplayMode(mode);
            },
            [setDisplayMode]
        );

        // Handle export
        const handleExport = React.useCallback(() => {
            const data = exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${config.id}-export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, [exportData, config.id]);

        // Render view header
        const renderHeader = () => {
            if (!showHeader) return null;

            return (
                <div
                    className={cn(
                        'border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
                        stickyHeader && 'sticky top-0 z-10'
                    )}
                >
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            {/* Entity Title */}
                            <div>
                                <h1 className="font-semibold text-lg">{config.title}</h1>
                                {config.description && (
                                    <p className="text-muted-foreground text-sm">
                                        {config.description}
                                    </p>
                                )}
                            </div>

                            {/* Loading Indicator */}
                            {isLoading && (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            )}

                            {/* Data Status */}
                            {isEmpty && !isLoading && (
                                <div className="rounded-full bg-gray-100 px-2 py-1 text-gray-800 text-xs dark:bg-gray-800 dark:text-gray-200">
                                    No data
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Custom Header Content */}
                            {headerContent}

                            {/* Display Mode Toggle */}
                            <div className="flex items-center rounded-md border">
                                <Button
                                    type="button"
                                    variant={displayMode === 'card' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleDisplayModeChange('card')}
                                    className="rounded-r-none border-r"
                                >
                                    <Grid3X3 className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant={displayMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleDisplayModeChange('list')}
                                    className="rounded-none border-r"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant={displayMode === 'compact' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleDisplayModeChange('compact')}
                                    className="rounded-l-none"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* View Options */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggleShowEmptyFields}
                            >
                                {showEmptyFields ? (
                                    <EyeOff className="mr-2 h-4 w-4" />
                                ) : (
                                    <Eye className="mr-2 h-4 w-4" />
                                )}
                                {showEmptyFields ? 'Hide Empty' : 'Show Empty'}
                            </Button>

                            {/* Edit Controls Toggle */}
                            {canEdit && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={toggleShowEditControls}
                                >
                                    <Settings className="mr-2 h-4 w-4" />
                                    {showEditControls ? 'Hide Controls' : 'Show Controls'}
                                </Button>
                            )}

                            {/* Actions */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={refresh}
                                disabled={isLoading}
                            >
                                <RefreshCw
                                    className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')}
                                />
                                Refresh
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={printView}
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={isEmpty}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>

                            {/* Edit Mode */}
                            {canEdit && onEditMode && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={onEditMode}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        // Render view content
        const renderContent = () => {
            if (isEmpty && !isLoading) {
                return (
                    <div className="flex flex-1 items-center justify-center p-8">
                        <div className="text-center">
                            <h3 className="font-medium text-lg">No data available</h3>
                            <p className="text-muted-foreground text-sm">
                                This entity doesn't have any data to display.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={refresh}
                                className="mt-4"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                );
            }

            if (visibleSections.length === 0) {
                return (
                    <div className="flex flex-1 items-center justify-center p-8">
                        <div className="text-center">
                            <h3 className="font-medium text-lg">No accessible sections</h3>
                            <p className="text-muted-foreground text-sm">
                                You don't have permission to view any sections of this entity.
                            </p>
                        </div>
                    </div>
                );
            }

            // Use tabs layout for multiple sections
            if (visibleSections.length > 1) {
                return (
                    <TabsLayout
                        tabs={visibleSections.map((section) => ({
                            id: section.id,
                            label: section.title || section.id,
                            content: (
                                <EntityViewSection
                                    key={section.id}
                                    config={section}
                                    values={values}
                                    userPermissions={userPermissions}
                                    mode={displayMode}
                                    showEmptyFields={showEmptyFields}
                                    showEditControls={showEditControls}
                                    onEditField={handleFieldEdit}
                                />
                            ),
                            icon: section.icon,
                            badge: section.badge
                        }))}
                        defaultValue={activeSectionId}
                        onValueChange={handleSectionChange}
                        orientation="horizontal"
                        fullWidth
                        className="flex-1"
                    />
                );
            }

            // Single section - render directly
            const section = visibleSections[0];
            return (
                <div className="flex-1 p-6">
                    <EntityViewSection
                        config={section}
                        values={values}
                        userPermissions={userPermissions}
                        mode={displayMode}
                        showEmptyFields={showEmptyFields}
                        showEditControls={showEditControls}
                        onEditField={handleFieldEdit}
                    />
                </div>
            );
        };

        // Render view footer
        const renderFooter = () => {
            if (!showFooter) return null;

            return (
                <div
                    className={cn(
                        'border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
                        stickyFooter && 'sticky bottom-0 z-10'
                    )}
                >
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4 text-muted-foreground text-sm">
                            {/* Status Information */}
                            {isLoading && (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            )}

                            {/* Data Information */}
                            {hasData && (
                                <div>
                                    {Object.keys(values).length} field
                                    {Object.keys(values).length !== 1 ? 's' : ''} available
                                </div>
                            )}

                            {/* Section Information */}
                            {visibleSections.length > 1 && activeSectionId && (
                                <div>
                                    Section{' '}
                                    {visibleSections.findIndex((s) => s.id === activeSectionId) + 1}{' '}
                                    of {visibleSections.length}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Custom Footer Content */}
                            {footerContent}

                            {/* Display Mode Info */}
                            <div className="text-muted-foreground text-sm">
                                {displayMode.charAt(0).toUpperCase() + displayMode.slice(1)} view
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div
                ref={ref}
                className={cn('flex min-h-screen flex-col bg-background', className)}
                {...props}
            >
                {renderHeader()}
                {renderContent()}
                {renderFooter()}
            </div>
        );
    }
);

EntityViewLayout.displayName = 'EntityViewLayout';

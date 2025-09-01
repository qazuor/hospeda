import { Button } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { Eye, Loader2, RotateCcw, Save } from 'lucide-react';
import * as React from 'react';
import { EntityFormSection } from './EntityFormSection';
import { useEntityForm } from './hooks/useEntityForm';
import { TabsLayout } from './layouts';

/**
 * Props for EntityFormLayout component
 */
export interface EntityFormLayoutProps {
    /** Optional class name for styling */
    className?: string;
    /** Whether to show the header with actions */
    showHeader?: boolean;
    /** Whether to show the footer with actions */
    showFooter?: boolean;
    /** Custom header content */
    headerContent?: React.ReactNode;
    /** Custom footer content */
    footerContent?: React.ReactNode;
    /** Whether to use sticky header */
    stickyHeader?: boolean;
    /** Whether to use sticky footer */
    stickyFooter?: boolean;
}

/**
 * Main layout component for entity forms
 * Orchestrates the entire form experience with sections, navigation, and actions
 */
export const EntityFormLayout = React.forwardRef<HTMLDivElement, EntityFormLayoutProps>(
    (
        {
            className,
            showHeader = true,
            showFooter = true,
            headerContent,
            footerContent,
            stickyHeader = true,
            stickyFooter = true,
            ...props
        },
        ref
    ) => {
        const {
            config,
            values,
            errors,
            userPermissions,
            isLoading,
            isSaving,
            canSave,
            canDiscard,

            isEditMode,
            activeSectionId,
            setFieldValue,
            handleFieldBlur,
            save,
            saveAndPublish,
            discard,
            switchToViewMode,
            getVisibleSections,
            setActiveSection,
            hasUnsavedChanges
        } = useEntityForm();

        const visibleSections = getVisibleSections();

        // Handle section change
        const handleSectionChange = React.useCallback(
            (sectionId: string) => {
                setActiveSection(sectionId);
            },
            [setActiveSection]
        );

        // Render form header
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

                            {/* Unsaved Changes Indicator */}
                            {hasUnsavedChanges() && !isSaving && (
                                <div className="rounded-full bg-orange-100 px-2 py-1 text-orange-800 text-xs dark:bg-orange-900 dark:text-orange-200">
                                    Unsaved changes
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Custom Header Content */}
                            {headerContent}

                            {/* Mode Toggle */}
                            {isEditMode && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={switchToViewMode}
                                    disabled={isLoading || isSaving}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Button>
                            )}

                            {/* Save Actions */}
                            {isEditMode && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={discard}
                                        disabled={!canDiscard || isLoading}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Discard
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={save}
                                        disabled={!canSave || isLoading}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Save
                                    </Button>

                                    {saveAndPublish && (
                                        <Button
                                            type="button"
                                            variant="default"
                                            size="sm"
                                            onClick={saveAndPublish}
                                            disabled={!canSave || isLoading}
                                        >
                                            {isSaving ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="mr-2 h-4 w-4" />
                                            )}
                                            Save & Publish
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        // Render form content
        const renderContent = () => {
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
                                <EntityFormSection
                                    key={section.id}
                                    config={section}
                                    values={values}
                                    errors={errors}
                                    userPermissions={userPermissions}
                                    onFieldChange={setFieldValue}
                                    onFieldBlur={handleFieldBlur}
                                    disabled={isLoading || isSaving}
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
                    <EntityFormSection
                        config={section}
                        values={values}
                        errors={errors}
                        userPermissions={userPermissions}
                        onFieldChange={setFieldValue}
                        onFieldBlur={handleFieldBlur}
                        disabled={isLoading || isSaving}
                    />
                </div>
            );
        };

        // Render form footer
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
                            {isSaving && (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
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

                            {/* Quick Actions */}
                            {isEditMode && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={discard}
                                        disabled={!canDiscard || isLoading}
                                    >
                                        Discard Changes
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={save}
                                        disabled={!canSave || isLoading}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Save Changes
                                    </Button>
                                </div>
                            )}
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

EntityFormLayout.displayName = 'EntityFormLayout';

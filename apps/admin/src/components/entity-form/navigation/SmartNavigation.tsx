import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui-wrapped/Button';
import { Progress } from '@/components/ui-wrapped/Progress';
import { cn } from '@/lib/utils';
import { useTranslations } from '@repo/i18n';
import type React from 'react';
import type { OverallProgress, SectionProgress } from '../../../hooks/useSectionProgress';

/**
 * Props for SmartNavigation component
 */
export interface SmartNavigationProps {
    /** Array of section progress data */
    sections: SectionProgress[];
    /** Overall progress summary */
    overallProgress: OverallProgress;
    /** Currently active section ID */
    activeSectionId?: string;
    /** Callback when section is selected */
    onSectionSelect: (sectionId: string) => void;
    /** Callback to scroll to errors */
    onScrollToErrors?: () => void;
    /** Whether navigation is sticky */
    sticky?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show progress bar */
    showProgress?: boolean;
    /** Whether to show section details */
    showDetails?: boolean;
    /** Compact mode for smaller screens */
    compact?: boolean;
}

/**
 * Get icon for section status
 */
const getSectionIcon = (status: SectionProgress['status']) => {
    switch (status) {
        case 'complete':
            return 'confirm'; // Using available confirm icon
        case 'error':
            return 'alert-triangle'; // Using available alert-triangle icon
        case 'partial':
            return 'loader'; // Using available loader icon
        case 'empty':
            return 'add'; // Using available add icon for empty state
        case 'disabled':
            return 'cancel'; // Using available cancel icon
        default:
            return 'add';
    }
};

/**
 * Get color classes for section status
 */
const getSectionColors = (status: SectionProgress['status'], isActive: boolean) => {
    const baseClasses = 'transition-colors duration-200';

    if (isActive) {
        return cn(baseClasses, 'bg-blue-50 border-blue-200 text-blue-900');
    }

    switch (status) {
        case 'complete':
            return cn(baseClasses, 'text-green-700 hover:bg-green-50 border-green-200');
        case 'error':
            return cn(baseClasses, 'text-red-700 hover:bg-red-50 border-red-200');
        case 'partial':
            return cn(baseClasses, 'text-amber-700 hover:bg-amber-50 border-amber-200');
        case 'empty':
            return cn(baseClasses, 'text-gray-500 hover:bg-gray-50 border-gray-200');
        case 'disabled':
            return cn(baseClasses, 'text-gray-400 border-gray-100 cursor-not-allowed');
        default:
            return cn(baseClasses, 'text-gray-600 hover:bg-gray-50 border-gray-200');
    }
};

/**
 * Smart navigation component for entity forms
 * Provides intelligent navigation with progress indicators and status
 *
 * @example
 * ```tsx
 * <SmartNavigation
 *   sections={sectionProgress}
 *   overallProgress={overallProgress}
 *   activeSectionId={activeSection}
 *   onSectionSelect={handleSectionSelect}
 *   onScrollToErrors={scrollToError}
 *   sticky
 *   showProgress
 * />
 * ```
 */
export const SmartNavigation: React.FC<SmartNavigationProps> = ({
    sections,
    overallProgress,
    activeSectionId,
    onSectionSelect,
    onScrollToErrors,
    sticky = false,
    className,
    showProgress = true,
    showDetails = true,
    compact = false
}) => {
    const { t } = useTranslations();

    const containerClasses = cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm',
        sticky && 'sticky top-4 z-10',
        className
    );

    const sectionsWithErrors = sections.filter((s) => s.hasErrors);
    const hasErrors = sectionsWithErrors.length > 0;

    return (
        <div className={containerClasses}>
            {/* Header with overall progress */}
            {showProgress && (
                <div className="border-gray-200 border-b p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 text-sm">
                            {t('ui.navigation.formProgress')}
                        </h3>
                        <span className="font-medium text-gray-600 text-sm">
                            {overallProgress.completionPercentage}%
                        </span>
                    </div>

                    <Progress
                        value={overallProgress.completionPercentage}
                        className="mb-2"
                    />

                    {showDetails && (
                        <div className="flex items-center justify-between text-gray-500 text-xs">
                            <span>
                                {overallProgress.completedSections} /{' '}
                                {overallProgress.totalSections}{' '}
                                {t('ui.navigation.sectionsComplete')}
                            </span>
                            {hasErrors && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onScrollToErrors}
                                    className="h-auto p-1 text-red-600 hover:text-red-700"
                                >
                                    <Icon
                                        name="alert-triangle"
                                        className="mr-1 h-3 w-3"
                                    />
                                    {sectionsWithErrors.length} {t('ui.navigation.errors')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Section list */}
            <div className="p-2">
                <nav className="space-y-1">
                    {sections.map((section) => {
                        const isActive = section.id === activeSectionId;
                        const isDisabled =
                            section.status === 'disabled' || section.totalFields === 0;

                        return (
                            <button
                                type="button"
                                key={section.id}
                                onClick={() => !isDisabled && onSectionSelect(section.id)}
                                disabled={isDisabled}
                                className={cn(
                                    'flex w-full items-center justify-between rounded-md border p-3 text-left transition-all duration-200',
                                    getSectionColors(section.status, isActive),
                                    compact && 'p-2',
                                    isDisabled && 'cursor-not-allowed opacity-50'
                                )}
                            >
                                <div className="flex items-center space-x-3">
                                    <Icon
                                        name={getSectionIcon(section.status)}
                                        className={cn(
                                            'h-4 w-4 flex-shrink-0',
                                            compact && 'h-3 w-3'
                                        )}
                                    />

                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={cn(
                                                'truncate font-medium',
                                                compact ? 'text-xs' : 'text-sm'
                                            )}
                                        >
                                            {section.title}
                                        </p>

                                        {showDetails && !compact && (
                                            <p className="text-gray-500 text-xs">
                                                {section.completedFields} / {section.totalFields}{' '}
                                                {t('ui.navigation.fieldsComplete')}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {/* Progress indicator */}
                                    {!compact && section.totalFields > 0 && (
                                        <div className="flex items-center space-x-1">
                                            <div className="h-2 w-12 rounded-full bg-gray-200">
                                                <div
                                                    className={cn(
                                                        'h-2 rounded-full transition-all duration-300',
                                                        section.status === 'complete' &&
                                                            'bg-green-500',
                                                        section.status === 'error' && 'bg-red-500',
                                                        section.status === 'partial' &&
                                                            'bg-amber-500',
                                                        section.status === 'empty' && 'bg-gray-300'
                                                    )}
                                                    style={{
                                                        width: `${section.completionPercentage}%`
                                                    }}
                                                />
                                            </div>
                                            <span className="font-medium text-gray-500 text-xs">
                                                {section.completionPercentage}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Error indicator */}
                                    {section.hasErrors && (
                                        <div className="flex items-center space-x-1">
                                            <Icon
                                                name="alert-triangle"
                                                className="h-3 w-3 text-red-500"
                                            />
                                            <span className="font-medium text-red-600 text-xs">
                                                {section.errorCount}
                                            </span>
                                        </div>
                                    )}

                                    {/* Required indicator */}
                                    {section.isRequired && (
                                        <Icon
                                            name="alert-triangle"
                                            className="h-2 w-2 text-red-400"
                                        />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Footer with submission status */}
            {showDetails && (
                <div className="border-gray-200 border-t p-4">
                    <div
                        className={cn(
                            'flex items-center justify-between rounded-md p-2 text-sm',
                            overallProgress.readyForSubmission
                                ? 'bg-green-50 text-green-800'
                                : 'bg-amber-50 text-amber-800'
                        )}
                    >
                        <div className="flex items-center space-x-2">
                            <Icon
                                name={overallProgress.readyForSubmission ? 'confirm' : 'loader'}
                                className="h-4 w-4"
                            />
                            <span className="font-medium">
                                {overallProgress.readyForSubmission
                                    ? t('ui.navigation.readyToSubmit')
                                    : t('ui.navigation.incompleteForm')}
                            </span>
                        </div>

                        {!overallProgress.allRequiredComplete && (
                            <span className="text-xs">
                                {t('ui.navigation.requiredFieldsMissing')}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

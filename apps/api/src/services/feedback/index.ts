/**
 * Feedback services barrel export.
 *
 * Provides the {@link LinearFeedbackService} for creating Linear issues
 * from user-submitted feedback reports.
 *
 * @module services/feedback
 */

export { LinearFeedbackService } from './linear.service.js';
export type {
    CreateFeedbackIssueInput,
    FeedbackAttachment,
    FeedbackEnvironment,
    LinearFeedbackServiceInput,
    LinearFileUploadResult,
    LinearIssueResult
} from './linear.service.js';

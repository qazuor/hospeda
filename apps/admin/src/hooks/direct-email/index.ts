/**
 * Direct email admin hooks barrel (HOS-2685).
 */

export {
    getDirectEmailErrorKey,
    getDirectEmailErrorReason
} from './direct-email-errors';
export {
    type DirectEmailSuppressionFilters,
    directEmailSuppressionQueryKeys,
    useCreateDirectEmailSuppression,
    useDeleteDirectEmailSuppression,
    useDirectEmailSuppressions
} from './use-direct-email-suppressions';
export {
    directEmailTemplateQueryKeys,
    useCreateDirectEmailTemplate,
    useDeleteDirectEmailTemplate,
    useDirectEmailTemplates,
    useUpdateDirectEmailTemplate
} from './use-direct-email-templates';
export {
    buildListQuery,
    type DirectEmailListFilters,
    type DirectEmailPage,
    directEmailQueryKeys,
    useCheckDirectEmailRecipients,
    useDirectEmail,
    useDirectEmails,
    usePreviewDirectEmail,
    useSendDirectEmail,
    useTestSendDirectEmail
} from './use-direct-emails';

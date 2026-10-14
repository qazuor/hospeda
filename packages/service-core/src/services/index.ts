// HOS-663: the delete-time calendar cascade and the revocation port the API
// layer registers into it at startup.
export {
    type CalendarCascadeMode,
    type CalendarConnectionRevocationPort,
    type CalendarConnectionRevocationResult,
    type CascadeCalendarConnectionsInput,
    type CascadeCalendarConnectionsResult,
    cascadeCalendarConnectionsOnAccommodationDelete,
    getCalendarConnectionRevocationPort,
    HARD_DELETE_REVOCATION_FAILURE_MARKER,
    REVOCATION_FAILURE_PREFIX,
    setCalendarConnectionRevocationPort
} from './accommodation/accommodation.calendar-cascade';
// HOS-1377: host-initiated disconnect closes the provider-side grant too.
export {
    type CalendarDisconnectRevocationOutcome,
    type DisconnectCalendarConnectionInput,
    type DisconnectCalendarConnectionResult,
    disconnectCalendarConnection
} from './accommodation/accommodation.calendar-disconnect';
// HOS-963: pure media-composition helper reused by raw-query public routes
// (e.g. `similar.ts`) that bypass `AccommodationService.search()` and therefore
// never hit `_afterSearch`, the chokepoint that normally composes `media` from
// the relational `accommodation_media` table. Mirrors gastronomy and experience's
// `composeListingMedia` export below.
export {
    type ComposeAccommodationMediaInput,
    composeAccommodationMedia
} from './accommodation/accommodation.media-compose';
export * from './accommodation/accommodation.occupancy';
export * from './accommodation/accommodation.poi-proximity.helper';
export * from './accommodation/accommodation.service';
export * from './accommodation/accommodation.sync-featured-by-entitlement';
// HookState types for service consumers
export type {
    AccommodationHookState,
    HostOnboardingResult,
    PublishEligibility
} from './accommodation/accommodation.types';
// HOS-1183: the publish/deny rule, stated once. These are values, so they do
// not join the type-only block above. The `GET /publish-eligibility` route that
// consumed them outside this package was removed by HOS-1668.
export {
    FIRST_PUBLISH_PAUSED_REASON,
    PUBLISH_ELIGIBILITY_VALUES,
    publishEligibilityAllowsPublish,
    publishEligibilityStartsLocalTrial
} from './accommodation/accommodation.types';
export * from './accommodation-external-reputation/index.js';
export * from './accommodation-import/index.js';
// HOS-25 T-025: pure per-review average helper, reused by seed factories that
// model-direct insert review rows (bypassing the service's own _afterCreate).
export { computeAccommodationReviewAverage } from './accommodationReview/accommodationReview.helpers';
export * from './accommodationReview/accommodationReview.service';
export type { AccommodationReviewHookState } from './accommodationReview/accommodationReview.types';
export * from './alert';
export * from './alliance-lead';
export * from './amenity/amenity.service';
export * from './appLog/index.js';
export * from './attraction/attraction.service';
export * from './auditLog/index.js';
export * from './billing/addon/addon-instance-a5.js';
export * from './billing/addon/addon-orphanhood.js';
export * from './billing/addon/addon-orphanhood-ports.js';
export * from './billing/coverage/addon-sources.js';
export * from './billing/coverage/billing-coverage.js';
export * from './billing/coverage/can-charge.js';
export * from './billing/coverage/coverage-loss.js';
export * from './billing/coverage/coverage-notice-registry.js';
export * from './billing/coverage/coverage-ports.js';
export * from './billing/coverage/retention-stopped.js';
export * from './billing/coverage/subscription-sources.js';
export * from './billing/deadlines/billing-deadlines.service.js';
export * from './billing/notice/live-preapproval-on-closed-row.js';
export * from './billing/notice/mirror-cancelled-on-grace.js';
export * from './billing/notice/process-provider-notice.service.js';
export * from './billing/notice/provider-delivery-channel.js';
export * from './billing/notice/provider-notice-delegates.js';
export * from './billing/notice/provider-notice-mirror.js';
export * from './billing/notice/provider-notice-ports.js';
export * from './billing/notice/purge-provider-notifications.service.js';
export * from './billing/notice/receive-provider-delivery.service.js';
export {
    NotificationRetentionService,
    type RetentionSummary
} from './billing/notification/notification-retention.service.js';
export * from './billing/payment/apply-executed-refund.service.js';
export * from './billing/payment/credit-payment.service.js';
export * from './billing/payment/fail-payment.service.js';
export * from './billing/payment/issue-receipt.js';
export * from './billing/payment/payment-ledger.js';
export * from './billing/payment/payment-ports.js';
export * from './billing/payment/record-charge-fact.service.js';
export * from './billing/read-anchored-billing-option.js';
export * from './billing/reconciliation/cancel-our-authorization.js';
export * from './billing/reconciliation/chargeback/chargeback-detection.js';
export * from './billing/reconciliation/creations/creations-sweep.service.js';
export * from './billing/reconciliation/handle-unknown-authorization.service.js';
export * from './billing/reconciliation/lift-reconciliation-mark.service.js';
export * from './billing/reconciliation/open-reconciliation-mark.service.js';
export * from './billing/reconciliation/period-charges/read-period-charges.js';
export * from './billing/reconciliation/provider-cancellation-decision.js';
export * from './billing/reconciliation/receipt-tombstone.service.js';
export * from './billing/reconciliation/reconciliation-mark-payments.port.js';
export * from './billing/reconciliation/sweep/comparisons/amount-comparison.js';
export * from './billing/reconciliation/sweep/comparisons/amount-mutation-decisions.port.js';
export * from './billing/reconciliation/sweep/comparisons/expected-amount.js';
export * from './billing/reconciliation/sweep/comparisons/listed-charges.js';
export * from './billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
export * from './billing/reconciliation/sweep/comparisons/reconciliation-daily-summary.port.js';
export * from './billing/reconciliation/sweep/comparisons/state-comparison.js';
export * from './billing/reconciliation/sweep/comparisons/unregistered-charge-reason.js';
export * from './billing/reconciliation/sweep/credited-payments-check.js';
export * from './billing/reconciliation/sweep/grace-expiry-check.js';
export * from './billing/reconciliation/sweep/lost-rejection-check.js';
export * from './billing/reconciliation/sweep/our-cancellation-retry.js';
export * from './billing/reconciliation/sweep/paid-orders-check.js';
export * from './billing/reconciliation/sweep/reconciliation-divergence.js';
export * from './billing/reconciliation/sweep/reconciliation-sweep.service.js';
export * from './billing/reconciliation/sweep/succession-retention-ports.js';
export * from './billing/reconciliation/sweep/successor-grace-check.js';
export * from './billing/reconciliation/sweep/sweep-liveness-ping.port.js';
export * from './billing/reconciliation/sweep/unresolved-period-charge.port.js';
export * from './billing/reconciliation/sweep/zero-call-checks.service.js';
export * from './billing/reconciliation/sweep/zero-call-ports.js';
export * from './billing/refund/refund-machine.js';
export * from './billing/refund/request-refund.service.js';
export * from './billing/refund/settle-external-refund.service.js';
export * from './billing/subscription/activate-pending-with-signup-notice.js';
export * from './billing/subscription/activate-subscription.service.js';
export * from './billing/subscription/admit-succession-predecessor.js';
export * from './billing/subscription/arrears-suspension-notice.js';
export * from './billing/subscription/before-cancel-notice-kinds.js';
export * from './billing/subscription/billing-period-end.js';
export * from './billing/subscription/cancel-inherited-tourist-vip.service.js';
export * from './billing/subscription/complement-s21.js';
export * from './billing/subscription/decline-first-charge.service.js';
export * from './billing/subscription/end-scheduled-services.service.js';
export * from './billing/subscription/enter-grace.service.js';
export * from './billing/subscription/exit-grace.service.js';
export * from './billing/subscription/expire-authorization-windows.service.js';
export * from './billing/subscription/grace-started-notice.js';
export * from './billing/subscription/late-payment-conditions.js';
export * from './billing/subscription/paying-predecessor-successor.js';
export * from './billing/subscription/provider-link-cancellation-seen.js';
export * from './billing/subscription/reactivate-suspended.service.js';
export * from './billing/subscription/revocation-payment.js';
export * from './billing/subscription/revoke-subscription.service.js';
export * from './billing/subscription/scheduled-change-on-return.js';
export * from './billing/subscription/service-end-s12.js';
export * from './billing/subscription/signup-confirmed-notice.js';
export * from './billing/subscription/signup-declined-notice.js';
export * from './billing/subscription/start-subscription.service.js';
export * from './billing/subscription/start-succession.service.js';
export * from './billing/subscription/subscription-billing-ports.js';
export * from './billing/subscription/succession-end.js';
export * from './billing/subscription/succession-permanent-grant.js';
export * from './billing/subscription/succession-retained-payment.js';
export * from './billing/subscription/succession-target-guard.js';
export * from './billing/subscription/suspend-for-arrears.service.js';
export * from './contentModeration';
export * from './conversation/index.js';
export * from './cronRun/index.js';
// HOS-25 T-025: pure hierarchy-math helpers (level/path/pathIds computation),
// reused by the `required` destinations seed factory so it does not
// re-implement the same math when model-direct inserting fixtures with a
// deterministic id (which bypasses DestinationService._beforeCreate).
export * from './destination/destination.hierarchy.helpers';
export * from './destination/destination.service';
export type { DestinationHookState } from './destination/destination.types';
// HOS-25 T-025: pure per-review average helper, mirrors
// computeAccommodationReviewAverage above for the destination-review side.
export { computeReviewAverageRating } from './destinationReview/destinationReview.helpers';
export * from './destinationReview/destinationReview.service';
export type { DestinationReviewHookState } from './destinationReview/destinationReview.types';
export * from './entityComment/entityComment.service';
export * from './entityView/index.js';
export * from './event/event.media';
export * from './event/event.media-read';
export * from './event/event.service';
export type { EventHookState } from './event/event.types';
export * from './eventLocation/eventLocation.service';
export * from './eventOrganizer/eventOrganizer.service';
export * from './exchange-rate';
export * from './experience';
export type { ExperienceHookState } from './experience/experience.types';
export * from './feature/feature.normalizers';
export * from './feature/feature.service';
export * from './feature-flags';
export * from './gastronomy';
export * from './geocoding';
export * from './hostTrade/host-trade.permissions';
export * from './hostTrade/host-trade.service';
// The HOS-376 half of the domain. Without these the services exist but are
// unreachable from `@repo/service-core`, so no API route can construct one —
// which is exactly how they shipped invisible until T-030 needed them.
export * from './hostTrade/host-trade-aggregates';
export * from './hostTrade/host-trade-qr';
export * from './hostTrade/host-trade-review.permissions';
export * from './hostTrade/host-trade-review.service';
export * from './hostTrade/host-trade-review-reply.service';
export * from './hostTrade/host-trade-usage.permissions';
export * from './hostTrade/host-trade-usage.service';
export * from './listing';
export type { ListingHookState } from './listing/listing.types';
export * from './media';
export * from './moderation';
export * from './newsletter';
export * from './owner-promotion';
// Listed as a FILE, like every other partner module here: this barrel does not
// re-export the `./partner` folder index, so an export added there alone never
// reaches the package root (HOS-1299).
export * from './partner/partner.service';
export * from './partner/partner-mention.service';
// Partner in-platform statistics (HOS-1063)
export * from './partner/partner-stats.service';
export * from './permission/permission.effects';
export * from './permission/permission.service';
// HOS-1436 (V2.3, AC:V2:6/7): the action 18 — publish a plan version.
export * from './plan-catalog/plan-publication.service.js';
export * from './platformSettings/index.js';
export * from './poi-category/point-of-interest-category.service';
export * from './point-of-interest/point-of-interest.nearby-relevance';
export * from './point-of-interest/point-of-interest.service';
export * from './post/post.media';
export * from './post/post.media-read';
export * from './post/post.service';
export type { PostHookState } from './post/post.types';
export * from './postSponsor/postSponsor.service';
export * from './postSponsorship/postSponsorship.service';
export * from './qr-code';
export * from './recommendation';
export * from './social';
export * from './sponsorship';
export * from './stats';
export * from './tag/post-tag.permissions';
export * from './tag/post-tag.service';
export * from './tag/tag.service';
export * from './trial';
export * from './user/user.service';
// HOS-296: grant/revoke primitives for the multi-role capability set
export * from './user-role/index.js';
export * from './userBookmark/userBookmark.service';
export * from './userBookmarkCollection/userBookmarkCollection.service';
export * from './userSearchHistory/index.js';
export * from './vertical-deadlines/vertical-deadlines.service.js';
export * from './weather/index.js';

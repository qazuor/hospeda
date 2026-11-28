import type { AccommodationReviewReplyModel, AdminReplyRow } from '@repo/db';
import { AccommodationReviewReplyModel as ReplyModel } from '@repo/db';
import type { AccommodationReviewReply } from '@repo/schemas';
import { AccommodationReviewReplyAdminListQuerySchema } from '@repo/schemas';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { checkCanModerateAccommodationReview } from './accommodationReview.permissions';

/**
 * Admin read side of host replies to accommodation reviews (HOS-2675).
 *
 * Deliberately separate from `AccommodationReviewReplyService`: that service
 * owns the host's write path, this one only feeds the moderation queue. Every
 * read requires `ACCOMMODATION_REVIEW_MODERATE`, and the queue never hides a
 * reply by state — a moderator needs to see APPROVED ones to take them down too.
 */
export class AccommodationReviewReplyAdminService extends BaseService {
    static readonly ENTITY_NAME = 'accommodationReviewReplyAdmin';

    private readonly model: AccommodationReviewReplyModel;

    constructor(
        config: ServiceConfig,
        models?: { readonly model?: AccommodationReviewReplyModel }
    ) {
        super(config, AccommodationReviewReplyAdminService.ENTITY_NAME);
        this.model = models?.model ?? new ReplyModel();
    }

    /**
     * Lists live host replies for moderation, newest first.
     *
     * @param input.page - 1-based page.
     * @param input.pageSize - Page size.
     * @param input.accommodationId - Narrow to one accommodation.
     * @param input.moderationState - Keep only one moderation state.
     * @param input.actor - Must hold `ACCOMMODATION_REVIEW_MODERATE`.
     */
    public async listForModeration(
        input: {
            readonly page?: number;
            readonly pageSize?: number;
            readonly accommodationId?: string;
            readonly moderationState?: AccommodationReviewReply['moderationState'];
            readonly actor: Actor;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: AdminReplyRow[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForModeration',
            input,
            schema: AccommodationReviewReplyAdminListQuerySchema,
            ctx,
            execute: async (validated, actor) => {
                checkCanModerateAccommodationReview(actor);
                return this.model.findAdminList(
                    {
                        accommodationId: validated.accommodationId,
                        moderationState: validated.moderationState,
                        page: validated.page,
                        pageSize: validated.pageSize
                    },
                    ctx?.tx
                );
            }
        });
    }
}

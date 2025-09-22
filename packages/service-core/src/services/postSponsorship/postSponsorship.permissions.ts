import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanManagePostSponsorship(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.POST_SPONSOR_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to manage post sponsorship'
        );
    }
}

export function checkCanCreatePostSponsorship(actor: Actor, _data: unknown): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanUpdatePostSponsorship(actor: Actor, _entity: unknown): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanDeletePostSponsorship(actor: Actor, _entity: unknown): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanViewPostSponsorship(actor: Actor, _entity: unknown): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanListPostSponsorship(actor: Actor): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanSearchPostSponsorship(actor: Actor): void {
    checkCanManagePostSponsorship(actor);
}

export function checkCanCountPostSponsorship(actor: Actor): void {
    checkCanManagePostSponsorship(actor);
}

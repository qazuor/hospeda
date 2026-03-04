/**
 * Change Password Endpoint
 * Allows authenticated users to change their password.
 * Also clears the passwordChangeRequired flag if set.
 */
import { UserModel, accounts, getDb } from '@repo/db';
import { ChangePasswordInputSchema, ChangePasswordResponseSchema } from '@repo/schemas';
import { compare, hash } from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

export const changePasswordRoute = createSimpleRoute({
    method: 'post',
    path: '/change-password',
    summary: 'Change current user password',
    description: 'Changes the authenticated user password and clears forced password change flag.',
    tags: ['Auth'],
    responseSchema: ChangePasswordResponseSchema,
    handler: async (c: Context) => {
        const user = c.get('user');
        if (!user?.id) {
            throw new HTTPException(401, { message: 'Authentication required' });
        }

        const body = await c.req.json();
        const { currentPassword, newPassword } = ChangePasswordInputSchema.parse(body);
        const db = getDb();

        // 1. Get credential account
        const [account] = await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
            .limit(1);

        if (!account?.password) {
            throw new HTTPException(400, { message: 'No credential account found' });
        }

        // 2. Verify current password
        const isValid = await compare(currentPassword, account.password);
        if (!isValid) {
            throw new HTTPException(400, { message: 'Current password is incorrect' });
        }

        // 3. Hash new password
        const hashedPassword = await hash(newPassword, 12);

        // 4. Update password in accounts table
        await db
            .update(accounts)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(eq(accounts.id, account.id));

        // 5. Clear passwordChangeRequired flag if set
        try {
            const userModel = new UserModel();
            const dbUser = await userModel.findById(user.id);
            if (dbUser?.adminInfo?.passwordChangeRequired) {
                await userModel.update(
                    { id: user.id },
                    {
                        adminInfo: { ...dbUser.adminInfo, passwordChangeRequired: false }
                    }
                );
            }
        } catch (error) {
            apiLogger.warn({
                message: 'Failed to clear passwordChangeRequired flag',
                error
            });
        }

        apiLogger.info({ message: `Password changed for user ${user.id}` });

        return { success: true, message: 'Password changed successfully' };
    }
});

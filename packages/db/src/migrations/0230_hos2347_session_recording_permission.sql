-- HOS-2347: the web session recording switch permission. The new label is only added here, never used in this transaction, so ADD VALUE inside the migration transaction is safe. The SUPER_ADMIN grant is seed data-migration 0181 (run db:seed:migrate after this).
ALTER TYPE "public"."permission_enum" ADD VALUE 'analytics.sessionRecording.manage' BEFORE 'system.debugTools.access';

CREATE TABLE "reconciliation_mark" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"addon_instance_id" uuid,
	"reason" varchar(64) NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_reconciliation_mark_reason" CHECK ("reconciliation_mark"."reason" IN ('REEMBOLSO_POR_CONFIRMAR', 'COBRO_POSTERIOR_A_LA_BAJA', 'COBRO_POSTERIOR_AL_GRANT', 'PAGO_PENDIENTE_SIN_RAMA', 'DIVERGENCIA_DE_MONTO', 'TRANSICION_NO_DECLARADA', 'PAGO_TARDIO_RECHAZADO', 'REANUDACION_NO_APLICADA', 'SUCESION_ABIERTA_SOBRE_FILA_MUERTA', 'FAN_OUT_DE_GRANT_INCOMPLETO', 'ADDON_SIN_APAGAR', 'COBRO_DURANTE_CORTESIA', 'CORTESIA_SIN_RE_EMITIR', 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA', 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION', 'CANCELACION_SIN_CONFIRMAR', 'CONTRACARGO', 'REEMBOLSO_FUERA_DEL_FLUJO', 'COBRO_SIN_REGISTRAR', 'COBRO_DUPLICADO', 'COBRO_DEL_PERIODO_SIN_RESOLVER', 'PAUSA_NO_APLICADA', 'ORDEN_PAGADA_SIN_INSTANCIA', 'IMPORTE_COBRADO_DE_MAS')),
	CONSTRAINT "ck_reconciliation_mark_one_reference" CHECK (("reconciliation_mark"."subscription_id" IS NOT NULL) <> ("reconciliation_mark"."addon_instance_id" IS NOT NULL)),
	CONSTRAINT "ck_reconciliation_mark_instance_only_for_order" CHECK (("reconciliation_mark"."addon_instance_id" IS NOT NULL) = ("reconciliation_mark"."reason" = 'ORDEN_PAGADA_SIN_INSTANCIA')),
	CONSTRAINT "ck_reconciliation_mark_lifted_pair" CHECK (("reconciliation_mark"."lifted_at" IS NULL) = ("reconciliation_mark"."lifted_by" IS NULL)),
	CONSTRAINT "ck_reconciliation_mark_version_positive" CHECK ("reconciliation_mark"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "domain_event" DROP CONSTRAINT "domain_event_event_type_check";--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD CONSTRAINT "reconciliation_mark_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD CONSTRAINT "reconciliation_mark_addon_instance_id_addon_instance_id_fk" FOREIGN KEY ("addon_instance_id") REFERENCES "public"."addon_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD CONSTRAINT "reconciliation_mark_lifted_by_users_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reconciliation_mark_open_subscription_reason" ON "reconciliation_mark" USING btree ("subscription_id","reason") WHERE "reconciliation_mark"."lifted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reconciliation_mark_open_addon_instance_reason" ON "reconciliation_mark" USING btree ("addon_instance_id","reason") WHERE "reconciliation_mark"."lifted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_event_type_check" CHECK ("domain_event"."event_type" IN ('email.undeliverable', 'listing.created', 'listing.edited', 'trial.extended', 'reconciliation.mark_opened'));
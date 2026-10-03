CREATE TABLE "credit_withdrawals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"cbu" text NOT NULL,
	"alias" text,
	"reason" text,
	"status" "voucher_status" DEFAULT 'PENDIENTE' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_withdrawals" ADD CONSTRAINT "credit_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
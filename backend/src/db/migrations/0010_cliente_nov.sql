CREATE TABLE "auction_sanctions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auction_sanctions_unique" UNIQUE("auction_id","user_id","type")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "voided_by_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_withdrawals" ADD COLUMN "account_holder" text;--> statement-breakpoint
ALTER TABLE "credit_withdrawals" ADD COLUMN "cuit" text;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "next_min_bid" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_area_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_code_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_code_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "auction_sanctions" ADD CONSTRAINT "auction_sanctions_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sanctions" ADD CONSTRAINT "auction_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sanctions" ADD CONSTRAINT "auction_sanctions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
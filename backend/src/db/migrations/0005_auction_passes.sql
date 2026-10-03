CREATE TABLE "auction_passes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auction_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"last_used_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auction_passes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "auction_passes" ADD CONSTRAINT "auction_passes_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_passes" ADD CONSTRAINT "auction_passes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "lot_favorites" (
	"user_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lot_favorites_user_id_lot_id_pk" PRIMARY KEY("user_id","lot_id")
);
--> statement-breakpoint
ALTER TABLE "lots" DROP CONSTRAINT "lots_auction_number_unique";--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "private_user_id" uuid;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "bis" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lot_favorites" ADD CONSTRAINT "lot_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_favorites" ADD CONSTRAINT "lot_favorites_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_private_user_id_users_id_fk" FOREIGN KEY ("private_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_auction_number_bis_unique" UNIQUE("auction_id","number","bis");--> statement-breakpoint
-- Las subastas que ya existían estaban a la vista: quedan publicadas
UPDATE "auctions" SET "published" = true;

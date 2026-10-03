ALTER TABLE "lots" ADD COLUMN "leader_id" uuid;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Backfill: el lider de cada lote con pujas es quien hizo la puja mas alta
UPDATE "lots" SET "leader_id" = (
  SELECT "user_id" FROM "bids" WHERE "bids"."lot_id" = "lots"."id" ORDER BY "amount" DESC, "created_at" ASC LIMIT 1
);
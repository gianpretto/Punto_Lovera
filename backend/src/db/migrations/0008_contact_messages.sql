CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TYPE "public"."show_seat_status" AS ENUM('available', 'reserved', 'booked');--> statement-breakpoint
CREATE TYPE "public"."show_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."seat_tier" AS ENUM('standard', 'premium', 'vip');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_events_duration" CHECK ("events"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "show_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"status" "show_seat_status" DEFAULT 'available' NOT NULL,
	"booking_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uq_show_seat" UNIQUE("show_id","seat_id"),
	CONSTRAINT "ck_show_seats_price" CHECK ("show_seats"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"sales_open_at" timestamp with time zone NOT NULL,
	"status" "show_status" DEFAULT 'scheduled' NOT NULL,
	"is_high_demand" boolean DEFAULT false NOT NULL,
	"pricing" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"section" text NOT NULL,
	"row" text NOT NULL,
	"number" integer NOT NULL,
	"tier" "seat_tier" NOT NULL,
	CONSTRAINT "uq_seat_position" UNIQUE("venue_id","section","row","number")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "show_seats" ADD CONSTRAINT "show_seats_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_seats" ADD CONSTRAINT "show_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "show_seats_show_id_status_idx" ON "show_seats" USING btree ("show_id","status");--> statement-breakpoint
CREATE INDEX "shows_starts_at_id_idx" ON "shows" USING btree ("starts_at","id");--> statement-breakpoint
CREATE INDEX "venues_city_idx" ON "venues" USING btree ("city");
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"attempt_id" text NOT NULL,
	"item_id" text NOT NULL,
	"response" jsonb,
	"state" jsonb,
	"score" real,
	"max_score" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'empty' NOT NULL,
	"correct" boolean,
	"feedback" text,
	"note" text,
	"graded_by" text,
	"first_viewed_at" timestamp with time zone,
	"first_saved_at" timestamp with time zone,
	"last_saved_at" timestamp with time zone,
	"time_spent_ms" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "answers_attempt_id_item_id_pk" PRIMARY KEY("attempt_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"user_id" text NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"seed" integer NOT NULL,
	"order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"extra_seconds" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"max_score" real DEFAULT 0 NOT NULL,
	"frontier" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp with time zone,
	"last_item_id" text,
	"client" jsonb,
	"integrity" jsonb,
	"ai_review" jsonb,
	"reviewed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board" (
	"id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_items" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"section" text,
	"type" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"points" real DEFAULT 1 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grading" text DEFAULT 'auto' NOT NULL,
	"rubric" text,
	"problem_id" text
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"duration_min" integer,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"start_mode" text DEFAULT 'open' NOT NULL,
	"live_start_at" timestamp with time zone,
	"live_end_at" timestamp with time zone,
	"pauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra_seconds" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'everyone' NOT NULL,
	"access_code" text,
	"assignees" jsonb DEFAULT '{"groups":[],"users":[]}'::jsonb NOT NULL,
	"show_results" text DEFAULT 'after_submit' NOT NULL,
	"results_detail" text DEFAULT 'full' NOT NULL,
	"leaderboard" text DEFAULT 'off' NOT NULL,
	"integrity" jsonb NOT NULL,
	"shuffle_items" boolean DEFAULT false NOT NULL,
	"resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"tag" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'markdown' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text,
	"file_id" text,
	"published" boolean DEFAULT true NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drill_stats" (
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"attempted" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drill_stats_user_id_topic_pk" PRIMARY KEY("user_id","topic")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea",
	"blob_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrity_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"contest_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"item_id" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "launch_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "problem_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"problem_id" text NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"input" text DEFAULT '' NOT NULL,
	"output" text DEFAULT '' NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"explanation" text
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"statement" text DEFAULT '' NOT NULL,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_limit_ms" integer DEFAULT 2000 NOT NULL,
	"memory_limit_mb" integer DEFAULT 256 NOT NULL,
	"checker" text DEFAULT 'tokens' NOT NULL,
	"starter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"source" text,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"problem_id" text NOT NULL,
	"attempt_id" text,
	"item_id" text,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"verdict" text,
	"passed" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"time_ms" integer,
	"memory_kb" integer,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"grade" text,
	"notes" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"desktop_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_item_id_contest_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."contest_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_items" ADD CONSTRAINT "contest_items_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_items" ADD CONSTRAINT "contest_items_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_stats" ADD CONSTRAINT "drill_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_events" ADD CONSTRAINT "integrity_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_tokens" ADD CONSTRAINT "launch_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_tests" ADD CONSTRAINT "problem_tests_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_contest_idx" ON "attempts" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_unique_idx" ON "attempts" USING btree ("contest_id","user_id","attempt_no","is_preview");--> statement-breakpoint
CREATE INDEX "contest_items_contest_idx" ON "contest_items" USING btree ("contest_id","ord");--> statement-breakpoint
CREATE UNIQUE INDEX "contests_slug_idx" ON "contests" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integrity_attempt_idx" ON "integrity_events" USING btree ("attempt_id","at");--> statement-breakpoint
CREATE INDEX "integrity_contest_idx" ON "integrity_events" USING btree ("contest_id","id");--> statement-breakpoint
CREATE INDEX "problem_tests_problem_idx" ON "problem_tests" USING btree ("problem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "problems_slug_idx" ON "problems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_user_idx" ON "submissions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "submissions_problem_idx" ON "submissions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "submissions_attempt_idx" ON "submissions" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
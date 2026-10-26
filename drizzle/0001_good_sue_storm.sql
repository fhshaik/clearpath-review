CREATE TABLE `ai_connections` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_review_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`verifier` text NOT NULL,
	`origin` text NOT NULL,
	`return_path` text NOT NULL,
	`expires_at` integer NOT NULL
);

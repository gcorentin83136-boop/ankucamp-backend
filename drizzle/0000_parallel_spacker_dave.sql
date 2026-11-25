CREATE TABLE "account_deletion_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scheduled_deletion_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_comment_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"parent_comment_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) DEFAULT 'shop-' || substr(md5(random()::text), 1, 12) NOT NULL,
	"excerpt" varchar(500),
	"content" text NOT NULL,
	"cover_url" text,
	"tags" text,
	"category" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"published_at" timestamp,
	"views_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(30),
	"target_id" integer,
	"description" text,
	"metadata" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon" varchar(100),
	"image_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"product_id" integer,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" integer NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" integer NOT NULL,
	"reason" varchar(30) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_id" integer,
	"admin_note" text,
	"content_deleted" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"last_read_at" timestamp,
	"last_read_message_id" integer,
	"muted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) DEFAULT 'direct' NOT NULL,
	"name" varchar(255),
	"avatar_url" text,
	"created_by" integer NOT NULL,
	"last_message_at" timestamp,
	"last_message_preview" varchar(200),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "event_comment_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"parent_comment_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'registered' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizer_id" integer NOT NULL,
	"shop_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cover_url" text,
	"type" varchar(30) NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(20),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"capacity" integer,
	"is_free" integer DEFAULT 1 NOT NULL,
	"price" numeric(10, 2),
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "kyc_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"type" varchar(30) NOT NULL,
	"siret" varchar(14) NOT NULL,
	"siret_verified" integer DEFAULT 0 NOT NULL,
	"siret_data" text,
	"documents" text,
	"rejection_reason" text,
	"admin_id" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"document_version" varchar(20) NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"conversation_id" integer,
	"type" varchar(20) DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"reply_to_message_id" integer,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"actor_id" integer,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"link" varchar(255),
	"data" text,
	"is_read" integer DEFAULT 0 NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"delivery_method" varchar(50) NOT NULL,
	"delivery_address" text,
	"tracking_number" varchar(255),
	"delivered_at" timestamp,
	"review_requested_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_payment_intent" varchar(255) NOT NULL,
	"stripe_session_id" varchar(255),
	"amount_ht" numeric(10, 2) NOT NULL,
	"amount_tva" numeric(10, 2) NOT NULL,
	"amount_ttc" numeric(10, 2) NOT NULL,
	"tva_rate" numeric(4, 2) NOT NULL,
	"seller_id" integer,
	"seller_stripe_account_id" varchar(255),
	"application_fee_amount" numeric(10, 2),
	"seller_amount" numeric(10, 2),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"invoice_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"parent_comment_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"content" text,
	"media_urls" text,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"shared_from_post_id" integer,
	"shared_event_id" integer,
	"shared_product_id" integer,
	"shared_article_id" integer,
	"share_comment" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"video_urls" text,
	"location" varchar(255),
	"stock" integer DEFAULT 0,
	"has_unlimited_stock" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"delivery_pickup" integer DEFAULT 1 NOT NULL,
	"delivery_shipping" integer DEFAULT 0 NOT NULL,
	"delivery_meeting" integer DEFAULT 0 NOT NULL,
	"meeting_point_address" text,
	"meeting_point_instructions" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" varchar(255),
	"type" varchar(20) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_amount" numeric(10, 2),
	"max_uses" integer,
	"max_uses_per_user" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"is_active" integer DEFAULT 1 NOT NULL,
	"seller_id" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promo_uses" (
	"id" serial PRIMARY KEY NOT NULL,
	"promo_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"device_info" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	CONSTRAINT "push_subscriptions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"requested_by" integer NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"stripe_refund_id" varchar(255),
	"refund_amount" numeric(10, 2),
	"admin_id" integer,
	"admin_comment" text,
	"requested_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_id" integer,
	"admin_note" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"reply_text" text,
	"replied_at" timestamp,
	"is_flagged" integer DEFAULT 0 NOT NULL,
	"flag_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"vacation_mode" integer DEFAULT 0 NOT NULL,
	"vacation_message" text,
	"vacation_until" timestamp,
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"accepts_returns" integer DEFAULT 0 NOT NULL,
	"return_days" integer DEFAULT 14 NOT NULL,
	"shipping_zones" text,
	"contact_phone" varchar(30),
	"contact_email" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shop_settings_shop_id_unique" UNIQUE("shop_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) DEFAULT 'shop-' || substr(md5(random()::text), 1, 12) NOT NULL,
	"description" text,
	"logo_url" text,
	"banner_url" text,
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(20),
	"phone" varchar(30),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "shops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"media_url" text NOT NULL,
	"media_type" varchar(20) DEFAULT 'video' NOT NULL,
	"caption" text,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"elements" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"badge" varchar(50) NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp DEFAULT now(),
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_id" integer NOT NULL,
	"blocked_id" integer NOT NULL,
	"type" varchar(20) DEFAULT 'block' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"device_info" varchar(255),
	"ip_address" varchar(50),
	"user_agent" text,
	"last_active_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_order_updates" integer DEFAULT 1 NOT NULL,
	"email_new_messages" integer DEFAULT 1 NOT NULL,
	"email_social_activity" integer DEFAULT 1 NOT NULL,
	"email_marketing" integer DEFAULT 0 NOT NULL,
	"push_order_updates" integer DEFAULT 1 NOT NULL,
	"push_new_messages" integer DEFAULT 1 NOT NULL,
	"push_social_activity" integer DEFAULT 1 NOT NULL,
	"profile_visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"show_email" integer DEFAULT 0 NOT NULL,
	"show_phone" integer DEFAULT 0 NOT NULL,
	"allow_messages_from" varchar(20) DEFAULT 'everyone' NOT NULL,
	"search_indexable" integer DEFAULT 1 NOT NULL,
	"read_receipts" integer DEFAULT 1 NOT NULL,
	"online_status_visibility" varchar(20) DEFAULT 'everyone' NOT NULL,
	"typing_indicator" integer DEFAULT 1 NOT NULL,
	"call_permissions" varchar(20) DEFAULT 'everyone' NOT NULL,
	"notification_sound" integer DEFAULT 1 NOT NULL,
	"call_ringtone" varchar(50) DEFAULT 'nature' NOT NULL,
	"language" varchar(5) DEFAULT 'fr' NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_2fa" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"secret" varchar(255) NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"backup_codes" text,
	"enabled_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_2fa_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"birth_year" integer,
	"address" varchar(255),
	"city" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100) DEFAULT 'France',
	"avatar_url" text,
	"cover_url" text,
	"bio" text,
	"website" varchar(255),
	"location" varchar(255),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_private" integer DEFAULT 0 NOT NULL,
	"profile_completed" integer DEFAULT 0 NOT NULL,
	"password_hash" varchar(255),
	"provider" varchar(50) DEFAULT 'local' NOT NULL,
	"provider_id" varchar(255),
	"stripe_account_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"stripe_account_status" varchar(50) DEFAULT 'not_connected' NOT NULL,
	"activation_token" varchar(255),
	"activation_token_expires" timestamp,
	"reset_password_token" varchar(255),
	"reset_password_token_expires" timestamp,
	"role" varchar(50) NOT NULL,
	"email_verified" integer DEFAULT 0 NOT NULL,
	"verification_status" varchar(20) DEFAULT 'none' NOT NULL,
	"suspended_until" timestamp,
	"suspension_reason" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

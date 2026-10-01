import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  decimal,
  numeric,
} from "drizzle-orm/pg-core";

// ========================
// USERS
// ========================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  birth_year: integer("birth_year"),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postal_code: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("France"),
  avatar_url: text("avatar_url"),
  cover_url: text("cover_url"),
  bio: text("bio"),
  website: varchar("website", { length: 255 }),
  location: varchar("location", { length: 255 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  is_private: integer("is_private").default(0).notNull(),
  password_hash: varchar("password_hash", { length: 255 }),
  provider: varchar("provider", { length: 50 }).default("local").notNull(),
  provider_id: varchar("provider_id", { length: 255 }),
  stripe_account_id: varchar("stripe_account_id", { length: 255 }),
  stripe_account_status: varchar("stripe_account_status", { length: 50 })
    .default("not_connected")
    .notNull(),
  activation_token: varchar("activation_token", { length: 255 }),
  activation_token_expires: timestamp("activation_token_expires"),
  reset_password_token: varchar("reset_password_token", { length: 255 }),
  reset_password_token_expires: timestamp("reset_password_token_expires"),
  role: varchar("role", { length: 50 }).notNull(),
  email_verified: integer("email_verified").default(0).notNull(),
  verification_status: varchar("verification_status", { length: 20 })
    .default("none")
    .notNull(),
  // 'none' | 'pending' | 'verified' | 'rejected'
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// USER BADGES
// ========================
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  badge: varchar("badge", { length: 50 }).notNull(),
  // 'verified' | 'agriculteur' | 'artisan' | 'createur' | 'bio' | 'producteur_local'
  granted_by: integer("granted_by"),
  granted_at: timestamp("granted_at").defaultNow(),
  revoked_at: timestamp("revoked_at"),
});

// ========================
// CATEGORIES
// ========================
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 100 }),
  image_url: text("image_url"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// SHOPS
// ========================
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  owner_id: integer("owner_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logo_url: text("logo_url"),
  banner_url: text("banner_url"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postal_code: varchar("postal_code", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// SHOP CATEGORIES
// ========================
export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  shop_id: integer("shop_id").notNull(),
  category_id: integer("category_id").notNull(),
});

// ========================
// PRODUCTS
// ========================
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shop_id: integer("shop_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  image_url: text("image_url"),
  location: varchar("location", { length: 255 }),
  stock: integer("stock").default(0),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// ORDERS
// ========================
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyer_id: integer("buyer_id").notNull(),
  seller_id: integer("seller_id").notNull(),
  total_price: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  delivery_method: varchar("delivery_method", { length: 50 }).notNull(),
  delivery_address: text("delivery_address"),
  tracking_number: varchar("tracking_number", { length: 255 }),
  delivered_at: timestamp("delivered_at"),
  review_requested_at: timestamp("review_requested_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// ORDER ITEMS
// ========================
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull(),
  product_id: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unit_price: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
});

// ========================
// REVIEWS
// ========================
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull(),
  product_id: integer("product_id").notNull(),
  author_id: integer("author_id").notNull(),
  seller_id: integer("seller_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  is_flagged: integer("is_flagged").default(0).notNull(),
  flag_reason: text("flag_reason"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// REVIEW REPORTS
// ========================
export const reviewReports = pgTable("review_reports", {
  id: serial("id").primaryKey(),
  review_id: integer("review_id").notNull(),
  reporter_id: integer("reporter_id").notNull(),
  reason: text("reason").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// CONTACT REQUESTS
// ========================
export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  buyer_id: integer("buyer_id").notNull(),
  seller_id: integer("seller_id").notNull(),
  product_id: integer("product_id"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ============================================================
// MESSAGERIE
// ============================================================

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).default("direct").notNull(),
  name: varchar("name", { length: 255 }),
  avatar_url: text("avatar_url"),
  created_by: integer("created_by").notNull(),
  last_message_at: timestamp("last_message_at"),
  last_message_preview: varchar("last_message_preview", { length: 200 }),
  created_at: timestamp("created_at").defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversation_id: integer("conversation_id").notNull(),
    user_id: integer("user_id").notNull(),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    joined_at: timestamp("joined_at").defaultNow(),
    left_at: timestamp("left_at"),
    last_read_at: timestamp("last_read_at"),
    last_read_message_id: integer("last_read_message_id"),
    muted: integer("muted").default(0).notNull(),
  }
);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sender_id: integer("sender_id").notNull(),
  conversation_id: integer("conversation_id"),
  type: varchar("type", { length: 20 }).default("text").notNull(),
  content: text("content").notNull(),
  media_url: text("media_url"),
  reply_to_message_id: integer("reply_to_message_id"),
  edited_at: timestamp("edited_at"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const messageReads = pgTable("message_reads", {
  id: serial("id").primaryKey(),
  message_id: integer("message_id").notNull(),
  user_id: integer("user_id").notNull(),
  read_at: timestamp("read_at").defaultNow().notNull(),
});

export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  message_id: integer("message_id").notNull(),
  user_id: integer("user_id").notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// NOTIFICATIONS
// ========================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  link: varchar("link", { length: 255 }),
  data: text("data"),
  is_read: integer("is_read").default(0).notNull(),
  read_at: timestamp("read_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// KYC REQUESTS
// ========================
export const kycRequests = pgTable("kyc_requests", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  siret: varchar("siret", { length: 14 }).notNull(),
  siret_verified: integer("siret_verified").default(0).notNull(),
  siret_data: text("siret_data"),
  documents: text("documents"),
  rejection_reason: text("rejection_reason"),
  admin_id: integer("admin_id"),
  reviewed_at: timestamp("reviewed_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// PUSH SUBSCRIPTIONS
// ========================
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  platform: varchar("platform", { length: 20 }).notNull(),
  device_info: varchar("device_info", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  last_used_at: timestamp("last_used_at").defaultNow(),
});

// ========================
// PAYMENTS
// ========================
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull(),
  user_id: integer("user_id").notNull(),
  stripe_payment_intent: varchar("stripe_payment_intent", { length: 255 }).notNull(),
  stripe_session_id: varchar("stripe_session_id", { length: 255 }),
  amount_ht: decimal("amount_ht", { precision: 10, scale: 2 }).notNull(),
  amount_tva: decimal("amount_tva", { precision: 10, scale: 2 }).notNull(),
  amount_ttc: decimal("amount_ttc", { precision: 10, scale: 2 }).notNull(),
  tva_rate: decimal("tva_rate", { precision: 4, scale: 2 }).notNull(),
  seller_id: integer("seller_id"),
  seller_stripe_account_id: varchar("seller_stripe_account_id", { length: 255 }),
  application_fee_amount: decimal("application_fee_amount", { precision: 10, scale: 2 }),
  seller_amount: decimal("seller_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  invoice_url: text("invoice_url"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// REFUND REQUESTS
// ========================
export const refundRequests = pgTable("refund_requests", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull(),
  payment_id: integer("payment_id").notNull(),
  requested_by: integer("requested_by").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  stripe_refund_id: varchar("stripe_refund_id", { length: 255 }),
  refund_amount: decimal("refund_amount", { precision: 10, scale: 2 }),
  admin_id: integer("admin_id"),
  admin_comment: text("admin_comment"),
  requested_at: timestamp("requested_at").defaultNow(),
  processed_at: timestamp("processed_at"),
});

// ============================================================
// RÉSEAU SOCIAL
// ============================================================

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  author_id: integer("author_id").notNull(),
  content: text("content"),
  media_urls: text("media_urls"),
  visibility: varchar("visibility", { length: 20 }).default("public").notNull(),
  shared_from_post_id: integer("shared_from_post_id"),
  share_comment: text("share_comment"),
  likes_count: integer("likes_count").default(0).notNull(),
  comments_count: integer("comments_count").default(0).notNull(),
  shares_count: integer("shares_count").default(0).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  post_id: integer("post_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").notNull(),
  author_id: integer("author_id").notNull(),
  content: text("content").notNull(),
  parent_comment_id: integer("parent_comment_id"),
  created_at: timestamp("created_at").defaultNow(),
});

export const postShares = pgTable("post_shares", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").notNull(),
  user_id: integer("user_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requester_id: integer("requester_id").notNull(),
  receiver_id: integer("receiver_id").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  responded_at: timestamp("responded_at"),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  follower_id: integer("follower_id").notNull(),
  shop_id: integer("shop_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ============================================================
// PARAMÈTRES
// ============================================================

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().unique(),
  email_order_updates: integer("email_order_updates").default(1).notNull(),
  email_new_messages: integer("email_new_messages").default(1).notNull(),
  email_social_activity: integer("email_social_activity").default(1).notNull(),
  email_marketing: integer("email_marketing").default(0).notNull(),
  push_order_updates: integer("push_order_updates").default(1).notNull(),
  push_new_messages: integer("push_new_messages").default(1).notNull(),
  push_social_activity: integer("push_social_activity").default(1).notNull(),
  profile_visibility: varchar("profile_visibility", { length: 20 })
    .default("public")
    .notNull(),
  show_email: integer("show_email").default(0).notNull(),
  show_phone: integer("show_phone").default(0).notNull(),
  allow_messages_from: varchar("allow_messages_from", { length: 20 })
    .default("everyone")
    .notNull(),
  search_indexable: integer("search_indexable").default(1).notNull(),
  language: varchar("language", { length: 5 }).default("fr").notNull(),
  timezone: varchar("timezone", { length: 50 })
    .default("Europe/Paris")
    .notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const shopSettings = pgTable("shop_settings", {
  id: serial("id").primaryKey(),
  shop_id: integer("shop_id").notNull().unique(),
  vacation_mode: integer("vacation_mode").default(0).notNull(),
  vacation_message: text("vacation_message"),
  vacation_until: timestamp("vacation_until"),
  is_hidden: integer("is_hidden").default(0).notNull(),
  accepts_returns: integer("accepts_returns").default(0).notNull(),
  return_days: integer("return_days").default(14).notNull(),
  shipping_zones: text("shipping_zones"),
  contact_phone: varchar("contact_phone", { length: 30 }),
  contact_email: varchar("contact_email", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  token_hash: varchar("token_hash", { length: 255 }).notNull(),
  device_info: varchar("device_info", { length: 255 }),
  ip_address: varchar("ip_address", { length: 50 }),
  user_agent: text("user_agent"),
  last_active_at: timestamp("last_active_at").defaultNow(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const legalAcceptances = pgTable("legal_acceptances", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  document_type: varchar("document_type", { length: 50 }).notNull(),
  document_version: varchar("document_version", { length: 20 }).notNull(),
  accepted_at: timestamp("accepted_at").defaultNow().notNull(),
  ip_address: varchar("ip_address", { length: 50 }),
});

export const dataExportRequests = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  file_url: text("file_url"),
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  expires_at: timestamp("expires_at"),
});

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  scheduled_deletion_at: timestamp("scheduled_deletion_at").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// CONTENT REPORTS
// ========================
export const contentReports = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  reporter_id: integer("reporter_id").notNull(),
  target_type: varchar("target_type", { length: 20 }).notNull(),
  target_id: integer("target_id").notNull(),
  reason: varchar("reason", { length: 30 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  admin_id: integer("admin_id"),
  admin_note: text("admin_note"),
  content_deleted: integer("content_deleted").default(0).notNull(),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// EVENTS
// ========================
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  organizer_id: integer("organizer_id").notNull(),
  shop_id: integer("shop_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cover_url: text("cover_url"),
  type: varchar("type", { length: 30 }).notNull(),
  start_at: timestamp("start_at").notNull(),
  end_at: timestamp("end_at"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postal_code: varchar("postal_code", { length: 20 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  capacity: integer("capacity"),
  is_free: integer("is_free").default(1).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).default("published").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ========================
// EVENT REGISTRATIONS
// ========================
export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  event_id: integer("event_id").notNull(),
  user_id: integer("user_id").notNull(),
  status: varchar("status", { length: 20 }).default("registered").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// ARTICLES
// ========================
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  author_id: integer("author_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: varchar("excerpt", { length: 500 }),
  content: text("content").notNull(),
  cover_url: text("cover_url"),
  tags: text("tags"),
  category: varchar("category", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).default("published").notNull(),
  published_at: timestamp("published_at"),
  views_count: integer("views_count").default(0).notNull(),
  likes_count: integer("likes_count").default(0).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ========================
// ARTICLE LIKES
// ========================
export const articleLikes = pgTable("article_likes", {
  id: serial("id").primaryKey(),
  article_id: integer("article_id").notNull(),
  user_id: integer("user_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// CARTS (panier)
// ========================
export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  product_id: integer("product_id").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ========================
// WISHLISTS (favoris produits)
// ========================
export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  product_id: integer("product_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// PROMO CODES (codes de reduction)
// ========================
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  type: varchar("type", { length: 20 }).notNull(),
  // 'percent' | 'fixed'
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  min_amount: decimal("min_amount", { precision: 10, scale: 2 }),
  max_uses: integer("max_uses"),
  max_uses_per_user: integer("max_uses_per_user"),
  uses_count: integer("uses_count").default(0).notNull(),
  valid_from: timestamp("valid_from").defaultNow(),
  valid_until: timestamp("valid_until"),
  is_active: integer("is_active").default(1).notNull(),
  seller_id: integer("seller_id"),
  // null = plateforme entiere, sinon code d'un vendeur
  created_by: integer("created_by").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// PROMO USES (utilisations)
// ========================
export const promoUses = pgTable("promo_uses", {
  id: serial("id").primaryKey(),
  promo_id: integer("promo_id").notNull(),
  user_id: integer("user_id").notNull(),
  order_id: integer("order_id"),
  used_at: timestamp("used_at").defaultNow(),
});
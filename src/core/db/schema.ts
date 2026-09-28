import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";

// ========================
// USERS
// ========================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),

  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  birth_year: integer("birth_year"),

  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postal_code: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("France"),

  password_hash: varchar("password_hash", { length: 255 }),

  provider: varchar("provider", { length: 50 }).default("local").notNull(),
  provider_id: varchar("provider_id", { length: 255 }),
  avatar_url: text("avatar_url"),

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
  created_at: timestamp("created_at").defaultNow(),
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
// REVIEWS (avis clients)
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
// REVIEW REPORTS (signalements)
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

// ========================
// COMMENTS
// ========================
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").notNull(),
  user_id: integer("user_id").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// MESSAGES
// ========================
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sender_id: integer("sender_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  group_id: integer("group_id"),
  receiver_id: integer("receiver_id"),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ========================
// NOTIFICATIONS
// ========================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'order', 'review', 'message', 'system'
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  link: varchar("link", { length: 255 }),
  data: text("data"),
  is_read: integer("is_read").default(0).notNull(),
  read_at: timestamp("read_at"),
  created_at: timestamp("created_at").defaultNow(),
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
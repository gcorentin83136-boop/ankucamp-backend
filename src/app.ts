import express, { raw } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";

import authRoutes from "./core/api/auth/auth.routes";
import twoFactorRoutes from "./core/api/auth/2fa/2fa.routes";
import usersRoutes from "./core/api/users/users.routes";
import healthRoutes from "./core/api/health/health.routes";
import shopsRoutes from "./core/api/shops/shops.routes";
import productsRoutes from "./core/api/products/products.routes";
import ordersRoutes from "./core/api/orders/orders.routes";
import notificationsRoutes from "./core/api/notifications/notifications.routes";
import uploadsRoutes from "./core/api/uploads/uploads.routes";
import paymentsRoutes from "./core/api/payments/payments.routes";
import refundsRoutes from "./core/api/refunds/refunds.routes";
import reviewsRoutes from "./core/api/reviews/reviews.routes";
import postsRoutes from "./core/api/posts/posts.routes";
import friendsRoutes from "./core/api/friends/friends.routes";
import followsRoutes from "./core/api/follows/follows.routes";
import shareRoutes from "./core/api/share/share.routes";
import settingsRoutes from "./core/api/settings/settings.routes";
import conversationsRoutes, {
  messagesRouter as messagesApi,
} from "./core/api/conversations/conversations.routes";
import searchRoutes from "./core/api/search/search.routes";
import dashboardRoutes from "./core/api/dashboard/dashboard.routes";
import kycRoutes from "./core/api/kyc/kyc.routes";
import kycAdminRoutes from "./core/api/kyc/kyc.admin.routes";
import badgesRoutes from "./core/api/badges/badges.routes";
import reportsRoutes from "./core/api/moderation/reports.routes";
import reportsAdminRoutes from "./core/api/moderation/reports.admin.routes";
import geoRoutes from "./core/api/geo/geo.routes";
import eventsRoutes from "./core/api/events/events.routes";
import articlesRoutes from "./core/api/articles/articles.routes";
import cartRoutes from "./core/api/cart/cart.routes";
import wishlistRoutes from "./core/api/wishlist/wishlist.routes";
import promoRoutes from "./core/api/promo/promo.routes";
import promoAdminRoutes from "./core/api/promo/promo.admin.routes";
import promoSellerRoutes from "./core/api/promo/promo.seller.routes";
import categoriesRoutes from "./core/api/categories/categories.routes";
import categoriesAdminRoutes from "./core/api/categories/categories.admin.routes";
import auditRoutes from "./core/api/audit/audit.routes";
import backupRoutes from "./core/api/backup/backup.routes";

import { errorHandler } from "./core/errors/errorHandler";
import { globalLimiter } from "./config/security";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { passport } from "./config/passport";
import { sentryUserMiddleware } from "./config/sentry";

const app = express();

// ===============
// SÉCURITÉ
// ===============
app.use(helmet());

app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
          ]
        : ["https://ankucamp.com"],
    credentials: true,
  })
);

app.use(globalLimiter);

// ===============
// LOGS HTTP
// ===============
app.use(
  pinoHttp({
    logger,
    autoLogging:
      env.NODE_ENV === "development"
        ? { ignore: (req) => req.url === "/health" || req.url === "/" }
        : true,
  })
);

// ===============
// STRIPE WEBHOOK (AVANT express.json !)
// ===============
app.use("/payments/webhook", raw({ type: "application/json" }));

// ===============
// PARSERS
// ===============
app.use(express.json({ limit: "1mb" }));

// ===============
// SENTRY — attache le user au contexte (si dispo)
// ===============
app.use(sentryUserMiddleware);

// ===============
// STRIPE (autres routes)
// ===============
app.use("/payments", paymentsRoutes);

// ===============
// PASSPORT (OAuth)
// ===============
app.use(
  session({
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ===============
// ROUTE DE TEST
// ===============
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "ANKUCAMP API running",
    timestamp: new Date().toISOString(),
  });
});

// ===============
// ROUTES
// ===============

// ⚠️ /auth/2fa AVANT /auth (ordre important !)
app.use("/auth/2fa", twoFactorRoutes);
app.use("/auth", authRoutes);

app.use("/health", healthRoutes);
app.use("/users", usersRoutes);
app.use("/users", badgesRoutes);
app.use("/shops", shopsRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/messages", messagesApi);
app.use("/notifications", notificationsRoutes);
app.use("/uploads", uploadsRoutes);
app.use("/refunds", refundsRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/posts", postsRoutes);
app.use("/friends", friendsRoutes);
app.use("/follows", followsRoutes);
app.use("/share", shareRoutes);
app.use("/settings", settingsRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/search", searchRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/kyc", kycRoutes);
app.use("/admin/kyc", kycAdminRoutes);
app.use("/reports", reportsRoutes);
app.use("/admin/moderation", reportsAdminRoutes);
app.use("/geo", geoRoutes);
app.use("/events", eventsRoutes);
app.use("/articles", articlesRoutes);
app.use("/cart", cartRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/promo/my", promoSellerRoutes);
app.use("/promo", promoRoutes);
app.use("/admin/promo", promoAdminRoutes);
app.use("/categories", categoriesRoutes);
app.use("/admin/categories", categoriesAdminRoutes);
app.use("/admin/audit", auditRoutes);
app.use("/admin/backup", backupRoutes);

// ===============
// 404
// ===============
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
  });
});

// ===============
// ERROR HANDLER
// ===============
app.use(errorHandler);

export default app;
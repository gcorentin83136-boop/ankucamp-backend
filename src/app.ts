import express, { raw } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";

import authRoutes from "./core/api/auth/auth.routes";
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

import { errorHandler } from "./core/errors/errorHandler";
import { globalLimiter } from "./config/security";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { passport } from "./config/passport";

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
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
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
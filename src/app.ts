import express from "express";
import cors from "cors";

import authRoutes from "./core/api/auth/auth.routes";
import usersRoutes from "./core/api/users/users.routes";
import healthRoutes from "./core/api/health/health.routes";
import shopsRoutes from "./core/api/shops/shops.routes";
import productsRoutes from "./core/api/products/products.routes";
import ordersRoutes from "./core/api/orders/orders.routes";
import messagesRoutes from "./core/api/messages/messages.routes";
import notificationsRoutes from "./core/api/notifications/notifications.routes";

import { errorHandler } from "./core/errors/errorHandler";

const app = express();

// ===============
// MIDDLEWARES
// ===============
app.use(cors());
app.use(express.json());

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
app.use("/messages", messagesRoutes);
app.use("/notifications", notificationsRoutes);

// ===============
// 404 (route non trouvée)
// ===============
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
  });
});

// ===============
// ERROR HANDLER (EN DERNIER, TOUJOURS)
// ===============
app.use(errorHandler);

export default app;
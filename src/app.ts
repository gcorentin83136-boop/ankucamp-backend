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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "ANKUCAMP API running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/shops", shopsRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/messages", messagesRoutes);
app.use("/notifications", notificationsRoutes);

export default app;
import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createOrderSchema, updateStatusSchema } from "./orders.validation";
import {
  getOrdersByBuyer,
  getOrdersBySeller,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} from "./orders.service";

export async function listMyOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getOrdersByBuyer(req.user.id);
  return res.json({ success: true, orders: list });
}

export async function listSellerOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getOrdersBySeller(req.user.id);
  return res.json({ success: true, orders: list });
}

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  const order = await getOrderById(id);
  if (!order) throw new AppError("Commande introuvable", 404);

  if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
    throw new AppError("Accès interdit", 403);
  }

  return res.json({ success: true, order });
}

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const order = await createOrder(req.user.id, parsed.data);

  return res.status(201).json({ success: true, message: "Commande créée", order });
}

export async function updateStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const order = await updateOrderStatus(id, req.user.id, parsed.data.status);
  return res.json({ success: true, message: "Statut mis à jour", order });
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  await deleteOrder(id, req.user.id);
  return res.status(204).send();
}
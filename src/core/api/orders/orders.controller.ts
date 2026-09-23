import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
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
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });
  const list = await getOrdersByBuyer(req.user.id);
  return res.json({ success: true, orders: list });
}

export async function listSellerOrders(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });
  const list = await getOrdersBySeller(req.user.id);
  return res.json({ success: true, orders: list });
}

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  const order = await getOrderById(id);
  if (!order) return res.status(404).json({ success: false, message: "Commande introuvable" });

  if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Accès interdit" });
  }

  return res.json({ success: true, order });
}

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const order = await createOrder(req.user.id, parsed.data);
    return res.status(201).json({ success: true, message: "Commande créée", order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return res.status(400).json({ success: false, message });
  }
}

export async function updateStatus(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const order = await updateOrderStatus(id, req.user.id, parsed.data.status);
    return res.json({ success: true, message: "Statut mis à jour", order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("accès") || message.includes("Seul") ? 403 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  try {
    await deleteOrder(id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("Seul") ? 403 : 400;
    return res.status(status).json({ success: false, message });
  }
}
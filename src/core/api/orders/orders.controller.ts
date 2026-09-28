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
  resendInvoiceService,
} from "./orders.service";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orders, payments } from "../../db/schema";

// ============================================================
// LISTE
// ============================================================

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

// ============================================================
// LECTURE
// ============================================================

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

// ============================================================
// CRÉATION
// ============================================================

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const order = await createOrder(req.user.id, parsed.data);

  return res.status(201).json({ success: true, message: "Commande créée", order });
}

// ============================================================
// MISE À JOUR STATUT
// ============================================================

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

// ============================================================
// SUPPRESSION
// ============================================================

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  await deleteOrder(id, req.user.id);
  return res.status(204).send();
}

// ============================================================
// 📄 TÉLÉCHARGEMENT FACTURE PDF
// ============================================================

/**
 * GET /orders/:id/invoice
 * Redirige vers la facture PDF stockée sur Cloudinary.
 */
export async function downloadInvoice(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const orderId = Number(req.params.id);
  if (isNaN(orderId) || orderId <= 0) {
    throw new AppError("ID commande invalide", 400);
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);

  if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
    throw new AppError("Vous n'avez pas accès à cette facture", 403);
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment || !payment.invoice_url) {
    throw new AppError("Facture non disponible pour cette commande", 404);
  }

  return res.redirect(payment.invoice_url);
}

// ============================================================
// 📧 RENVOI FACTURE PAR EMAIL
// ============================================================

/**
 * POST /orders/:id/invoice/resend
 * Renvoie la facture PDF par email.
 * - Acheteur : reçoit la facture à sa propre adresse
 * - Vendeur  : envoie la facture à l'acheteur
 */
export async function resendInvoice(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const orderId = Number(req.params.id);
  if (isNaN(orderId) || orderId <= 0) {
    throw new AppError("ID commande invalide", 400);
  }

  const result = await resendInvoiceService(orderId, req.user.id);

  return res.json({
    success: true,
    message: `Facture envoyée à ${result.sentTo}`,
    sentTo: result.sentTo,
    invoiceNumber: result.invoiceNumber,
  });
}
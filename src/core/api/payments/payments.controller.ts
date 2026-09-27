import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createCheckoutSchema } from "./payments.validation";
import {
  createCheckoutSession,
  getPaymentsByUser,
  getPaymentByOrder,
  handleStripeEvent,
  createConnectOnboardingLink,
  getConnectStatus,
} from "./payments.service";
import { stripe } from "../../../config/stripe";
import { env } from "../../../config/env";

// ============================================================
// POST /payments/checkout
// ============================================================
export async function checkout(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const { url, sessionId } = await createCheckoutSession(
    req.user.id,
    parsed.data.order_id
  );

  return res.status(201).json({
    success: true,
    message: "Session de paiement créée",
    url,
    session_id: sessionId,
  });
}

// ============================================================
// POST /payments/webhook
// ============================================================
export async function webhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    throw new AppError("Signature Stripe manquante", 400);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature invalide";
    throw new AppError(`Webhook signature invalide : ${message}`, 400);
  }

  await handleStripeEvent(event as any);

  return res.json({ received: true });
}

// ============================================================
// GET /payments/me
// ============================================================
export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getPaymentsByUser(req.user.id);
  return res.json({ success: true, payments: list });
}

// ============================================================
// GET /payments/order/:orderId
// ============================================================
export async function getOneByOrder(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const orderId = Number(req.params.orderId);
  if (isNaN(orderId)) throw new AppError("orderId invalide", 400);

  const payment = await getPaymentByOrder(orderId, req.user.id);
  return res.json({ success: true, payment });
}

// ============================================================
// POST /payments/connect/onboard
// ============================================================
export async function onboardConnect(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const url = await createConnectOnboardingLink(req.user.id);

  return res.json({
    success: true,
    message: "Lien d'onboarding Stripe généré",
    onboarding_url: url,
  });
}

// ============================================================
// GET /payments/connect/status
// ============================================================
export async function connectStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const status = await getConnectStatus(req.user.id);

  return res.json({ success: true, ...status });
}
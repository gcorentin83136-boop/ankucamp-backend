import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createReviewSchema,
  reportReviewSchema,
  listReviewsQuerySchema,
  replyReviewSchema,
  updateReviewSchema,
} from "./reviews.validation";
import {
  createReview,
  getReviewsByProduct,
  getReviewsBySeller,
  getMyReviews,
  getProductRatingStats,
  deleteReview,
  reportReview,
  replyToReview,
  updateReview,
} from "./reviews.service";

// ============================================================
// POST /reviews — Créer un avis
// ============================================================

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const review = await createReview(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Avis créé",
    review,
  });
}

// ============================================================
// GET /reviews/product/:id — Avis d'un produit (public)
// ============================================================

export async function listByProduct(req: AuthRequest, res: Response) {
  const productId = Number(req.params.id);
  if (isNaN(productId) || productId <= 0) {
    throw new AppError("ID produit invalide", 400);
  }

  const parsed = listReviewsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const reviews = await getReviewsByProduct(productId, parsed.data);

  return res.json({
    success: true,
    count: reviews.length,
    reviews,
  });
}

// ============================================================
// GET /reviews/product/:id/stats — Stats d'un produit (public)
// ============================================================

export async function productStats(req: AuthRequest, res: Response) {
  const productId = Number(req.params.id);
  if (isNaN(productId) || productId <= 0) {
    throw new AppError("ID produit invalide", 400);
  }

  const stats = await getProductRatingStats(productId);

  return res.json({
    success: true,
    stats,
  });
}

// ============================================================
// GET /reviews/seller/me — Avis reçus (vendeur)
// ============================================================

export async function listSellerReviews(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listReviewsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const reviews = await getReviewsBySeller(req.user.id, parsed.data);

  return res.json({
    success: true,
    count: reviews.length,
    reviews,
  });
}

// ============================================================
// GET /reviews/me — Mes avis (auteur)
// ============================================================

export async function listMyReviews(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const reviews = await getMyReviews(req.user.id);

  return res.json({
    success: true,
    count: reviews.length,
    reviews,
  });
}

// ============================================================
// DELETE /reviews/:id — Supprimer son avis
// ============================================================

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId) || reviewId <= 0) {
    throw new AppError("ID avis invalide", 400);
  }

  await deleteReview(reviewId, req.user.id);

  return res.status(204).send();
}

// ============================================================
// POST /reviews/:id/report — Signaler un avis (vendeur)
// ============================================================

export async function report(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId) || reviewId <= 0) {
    throw new AppError("ID avis invalide", 400);
  }

  const parsed = reportReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  await reportReview(reviewId, req.user.id, parsed.data.reason);

  return res.json({
    success: true,
    message: "Avis signalé. Il sera masqué en attendant vérification.",
  });
}

// ============================================================
// POST /reviews/:id/reply - Réponse vendeur
// ============================================================
export async function reply(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId) || reviewId <= 0) {
    throw new AppError("ID avis invalide", 400);
  }

  const parsed = replyReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const review = await replyToReview(reviewId, req.user.id, parsed.data.reply_text);

  return res.json({
    success: true,
    message: "Réponse publiée",
    review,
  });
}

// ============================================================
// PUT /reviews/:id - Modifier son avis (auteur)
// ============================================================
export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId) || reviewId <= 0) {
    throw new AppError("ID avis invalide", 400);
  }

  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const review = await updateReview(reviewId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Avis modifié",
    review,
  });
}
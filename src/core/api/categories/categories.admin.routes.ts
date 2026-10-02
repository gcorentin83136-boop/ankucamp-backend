import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { AppError } from "../../errors/AppError";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./categories.validation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories.service";
import { logAdminActionAsync } from "../audit/audit.helper";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.post(
  "/",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Données invalides",
        400,
        parsed.error.flatten().fieldErrors
      );
    }
    const cat = await createCategory(parsed.data);

    // 📝 Audit log
    logAdminActionAsync({
      adminId: req.user!.id,
      action: "category_create",
      targetType: "category",
      targetId: cat.id,
      description: `Catégorie "${cat.name}" créée`,
      metadata: { name: cat.name, slug: cat.slug },
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    return res.status(201).json({ success: true, category: cat });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Données invalides",
        400,
        parsed.error.flatten().fieldErrors
      );
    }
    const cat = await updateCategory(id, parsed.data);

    // 📝 Audit log
    logAdminActionAsync({
      adminId: req.user!.id,
      action: "category_update",
      targetType: "category",
      targetId: id,
      description: `Catégorie #${id} modifiée`,
      metadata: { updates: parsed.data },
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    return res.json({ success: true, category: cat });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
    await deleteCategory(id);

    // 📝 Audit log
    logAdminActionAsync({
      adminId: req.user!.id,
      action: "category_delete",
      targetType: "category",
      targetId: id,
      description: `Catégorie #${id} supprimée`,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    return res.status(204).send();
  })
);

export default router;
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
    return res.json({ success: true, category: cat });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
    await deleteCategory(id);
    return res.status(204).send();
  })
);

export default router;
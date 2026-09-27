import { Request, Response } from "express";
import {
  registerSchema,
  loginSchema,
  activateAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";
import {
  registerUser,
  loginUser,
  activateAccount,
  forgotPassword,
  resetPassword,
} from "./auth.service";
import { AppError } from "../../errors/AppError";

// ============================================================
// POST /auth/register
// ============================================================
export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const user = await registerUser(parsed.data);

  return res.status(201).json({
    success: true,
    message: "Compte créé avec succès",
    user,
  });
}

// ============================================================
// POST /auth/login
// ============================================================
export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const { user, token } = await loginUser(parsed.data);

  return res.status(200).json({
    success: true,
    message: "Connexion réussie",
    user,
    token,
  });
}

// ============================================================
// POST /auth/activate
// ============================================================
export async function activate(req: Request, res: Response) {
  const parsed = activateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const result = await activateAccount(parsed.data.token);
  return res.json(result);
}

// ============================================================
// POST /auth/forgot-password
// ============================================================
export async function forgot(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const result = await forgotPassword(parsed.data.email);
  return res.json(result);
}

// ============================================================
// POST /auth/reset-password
// ============================================================
export async function reset(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const result = await resetPassword(
    parsed.data.token,
    parsed.data.new_password
  );
  return res.json(result);
}
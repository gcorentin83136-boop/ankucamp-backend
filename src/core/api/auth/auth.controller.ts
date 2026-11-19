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
  logoutUser,
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
// Si 2FA activée → renvoie { requires_2fa: true, temp_token }
// Sinon → renvoie { user, token }
// ============================================================
export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const result = await loginUser(parsed.data, req);

  // Cas 2FA : le client doit appeler /auth/2fa/validate ensuite
  if ("requires_2fa" in result && result.requires_2fa) {
    return res.status(200).json({
      success: true,
      requires_2fa: true,
      temp_token: result.temp_token,
      message: "Saisis ton code 2FA pour finaliser la connexion",
    });
  }

  // Cas normal
  return res.status(200).json({
    success: true,
    message: "Connexion réussie",
    user: result.user,
    token: result.token,
  });
}

// ============================================================
// POST /auth/logout
// ============================================================
export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Token manquant", 401);
  }

  const token = authHeader.slice(7);
  const result = await logoutUser(token);

  return res.json(result);
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
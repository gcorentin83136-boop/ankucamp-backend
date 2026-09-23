import { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.validation";
import { registerUser, loginUser } from "./auth.service";

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await registerUser(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Compte créé avec succès",
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur";
    return res.status(400).json({ success: false, message });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const { user, token } = await loginUser(parsed.data);
    return res.status(200).json({
      success: true,
      message: "Connexion réussie",
      user,
      token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur";
    return res.status(401).json({ success: false, message });
  }
}
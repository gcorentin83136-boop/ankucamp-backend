import { z } from "zod";

// Setup : juste le code TOTP (le secret est généré côté serveur)
export const verify2FASetupSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres"),
});
export type Verify2FASetupInput = z.infer<typeof verify2FASetupSchema>;

// Désactivation : password + code TOTP ou backup code
export const disable2FASchema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  code: z.string().min(6).max(20, "Code invalide"),
});
export type Disable2FAInput = z.infer<typeof disable2FASchema>;

// Étape 2 du login
export const validate2FALoginSchema = z.object({
  temp_token: z.string().min(10, "Token temporaire requis"),
  code: z.string().min(6).max(20, "Code invalide"),
});
export type Validate2FALoginInput = z.infer<typeof validate2FALoginSchema>;
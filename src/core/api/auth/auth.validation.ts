import { z } from "zod";

const currentYear = new Date().getFullYear();

export const registerSchema = z.object({
  // Identité
  first_name: z.string().min(2, "Le prénom doit faire au moins 2 caractères").max(100),
  last_name: z.string().min(2, "Le nom doit faire au moins 2 caractères").max(100),
  email: z.string().email("Email invalide"),
  birth_year: z
    .number()
    .int()
    .min(1900, "Année de naissance invalide")
    .max(currentYear - 13, "Tu dois avoir au moins 13 ans"),

  // Adresse
  address: z.string().min(5, "Adresse trop courte").max(255),
  city: z.string().min(2).max(100),
  postal_code: z.string().min(3).max(20),
  country: z.string().min(2).max(100).default("France"),

  // Auth
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),

  // Rôle
  role: z.enum(["professionnel", "particulier"], {
    errorMap: () => ({ message: "Rôle invalide (professionnel ou particulier)" }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
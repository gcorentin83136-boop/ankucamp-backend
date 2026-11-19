import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères").max(100),
  email: z.string().email("Email invalide"),
  subject: z.string().min(3, "Le sujet est trop court").max(200),
  message: z
    .string()
    .min(10, "Le message doit faire au moins 10 caractères")
    .max(5000, "Le message est trop long"),
});

export type ContactInput = z.infer<typeof contactSchema>;

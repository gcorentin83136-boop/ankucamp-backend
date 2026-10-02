import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_test_").or(z.string().startsWith("sk_live_")),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Marketplace
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(2.5),

  // Firebase Cloud Messaging (push notifications)
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().min(100, "Service account Firebase manquant"),

  // Brevo (emails)
  BREVO_API_KEY: z.string().startsWith("xkeysib-"),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().min(1),

  // Sentry (optionnel — désactivé si absent)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables d'environnement invalides :");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
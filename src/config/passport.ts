import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { users } from "../core/db/schema";
import { env } from "./env";
import { generateUsername } from "../core/utils/username";

// ============================================================
// HELPER : adapte un user DB au type Express.User (= TokenPayload)
// ============================================================
type UserRole = "professionnel" | "particulier";

function toExpressUser(user: {
  id: number;
  email: string;
  role: string;
  [key: string]: unknown;
}) {
  return {
    ...user,
    role: user.role as UserRole,
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Email Google introuvable"), undefined);
        }

        // 1. Chercher par email
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // 2. Cas 1 : utilisateur existe déjà
        if (existing) {
          // 🔑 Google a déjà vérifié cet email → on le marque comme vérifié
          // ✅ débloque les users email/mdp jamais activés (email_verified = 0)
          // ✅ réactive les comptes désactivés (email_verified = -1)
          const needsEmailFix =
            existing.email_verified === 0 || existing.email_verified === -1;

          const updateData: Record<string, unknown> = {};

          if (existing.provider === "local") {
            updateData.provider = "google";
            updateData.provider_id = profile.id;
            updateData.avatar_url =
              existing.avatar_url ?? profile.photos?.[0]?.value ?? null;
          }

          if (needsEmailFix) {
            updateData.email_verified = 1;
            updateData.activation_token = null;
            updateData.activation_token_expires = null;
          }

          if (Object.keys(updateData).length > 0) {
            await db
              .update(users)
              .set(updateData)
              .where(eq(users.id, existing.id));
          }

          // On recharge le user pour avoir l'état à jour
          const [refreshed] = await db
            .select()
            .from(users)
            .where(eq(users.id, existing.id))
            .limit(1);

          return done(null, toExpressUser(refreshed ?? existing));
        }

        // 3. Cas 2 : nouvel utilisateur → on le crée
        const firstName = profile.name?.givenName ?? "Utilisateur";
        const lastName = profile.name?.familyName ?? "Google";

        // Générer un username unique
        const username = await generateUsername(firstName, lastName);

        const [created] = await db
          .insert(users)
          .values({
            first_name: firstName,
            last_name: lastName,
            username,
            email,
            password_hash: null,
            provider: "google",
            provider_id: profile.id,
            avatar_url: profile.photos?.[0]?.value ?? null,
            role: "particulier",
            email_verified: 1,
          })
          .returning();

        return done(null, toExpressUser(created));
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// ============================================================
// SÉRIALISATION (obligatoire pour Passport même en stateless)
// ============================================================
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as any).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    done(null, user ? toExpressUser(user) : null);
  } catch (err) {
    done(err, null);
  }
});

export { passport };

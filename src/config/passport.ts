import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { users } from "../core/db/schema";
import { env } from "./env";

// ============================================================
// HELPER : adapte un user DB au type Express.User (= TokenPayload)
// ============================================================
type UserRole = "professionnel" | "particulier";

function toExpressUser(user: { id: number; email: string; role: string; [key: string]: unknown }) {
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
          // S'il s'était inscrit avec mot de passe, on met à jour son profil
          // OAuth (sans casser son mdp existant)
          if (existing.provider === "local") {
            await db
              .update(users)
              .set({
                provider: "google",
                provider_id: profile.id,
                avatar_url:
                  existing.avatar_url ?? profile.photos?.[0]?.value ?? null,
              })
              .where(eq(users.id, existing.id));
          }

          return done(null, toExpressUser(existing));
        }

        // 3. Cas 2 : nouvel utilisateur → on le crée
        const [created] = await db
          .insert(users)
          .values({
            first_name: profile.name?.givenName ?? "Utilisateur",
            last_name: profile.name?.familyName ?? "Google",
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
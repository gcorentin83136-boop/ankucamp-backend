import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { signToken } from "../../security/jwt";
import { AppError } from "../../errors/AppError";
import type { RegisterInput, LoginInput } from "./auth.validation";

const SALT_ROUNDS = 10;

/**
 * Crée un nouvel utilisateur.
 */
export async function registerUser(input: RegisterInput) {
  const { full_name, email, password, role } = input;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError("Cet email est déjà utilisé", 400);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const [created] = await db
    .insert(users)
    .values({
      full_name,
      email,
      password_hash,
      role,
    })
    .returning({
      id: users.id,
      full_name: users.full_name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
    });

  return created;
}

/**
 * Authentifie un utilisateur.
 */
export async function loginUser(input: LoginInput) {
  const { email, password } = input;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new AppError("Email ou mot de passe incorrect", 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError("Email ou mot de passe incorrect", 401);
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as "professionnel" | "particulier",
  });

  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    },
    token,
  };
}
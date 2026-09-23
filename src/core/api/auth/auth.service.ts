import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { signToken } from "../../security/jwt";
import { AppError } from "../../errors/AppError";
import type { RegisterInput, LoginInput } from "./auth.validation";

const SALT_ROUNDS = 10;

// Colonnes publiques (jamais de password_hash)
const publicColumns = {
  id: users.id,
  first_name: users.first_name,
  last_name: users.last_name,
  email: users.email,
  birth_year: users.birth_year,
  address: users.address,
  city: users.city,
  postal_code: users.postal_code,
  country: users.country,
  provider: users.provider,
  avatar_url: users.avatar_url,
  role: users.role,
  email_verified: users.email_verified,
  created_at: users.created_at,
};

export async function registerUser(input: RegisterInput) {
  const { email, password } = input;

  // Vérifier email unique
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError("Cet email est déjà utilisé", 400);
  }

  // Hash du mot de passe
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Insertion (on ignore password pour ne pas le stocker en clair)
  const { password: _password, ...dataWithoutPassword } = input;

  const [created] = await db
    .insert(users)
    .values({
      ...dataWithoutPassword,
      password_hash,
      provider: "local",
    })
    .returning(publicColumns);

  return created;
}

export async function loginUser(input: LoginInput) {
  const { email, password } = input;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.password_hash) {
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
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
    token,
  };
}
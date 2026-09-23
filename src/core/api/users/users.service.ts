import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { AppError } from "../../errors/AppError";

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
  created_at: users.created_at,
};

export async function getUserById(id: number) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

export async function getAllUsers() {
  return db.select(publicColumns).from(users);
}

interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  avatar_url?: string;
}

export async function updateUser(id: number, data: UpdateUserInput) {
  const hasData = Object.values(data).some((v) => v !== undefined);
  if (!hasData) {
    throw new AppError("Aucune donnée à mettre à jour", 400);
  }

  // Vérif unicité email si on le change
  if (data.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new AppError("Cet email est déjà utilisé", 400);
    }
  }

  const [updated] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

// Colonnes publiques (on ne renvoie JAMAIS le password_hash)
const publicColumns = {
  id: users.id,
  full_name: users.full_name,
  email: users.email,
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

export async function updateUser(
  id: number,
  data: { full_name?: string; email?: string }
) {
  // Vérifier qu'il y a bien quelque chose à mettre à jour
  if (!data.full_name && !data.email) {
    throw new Error("Aucune donnée à mettre à jour");
  }

  // Si on change l'email, vérifier qu'il n'est pas déjà pris
  if (data.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new Error("Cet email est déjà utilisé");
    }
  }

  const [updated] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}
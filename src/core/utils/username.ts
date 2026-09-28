import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

/**
 * Nettoie une chaîne pour en faire un username valide :
 * - minuscules
 * - remplace les accents et caractères spéciaux par rien
 * - remplace les espaces par _
 * - garde uniquement [a-z0-9_]
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9\s_]/g, "") // supprime tout sauf lettres/chiffres/espaces/_
    .trim()
    .replace(/\s+/g, "_") // espaces → _
    .replace(/_+/g, "_"); // évite les __ multiples
}

/**
 * Vérifie si un username existe déjà.
 */
async function usernameExists(username: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return !!existing;
}

/**
 * Génère un username unique basé sur le prénom + nom.
 *
 * Stratégie :
 * 1. Essaie `prenom_nom`
 * 2. Si pris, essaie `prenom_nom2`, `prenom_nom3`, etc.
 * 3. Fallback : `user_<random>` si vraiment tout est pris
 *
 * @param firstName - Prénom
 * @param lastName - Nom
 * @returns Username unique (lowercase, [a-z0-9_])
 */
export async function generateUsername(
  firstName: string,
  lastName: string
): Promise<string> {
  const base = slugify(`${firstName}_${lastName}`) || "user";
  let candidate = base;
  let counter = 1;

  // Essaie jusqu'à 100 variantes
  while (await usernameExists(candidate)) {
    counter++;
    candidate = `${base}${counter}`;

    if (counter > 100) {
      // Fallback : user_<random>
      const random = Math.random().toString(36).slice(2, 8);
      candidate = `user_${random}`;
      break;
    }
  }

  return candidate;
}

/**
 * Vérifie qu'un username est valide et disponible.
 * Renvoie true si valide + libre, false sinon.
 */
export async function isUsernameAvailable(
  username: string
): Promise<boolean> {
  // Valide ?
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return false;
  }

  // Libre ?
  return !(await usernameExists(username));
}
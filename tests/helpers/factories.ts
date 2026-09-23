import bcrypt from "bcrypt";
import { testDb } from "./testSetup";
import { users, shops } from "../../src/core/db/schema";
import { signToken } from "../../src/core/security/jwt";

// ============================================================
// FACTORY USERS
// ============================================================

interface CreateUserOptions {
  full_name?: string;
  email: string;
  password?: string;
  role?: "particulier" | "professionnel";
}

export async function createUser(options: CreateUserOptions) {
  const {
    full_name = "Test User",
    email,
    password = "motdepasse123",
    role = "particulier",
  } = options;

  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await testDb
    .insert(users)
    .values({
      full_name,
      email,
      password_hash,
      role,
    })
    .returning();

  // Générer un token prêt à l'emploi
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as "particulier" | "professionnel",
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    password,
    token,
    authorization: `Bearer ${token}`,
  };
}

// ============================================================
// FACTORY SHOPS
// ============================================================

interface CreateShopOptions {
  owner_id: number;
  name?: string;
  description?: string;
  city?: string;
}

export async function createShop(options: CreateShopOptions) {
  const {
    owner_id,
    name = "Test Shop",
    description = "Une boutique de test",
    city = "Paris",
  } = options;

  const [shop] = await testDb
    .insert(shops)
    .values({
      owner_id,
      name,
      description,
      city,
    })
    .returning();

  return shop;
}
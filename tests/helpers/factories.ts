import bcrypt from "bcrypt";
import { testDb } from "./testSetup";
import { users, shops, products, orders, orderItems } from "../../src/core/db/schema";
import { signToken } from "../../src/core/security/jwt";

// ============================================================
// FACTORY USERS
// ============================================================

interface CreateUserOptions {
  first_name?: string;
  last_name?: string;
  email: string;
  password?: string;
  role?: "particulier" | "professionnel";
  birth_year?: number;
  address?: string;
  city?: string;
  postal_code?: string;
}

export async function createUser(options: CreateUserOptions) {
  const {
    first_name = "Test",
    last_name = "User",
    email,
    password = "motdepasse123",
    role = "particulier",
    birth_year = 1990,
    address = "1 rue Test",
    city = "Paris",
    postal_code = "75001",
  } = options;

  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await testDb
    .insert(users)
    .values({
      first_name,
      last_name,
      email,
      password_hash,
      role,
      birth_year,
      address,
      city,
      postal_code,
      provider: "local",
    })
    .returning();

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
    .values({ owner_id, name, description, city })
    .returning();

  return shop;
}

// ============================================================
// FACTORY PRODUCTS
// ============================================================

interface CreateProductOptions {
  shop_id: number;
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  location?: string;
}

export async function createProduct(options: CreateProductOptions) {
  const {
    shop_id,
    name = "Test Product",
    description = "Un produit de test",
    price = 19.99,
    stock = 10,
    location = "Paris",
  } = options;

  const [product] = await testDb
    .insert(products)
    .values({
      shop_id,
      name,
      description,
      price: String(price),
      stock,
      location,
    })
    .returning();

  return product;
}

// ============================================================
// FACTORY ORDERS
// ============================================================

interface CreateOrderOptions {
  buyer_id: number;
  seller_id: number;
  status?: string;
  delivery_method?: string;
  delivery_address?: string;
  total_price?: number;
}

export async function createOrder(options: CreateOrderOptions) {
  const {
    buyer_id,
    seller_id,
    status = "pending",
    delivery_method = "pickup",
    delivery_address = null,
    total_price = 0,
  } = options;

  const [order] = await testDb
    .insert(orders)
    .values({
      buyer_id,
      seller_id,
      status,
      delivery_method,
      delivery_address,
      total_price: String(total_price),
    })
    .returning();

  return order;
}

// ============================================================
// FACTORY ORDER ITEMS
// ============================================================

interface CreateOrderItemOptions {
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

export async function createOrderItem(options: CreateOrderItemOptions) {
  const { order_id, product_id, quantity, unit_price } = options;

  const [item] = await testDb
    .insert(orderItems)
    .values({
      order_id,
      product_id,
      quantity,
      unit_price: String(unit_price),
    })
    .returning();

  return item;
}
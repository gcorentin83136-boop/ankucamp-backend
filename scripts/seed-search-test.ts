// ============================================================
// ANKUCAMP — Seed minimal pour tester le module Search
// Usage : npx tsx scripts/seed-search-test.ts
// ============================================================

import "dotenv/config";
import { db, pool } from "../src/core/db";
import {
  users,
  shops,
  products,
  userSettings,
  categories,
  shopCategories,
} from "../src/core/db/schema";

async function main() {
  console.log("\n🌱 Seed search-test — démarrage\n");

  const stamp = Date.now();

  // ============================================================
  // 1. CATÉGORIE
  // ============================================================
  const [cat] = await db
    .insert(categories)
    .values({
      name: "Test Search",
      slug: `test-search-${stamp}`,
    })
    .returning();

  console.log(`✅ Catégorie #${cat.id} créée (slug=${cat.slug})`);

  // ============================================================
  // 2. USER VENDEUR (pro + vérifié + indexable)
  // ============================================================
  const [seller] = await db
    .insert(users)
    .values({
      first_name: "Café",
      last_name: "Testeur",
      username: `cafetest_${stamp}`,
      email: `cafe_${stamp}@test.com`,
      role: "professionnel",
      email_verified: 1,
      password_hash: "not-a-real-hash",
      city: "Paris",
    })
    .returning();

  await db.insert(userSettings).values({
    user_id: seller.id,
    search_indexable: 1,
  });

  console.log(
    `✅ User vendeur #${seller.id} créé (Café Testeur, ${seller.username})`
  );

  // ============================================================
  // 3. USER ACHETEUR (particulier + vérifié + indexable)
  // ============================================================
  const [buyer] = await db
    .insert(users)
    .values({
      first_name: "Alice",
      last_name: "Martin",
      username: `alice_${stamp}`,
      email: `alice_${stamp}@test.com`,
      role: "particulier",
      email_verified: 1,
      password_hash: "not-a-real-hash",
      city: "Lyon",
    })
    .returning();

  await db.insert(userSettings).values({
    user_id: buyer.id,
    search_indexable: 1,
  });

  console.log(
    `✅ User acheteur #${buyer.id} créé (Alice Martin, ${buyer.username})`
  );

  // ============================================================
  // 4. SHOP
  // ============================================================
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: seller.id,
      name: `Boutique Café ${stamp}`,
      description: "Boutique de test pour le module search",
      city: "Paris",
      postal_code: "75001",
    })
    .returning();

  await db.insert(shopCategories).values({
    shop_id: shop.id,
    category_id: cat.id,
  });

  console.log(`✅ Shop #${shop.id} créé (Boutique Café)`);

  // ============================================================
  // 5. PRODUITS
  // ============================================================
  const productData = [
    {
      name: "Café en grains premium",
      description: "Grains torréfiés artisanaux",
      price: "12.50",
      stock: 10,
      location: "Paris",
    },
    {
      name: "Thé vert bio",
      description: "Thé vert de Chine bio",
      price: "8.90",
      stock: 5,
      location: "Paris",
    },
    {
      name: "Chocolat noir 70%",
      description: "Tablette de chocolat noir intense",
      price: "4.50",
      stock: 0,
      location: "Paris",
    },
    {
      name: "Machine à café italienne",
      description: "Machine expresso professionnelle",
      price: "149.00",
      stock: 3,
      location: "Paris",
    },
  ];

  for (const p of productData) {
    const [prod] = await db
      .insert(products)
      .values({
        shop_id: shop.id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        location: p.location,
      })
      .returning();

    console.log(`   ✅ Produit #${prod.id} : ${prod.name} (${prod.price}€)`);
  }

  // ============================================================
  // RÉSUMÉ
  // ============================================================
  console.log("\n🎉 Seed terminé !\n");
  console.log("🧪 Test rapide :");
  console.log(`   GET ${process.env.API_URL ?? "http://localhost:3001"}/search/all?q=cafe`);
  console.log(`   GET ${process.env.API_URL ?? "http://localhost:3001"}/search/products?in_stock=true`);
  console.log(`   GET ${process.env.API_URL ?? "http://localhost:3001"}/search/suggest?q=ca`);
  console.log("");

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n❌ Erreur seed :", err);
  await pool.end().catch(() => {});
  process.exit(1);
});

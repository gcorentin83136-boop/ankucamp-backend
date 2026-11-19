import { db } from "../src/core/db";
import { products } from "../src/core/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db.select().from(products).orderBy(desc(products.id)).limit(3);
  console.table(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      unlimited: p.has_unlimited_stock,
      pickup: p.delivery_pickup,
      shipping: p.delivery_shipping,
      meeting: p.delivery_meeting,
      videos: p.video_urls ? JSON.parse(p.video_urls).length : 0,
    }))
  );
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { posts, users, shops } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { env } from "../../../config/env";

// ============================================================
// CONFIG
// ============================================================

const FRONTEND_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://ankucamp.com";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

/**
 * Encode une string pour une URL.
 */
function enc(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Récupère l'auteur d'un post.
 */
async function getPostAuthor(authorId: number) {
  const [author] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  return author ?? null;
}

/**
 * Extrait une description courte d'un post (max 160 char pour OG).
 */
function buildPostDescription(content: string | null): string {
  if (!content) return "Découvre ce post sur ANKU";
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return clean.slice(0, 157) + "...";
}

// ============================================================
// META OPEN GRAPH — POST
// ============================================================

/**
 * Génère les meta Open Graph pour un post.
 */
export async function getPostOpenGraph(postId: number) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);

  const author = await getPostAuthor(post.author_id);

  // URL publique du post
  const url = `${FRONTEND_URL}/posts/${post.id}`;

  // Media (première image si dispo)
  let image = `${FRONTEND_URL}/og-default.jpg`;
  if (post.media_urls) {
    try {
      const media = JSON.parse(post.media_urls);
      if (media.length > 0) image = media[0];
    } catch {
      // Ignore
    }
  }

  return {
    url,
    title: author
      ? `Post de @${author.username} sur ANKU`
      : `Post #${post.id} sur ANKU`,
    description: buildPostDescription(post.content),
    image,
    type: "article",
    site_name: "ANKU",
    author: author
      ? {
          username: author.username,
          name: `${author.first_name} ${author.last_name}`,
          avatar_url: author.avatar_url,
        }
      : null,
    stats: {
      likes: post.likes_count,
      comments: post.comments_count,
      shares: post.shares_count,
    },
  };
}

// ============================================================
// META OPEN GRAPH — PROFIL
// ============================================================

/**
 * Génère les meta Open Graph pour un profil.
 */
export async function getUserOpenGraph(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      cover_url: users.cover_url,
      bio: users.bio,
      location: users.location,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const url = `${FRONTEND_URL}/u/${user.username}`;
  const image = user.cover_url ?? user.avatar_url ?? `${FRONTEND_URL}/og-default.jpg`;

  return {
    url,
    title: `${user.first_name} ${user.last_name} (@${user.username}) sur ANKU`,
    description: user.bio ?? `Découvre le profil de ${user.first_name} sur ANKU`,
    image,
    type: "profile",
    site_name: "ANKU",
    user: {
      username: user.username,
      name: `${user.first_name} ${user.last_name}`,
      avatar_url: user.avatar_url,
      location: user.location,
    },
  };
}

// ============================================================
// META OPEN GRAPH — BOUTIQUE
// ============================================================

/**
 * Génère les meta Open Graph pour une boutique.
 */
export async function getShopOpenGraph(shopId: number) {
  const [shop] = await db
    .select({
      id: shops.id,
      name: shops.name,
      description: shops.description,
      logo_url: shops.logo_url,
      banner_url: shops.banner_url,
      city: shops.city,
    })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);

  const url = `${FRONTEND_URL}/shops/${shop.id}`;
  const image = shop.banner_url ?? shop.logo_url ?? `${FRONTEND_URL}/og-default.jpg`;

  return {
    url,
    title: `${shop.name} sur ANKU`,
    description: shop.description ?? `Découvre ${shop.name} sur ANKU`,
    image,
    type: "website",
    site_name: "ANKU",
    shop: {
      name: shop.name,
      logo_url: shop.logo_url,
      city: shop.city,
    },
  };
}

// ============================================================
// LIENS DE PARTAGE PRÉ-FORMATÉS
// ============================================================

/**
 * Génère les URLs de partage pour chaque plateforme.
 */
export function buildShareLinks(
  url: string,
  title: string,
  description: string
) {
  const text = `${title}\n${description}`;
  const encodedUrl = enc(url);
  const encodedText = enc(text);
  const encodedTitle = enc(title);

  return {
    // ============================================================
    // Plateformes web (avec URL)
    // ============================================================
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    sms: `sms:?&body=${encodedText}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedText}%20${encodedUrl}`,

    // ============================================================
    // Plateformes app (deep links)
    // Instagram et TikTok n'ont pas d'URL de partage web.
    // On fournit les deep links app + l'URL à copier.
    // ============================================================
    instagram: {
      type: "app_deep_link",
      deep_link: "instagram://app",
      url_to_copy: url,
      text_to_copy: text,
      note: "Instagram n'a pas d'API de partage web. Copie le lien et colle-le dans ton app Instagram.",
    },
    tiktok: {
      type: "app_deep_link",
      deep_link: "snssdk1233://",
      url_to_copy: url,
      text_to_copy: text,
      note: "TikTok n'a pas d'API de partage web. Copie le lien et colle-le dans ton app TikTok.",
    },

    // URL de la page de partage (peut être utilisée côté front)
    copy_link: {
      url,
      text,
    },
  };
}

// ============================================================
// HELPERS PUBLICS
// ============================================================

/**
 * Génère les liens de partage pour un post.
 */
export async function getPostShareLinks(postId: number) {
  const og = await getPostOpenGraph(postId);
  return {
    og,
    links: buildShareLinks(og.url, og.title, og.description),
  };
}

/**
 * Génère les liens de partage pour un profil.
 */
export async function getUserShareLinks(username: string) {
  const og = await getUserOpenGraph(username);
  return {
    og,
    links: buildShareLinks(og.url, og.title, og.description),
  };
}

/**
 * Génère les liens de partage pour une boutique.
 */
export async function getShopShareLinks(shopId: number) {
  const og = await getShopOpenGraph(shopId);
  return {
    og,
    links: buildShareLinks(og.url, og.title, og.description),
  };
}
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  users,
  userSettings,
  shopSettings,
  shops,
  posts,
  postLikes,
  postComments,
  friendships,
  follows,
  orders,
  reviews,
  notifications,
  messages,
  userSessions,
  legalAcceptances,
  dataExportRequests,
  accountDeletionRequests,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { cloudinary } from "../../../../config/cloudinary";
import { sendEmail } from "../../../emails/email.service";
import { dataExportTemplate } from "../../../emails/templates/dataExport";
import { accountDeletionScheduledTemplate } from "../../../emails/templates/accountDeletionScheduled";
import { env } from "../../../../config/env";
import type { AcceptLegalDocInput } from "./gdpr.validation";

const FRONTEND_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://ankucamp.com";

const EXPORT_EXPIRY_DAYS = 30;
const DELETION_DELAY_DAYS = 30;

// ============================================================
// EXPORT DES DONNÉES
// ============================================================

export async function requestDataExport(userId: number) {
  const [pending] = await db
    .select()
    .from(dataExportRequests)
    .where(
      and(
        eq(dataExportRequests.user_id, userId),
        eq(dataExportRequests.status, "pending")
      )
    )
    .limit(1);

  if (pending) {
    throw new AppError(
      "Une demande d'export est déjà en cours. Patiente quelques instants.",
      400
    );
  }

  const [created] = await db
    .insert(dataExportRequests)
    .values({
      user_id: userId,
      status: "pending",
    })
    .returning();

  console.log(
    `📦 Demande d'export créée pour user #${userId} (request #${created.id})`
  );

  // Traitement en arrière-plan
  processDataExport(userId, created.id).catch((err) =>
    console.error("❌ Erreur traitement export:", err)
  );

  return created;
}

async function processDataExport(userId: number, requestId: number) {
  try {
    console.log(`⚙️  Génération de l'export pour user #${userId}...`);

    await db
      .update(dataExportRequests)
      .set({ status: "processing" })
      .where(eq(dataExportRequests.id, requestId));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new Error("User introuvable");

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .limit(1);

    const userShops = await db
      .select()
      .from(shops)
      .where(eq(shops.owner_id, userId));

    const shopIds = userShops.map((s) => s.id);
    const userShopSettings =
      shopIds.length > 0
        ? await db
            .select()
            .from(shopSettings)
            .where(eq(shopSettings.shop_id, shopIds[0]))
        : [];

    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.author_id, userId));

    const userLikes = await db
      .select()
      .from(postLikes)
      .where(eq(postLikes.user_id, userId));

    const userComments = await db
      .select()
      .from(postComments)
      .where(eq(postComments.author_id, userId));

    const userFriendships = await db
      .select()
      .from(friendships)
      .where(eq(friendships.requester_id, userId));

    const userFollows = await db
      .select()
      .from(follows)
      .where(eq(follows.follower_id, userId));

    const buyerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.buyer_id, userId));

    const sellerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.seller_id, userId));

    const userReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.author_id, userId));

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId));

    const userMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sender_id, userId));

    const userSess = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.user_id, userId));

    const userAcceptances = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.user_id, userId));

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      rgpd_info: {
        format_version: "1.0",
        legal_basis: "RGPD article 20 - Droit à la portabilité",
        contact: "contact@ankucamp.com",
      },
      profile: {
        ...user,
        password_hash: "[SUPPRIMÉ POUR SÉCURITÉ]",
      },
      settings: settings ?? null,
      shops: userShops,
      shop_settings: userShopSettings,
      social: {
        posts: userPosts,
        likes: userLikes,
        comments: userComments,
        friendships: userFriendships,
        follows: userFollows,
      },
      orders: {
        as_buyer: buyerOrders,
        as_seller: sellerOrders,
      },
      reviews: userReviews,
      notifications: userNotifications,
      messages: userMessages,
      sessions: userSess,
      legal_acceptances: userAcceptances,
    };

    const jsonBuffer = Buffer.from(
      JSON.stringify(exportData, null, 2),
      "utf-8"
    );

    const publicId = `export-user-${userId}-${Date.now()}`;

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "anku/exports",
          public_id: publicId,
          format: "json",
        },
        (err, result) => {
          if (err) return reject(err);
          if (!result) return reject(new Error("Upload vide"));
          resolve(result);
        }
      );
      stream.end(jsonBuffer);
    });

    const fileUrl = uploadResult.secure_url;
    const expiresAt = new Date(
      Date.now() + EXPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await db
      .update(dataExportRequests)
      .set({
        status: "ready",
        file_url: fileUrl,
        completed_at: new Date(),
        expires_at: expiresAt,
      })
      .where(eq(dataExportRequests.id, requestId));

    console.log(`✅ Export prêt pour user #${userId} → ${fileUrl}`);

    const tpl = dataExportTemplate({
      firstName: user.first_name,
      downloadUrl: fileUrl,
      expiresAt,
    });

    // ✅ Envoi email non-bloquant (ne casse pas l'export si Brevo échoue)
    try {
      await sendEmail({
        to: user.email,
        toName: user.first_name,
        subject: tpl.subject,
        htmlContent: tpl.htmlContent,
        textContent: tpl.textContent,
      });
      console.log(`📧 Email d'export envoyé à ${user.email}`);
    } catch (emailErr) {
      console.error(
        `⚠️ Email d'export non envoyé (non-bloquant):`,
        emailErr
      );
    }
  } catch (err) {
    console.error(`❌ Erreur processDataExport (request #${requestId}):`, err);

    await db
      .update(dataExportRequests)
      .set({ status: "failed" })
      .where(eq(dataExportRequests.id, requestId));
  }
}

export async function getExportStatus(userId: number) {
  const [request] = await db
    .select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.user_id, userId))
    .orderBy(desc(dataExportRequests.requested_at))
    .limit(1);

  return request ?? null;
}

// ============================================================
// SUPPRESSION DE COMPTE
// ============================================================

export async function requestAccountDeletion(
  userId: number,
  reason?: string | null
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const [existing] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.user_id, userId),
        eq(accountDeletionRequests.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      "Une demande de suppression est déjà en cours.",
      400
    );
  }

  const scheduledAt = new Date(
    Date.now() + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000
  );

  const [created] = await db
    .insert(accountDeletionRequests)
    .values({
      user_id: userId,
      reason: reason ?? null,
      status: "pending",
      scheduled_deletion_at: scheduledAt,
    })
    .returning();

  console.log(
    `🗑️  Suppression programmée pour user #${userId} le ${scheduledAt.toISOString()}`
  );

  const cancelUrl = `${FRONTEND_URL}/settings/gdpr/cancel-deletion`;

  const tpl = accountDeletionScheduledTemplate({
    firstName: user.first_name,
    scheduledDate: scheduledAt,
    cancelUrl,
  });

  // ✅ Envoi email non-bloquant (ne casse pas la suppression si Brevo échoue)
  try {
    await sendEmail({
      to: user.email,
      toName: user.first_name,
      subject: tpl.subject,
      htmlContent: tpl.htmlContent,
      textContent: tpl.textContent,
    });
    console.log(`📧 Email de suppression programmée envoyé à ${user.email}`);
  } catch (emailErr) {
    console.error(
      `⚠️ Email de suppression non envoyé (non-bloquant):`,
      emailErr
    );
  }

  return created;
}

export async function cancelAccountDeletion(userId: number) {
  const [existing] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.user_id, userId),
        eq(accountDeletionRequests.status, "pending")
      )
    )
    .limit(1);

  if (!existing) {
    throw new AppError("Aucune demande de suppression en cours", 404);
  }

  await db
    .update(accountDeletionRequests)
    .set({ status: "cancelled" })
    .where(eq(accountDeletionRequests.id, existing.id));

  console.log(`✅ Suppression annulée pour user #${userId}`);

  return { success: true };
}

export async function getDeletionStatus(userId: number) {
  const [request] = await db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.user_id, userId))
    .orderBy(desc(accountDeletionRequests.created_at))
    .limit(1);

  return request ?? null;
}

// ============================================================
// ACCEPTATIONS LÉGALES
// ============================================================

export async function acceptLegalDocument(
  userId: number,
  input: AcceptLegalDocInput,
  ipAddress?: string
) {
  const [created] = await db
    .insert(legalAcceptances)
    .values({
      user_id: userId,
      document_type: input.document_type,
      document_version: input.document_version,
      ip_address: ipAddress ?? null,
    })
    .returning();

  console.log(
    `📜 Acceptation enregistrée pour user #${userId} : ${input.document_type} v${input.document_version}`
  );

  return created;
}

export async function listAcceptances(userId: number) {
  return db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.user_id, userId))
    .orderBy(desc(legalAcceptances.accepted_at));
}
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { messages } from "../../db/schema";
import { AppError } from "../../errors/AppError";

// ============================================================
// PUBLIC
// ============================================================

export async function getPublicMessages() {
  return db.select().from(messages).where(eq(messages.type, "public"));
}

export async function createPublicMessage(senderId: number, content: string) {
  const [created] = await db
    .insert(messages)
    .values({ sender_id: senderId, type: "public", content })
    .returning();

  return created;
}

// ============================================================
// GROUP
// ============================================================

export async function getGroupMessages(groupId: number) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.type, "group"), eq(messages.group_id, groupId)));
}

export async function createGroupMessage(
  senderId: number,
  groupId: number,
  content: string
) {
  const [created] = await db
    .insert(messages)
    .values({
      sender_id: senderId,
      type: "group",
      group_id: groupId,
      content,
    })
    .returning();

  return created;
}

// ============================================================
// SUPPORT
// ============================================================

export async function getSupportMessagesByUser(userId: number) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.type, "support"), eq(messages.sender_id, userId)));
}

export async function getSupportMessagesByShop(shopId: number) {
  return db
    .select()
    .from(messages)
    .where(
      and(eq(messages.type, "support"), eq(messages.receiver_id, shopId))
    );
}

export async function createSupportMessage(
  senderId: number,
  receiverId: number,
  content: string
) {
  const [created] = await db
    .insert(messages)
    .values({
      sender_id: senderId,
      type: "support",
      receiver_id: receiverId,
      content,
    })
    .returning();

  return created;
}

// ============================================================
// MESSAGE PAR ID
// ============================================================

export async function getMessageById(id: number) {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  if (!message) {
    throw new AppError("Message introuvable", 404);
  }

  return message;
}
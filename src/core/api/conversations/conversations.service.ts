import { eq, and, or, desc, lt, sql, isNull, ne, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  conversations,
  conversationParticipants,
  messages,
  messageReads,
  messageReactions,
  users,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type {
  CreateConversationInput,
  UpdateConversationInput,
  SendMessageInput,
  EditMessageInput,
  ListMessagesQuery,
} from "./conversations.validation";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

async function assertParticipant(conversationId: number, userId: number) {
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, userId),
        isNull(conversationParticipants.left_at)
      )
    )
    .limit(1);

  if (!participant) {
    throw new AppError("Tu n'as pas accès à cette conversation", 403);
  }

  return participant;
}

async function assertAdmin(conversationId: number, userId: number) {
  const participant = await assertParticipant(conversationId, userId);

  if (participant.role !== "admin") {
    throw new AppError("Seul un admin peut faire cette action", 403);
  }

  return participant;
}

async function enrichUser(userId: number) {
  const [user] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

// ============================================================
// CONVERSATIONS
// ============================================================

export async function getUserConversations(userId: number) {
  const participants = await db
    .select({
      conversation_id: conversationParticipants.conversation_id,
      last_read_message_id: conversationParticipants.last_read_message_id,
    })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.user_id, userId),
        isNull(conversationParticipants.left_at)
      )
    );

  if (participants.length === 0) return [];

  const conversationIds = participants.map((p) => p.conversation_id);

  // ✅ Correction : inArray au lieu de sql... ANY()
  const rows = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, conversationIds))
    .orderBy(desc(conversations.last_message_at));

  const result = [];

  for (const conv of rows) {
    const myParticipation = participants.find(
      (p) => p.conversation_id === conv.id
    );
    const lastReadId = myParticipation?.last_read_message_id ?? 0;

    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversation_id, conv.id),
          ne(messages.sender_id, userId),
          isNull(messages.deleted_at),
          sql`${messages.id} > ${lastReadId}`
        )
      );

    const participantsList = await db
      .select({
        user_id: conversationParticipants.user_id,
        role: conversationParticipants.role,
        first_name: users.first_name,
        last_name: users.last_name,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(conversationParticipants)
      .leftJoin(users, eq(users.id, conversationParticipants.user_id))
      .where(
        and(
          eq(conversationParticipants.conversation_id, conv.id),
          isNull(conversationParticipants.left_at)
        )
      );

    let displayName = conv.name;
    let displayAvatar = conv.avatar_url;

    if (conv.type === "direct") {
      const other = participantsList.find((p) => p.user_id !== userId);
      if (other) {
        displayName = `${other.first_name} ${other.last_name}`;
        displayAvatar = other.avatar_url;
      }
    }

    result.push({
      id: conv.id,
      type: conv.type,
      name: displayName,
      avatar_url: displayAvatar,
      participants: participantsList,
      last_message_at: conv.last_message_at,
      last_message_preview: conv.last_message_preview,
      unread_count: unreadResult?.count ?? 0,
      created_at: conv.created_at,
    });
  }

  return result;
}

export async function getConversationById(
  conversationId: number,
  userId: number
) {
  await assertParticipant(conversationId, userId);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable", 404);

  const participantsList = await db
    .select({
      user_id: conversationParticipants.user_id,
      role: conversationParticipants.role,
      joined_at: conversationParticipants.joined_at,
      last_read_at: conversationParticipants.last_read_at,
      muted: conversationParticipants.muted,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
    })
    .from(conversationParticipants)
    .leftJoin(users, eq(users.id, conversationParticipants.user_id))
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        isNull(conversationParticipants.left_at)
      )
    );

  return {
    ...conv,
    participants: participantsList,
  };
}

export async function createConversation(
  creatorId: number,
  input: CreateConversationInput
) {
  for (const pId of input.participant_ids) {
    if (pId === creatorId) {
      throw new AppError("Tu ne peux pas t'ajouter toi-même", 400);
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, pId))
      .limit(1);

    if (!user) {
      throw new AppError(`Utilisateur #${pId} introuvable`, 404);
    }
  }

  if (input.type === "direct") {
    const otherId = input.participant_ids[0];

    const myConvs = await db
      .select({ conversation_id: conversationParticipants.conversation_id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.user_id, creatorId),
          isNull(conversationParticipants.left_at)
        )
      );

    if (myConvs.length > 0) {
      const ids = myConvs.map((c) => c.conversation_id);

      // ✅ Correction : inArray au lieu de sql... ANY()
      const existing = await db
        .select({
          id: conversations.id,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversationParticipants.conversation_id, conversations.id)
        )
        .where(
          and(
            eq(conversations.type, "direct"),
            inArray(conversations.id, ids),
            eq(conversationParticipants.user_id, otherId),
            isNull(conversationParticipants.left_at)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(
          `ℹ️  Conversation directe existante trouvée #${existing[0].id}`
        );
        return getConversationById(existing[0].id, creatorId);
      }
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({
      type: input.type,
      name: input.name ?? null,
      avatar_url: input.avatar_url ?? null,
      created_by: creatorId,
    })
    .returning();

  await db.insert(conversationParticipants).values({
    conversation_id: created.id,
    user_id: creatorId,
    role: input.type === "group" ? "admin" : "member",
  });

  for (const pId of input.participant_ids) {
    await db.insert(conversationParticipants).values({
      conversation_id: created.id,
      user_id: pId,
      role: "member",
    });
  }

  console.log(
    `💬 Conversation ${input.type} #${created.id} créée par user #${creatorId}`
  );

  return getConversationById(created.id, creatorId);
}

export async function updateConversation(
  conversationId: number,
  userId: number,
  input: UpdateConversationInput
) {
  await assertAdmin(conversationId, userId);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable", 404);

  if (conv.type !== "group") {
    throw new AppError("Impossible de modifier une conversation directe", 400);
  }

  const updates: any = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url;

  const [updated] = await db
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, conversationId))
    .returning();

  return updated;
}

export async function deleteConversation(
  conversationId: number,
  userId: number
) {
  await assertAdmin(conversationId, userId);

  // ✅ Correction : utilise inArray avec sous-requête Drizzle
  const messageIds = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversation_id, conversationId));

  await db
    .delete(messageReads)
    .where(inArray(messageReads.message_id, messageIds));

  await db
    .delete(messageReactions)
    .where(inArray(messageReactions.message_id, messageIds));

  await db
    .delete(conversationParticipants)
    .where(eq(conversationParticipants.conversation_id, conversationId));

  await db
    .delete(messages)
    .where(eq(messages.conversation_id, conversationId));

  await db
    .delete(conversations)
    .where(eq(conversations.id, conversationId));

  console.log(`🗑️  Conversation #${conversationId} supprimée`);
}

export async function leaveConversation(
  conversationId: number,
  userId: number
) {
  await assertParticipant(conversationId, userId);

  await db
    .update(conversationParticipants)
    .set({ left_at: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, userId)
      )
    );

  console.log(`👋 User #${userId} a quitté la conv #${conversationId}`);
}

// ============================================================
// PARTICIPANTS
// ============================================================

export async function addParticipant(
  conversationId: number,
  userId: number,
  newUserId: number
) {
  await assertAdmin(conversationId, userId);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable", 404);
  if (conv.type !== "group") {
    throw new AppError("Impossible d'ajouter un participant à un direct", 400);
  }

  const [newUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, newUserId))
    .limit(1);

  if (!newUser) throw new AppError("Utilisateur introuvable", 404);

  const [existing] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, newUserId),
        isNull(conversationParticipants.left_at)
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError("Cet utilisateur est déjà dans la conversation", 400);
  }

  await db.insert(conversationParticipants).values({
    conversation_id: conversationId,
    user_id: newUserId,
    role: "member",
  });

  console.log(
    `➕ User #${newUserId} ajouté à la conv #${conversationId} par #${userId}`
  );
}

export async function removeParticipant(
  conversationId: number,
  userId: number,
  targetUserId: number
) {
  await assertAdmin(conversationId, userId);

  if (targetUserId === userId) {
    throw new AppError("Utilise 'quitter' pour te retirer toi-même", 400);
  }

  await db
    .update(conversationParticipants)
    .set({ left_at: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, targetUserId)
      )
    );

  console.log(
    `➖ User #${targetUserId} retiré de la conv #${conversationId}`
  );
}

// ============================================================
// MESSAGES
// ============================================================

export async function sendMessage(
  conversationId: number,
  senderId: number,
  input: SendMessageInput
) {
  await assertParticipant(conversationId, senderId);

  if (!input.content && !input.media_url) {
    throw new AppError("Le message doit avoir du contenu ou un média", 400);
  }

  if (input.reply_to_message_id) {
    const [original] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, input.reply_to_message_id))
      .limit(1);

    if (!original || original.conversation_id !== conversationId) {
      throw new AppError("Message original introuvable", 404);
    }
  }

  const [created] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      sender_id: senderId,
      type: input.type,
      content: input.content ?? "",
      media_url: input.media_url ?? null,
      reply_to_message_id: input.reply_to_message_id ?? null,
    })
    .returning();

  const preview = input.content
    ? input.content.slice(0, 200)
    : input.type === "image"
    ? "📷 Photo"
    : "📎 Fichier";

  await db
    .update(conversations)
    .set({
      last_message_at: new Date(),
      last_message_preview: preview,
    })
    .where(eq(conversations.id, conversationId));

  const [senderPart] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, senderId)
      )
    )
    .limit(1);

  if (senderPart) {
    await db
      .update(conversationParticipants)
      .set({ last_read_message_id: created.id, last_read_at: new Date() })
      .where(eq(conversationParticipants.id, senderPart.id));
  }

  console.log(
    `📨 Message #${created.id} envoyé dans conv #${conversationId} par user #${senderId}`
  );

  return created;
}

export async function getMessages(
  conversationId: number,
  userId: number,
  query: ListMessagesQuery
) {
  await assertParticipant(conversationId, userId);

  const { limit, before_message_id } = query;

  const conditions: any[] = [
    eq(messages.conversation_id, conversationId),
    isNull(messages.deleted_at),
  ];

  if (before_message_id) {
    conditions.push(lt(messages.id, before_message_id));
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.id))
    .limit(limit);

  const enriched = [];

  for (const msg of rows) {
    const author = await enrichUser(msg.sender_id);

    const reactions = await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.message_id, msg.id));

    const reactionsGrouped = reactions.reduce(
      (acc: any, r: any) => {
        acc[r.emoji] = acc[r.emoji] || [];
        acc[r.emoji].push(r.user_id);
        return acc;
      },
      {} as Record<string, number[]>
    );

    enriched.push({
      ...msg,
      author,
      reactions: reactionsGrouped,
    });
  }

  return enriched.reverse();
}

export async function editMessage(
  messageId: number,
  userId: number,
  newContent: string
) {
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) throw new AppError("Message introuvable", 404);

  if (msg.sender_id !== userId) {
    throw new AppError("Tu ne peux éditer que tes propres messages", 403);
  }

  if (msg.deleted_at) {
    throw new AppError("Ce message a été supprimé", 400);
  }

  if (msg.type !== "text") {
    throw new AppError("Seuls les messages texte peuvent être édités", 400);
  }

  const [updated] = await db
    .update(messages)
    .set({
      content: newContent,
      edited_at: new Date(),
    })
    .where(eq(messages.id, messageId))
    .returning();

  console.log(`✏️  Message #${messageId} édité`);

  return updated;
}

export async function deleteMessage(messageId: number, userId: number) {
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) throw new AppError("Message introuvable", 404);

  if (msg.sender_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes propres messages", 403);
  }

  await db
    .update(messages)
    .set({ deleted_at: new Date() })
    .where(eq(messages.id, messageId));

  console.log(`🗑️  Message #${messageId} supprimé (soft)`);
}

export async function markAsRead(
  conversationId: number,
  userId: number,
  untilMessageId?: number | null
) {
  await assertParticipant(conversationId, userId);

  let lastId = untilMessageId;

  if (!lastId) {
    const [last] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversation_id, conversationId),
          isNull(messages.deleted_at)
        )
      )
      .orderBy(desc(messages.id))
      .limit(1);

    lastId = last?.id ?? null;
  }

  await db
    .update(conversationParticipants)
    .set({
      last_read_at: new Date(),
      last_read_message_id: lastId,
    })
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        eq(conversationParticipants.user_id, userId)
      )
    );

  console.log(
    `👁️  Conv #${conversationId} marquée lue par user #${userId} jusqu'à #${lastId}`
  );

  return { last_read_message_id: lastId };
}

// ============================================================
// RÉACTIONS
// ============================================================

export async function toggleReaction(
  messageId: number,
  userId: number,
  emoji: string
) {
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) throw new AppError("Message introuvable", 404);
  if (!msg.conversation_id) {
    throw new AppError("Ce message n'appartient à aucune conversation", 400);
  }

  await assertParticipant(msg.conversation_id, userId);

  const [existing] = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.message_id, messageId),
        eq(messageReactions.user_id, userId),
        eq(messageReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, existing.id));
    return { action: "removed", emoji };
  }

  await db.insert(messageReactions).values({
    message_id: messageId,
    user_id: userId,
    emoji,
  });

  return { action: "added", emoji };
}
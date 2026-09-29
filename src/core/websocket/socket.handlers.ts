import { Server } from "socket.io";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  conversationParticipants,
  messages,
} from "../db/schema";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  toggleReaction,
  getConversationById,
} from "../api/conversations/conversations.service";
import type { AuthenticatedSocket } from "./socket.auth";
import { notifyNewMessage } from "../notifications/social-notifications.helper";

// ============================================================
// HELPERS
// ============================================================

/**
 * Renvoie les IDs des participants actifs d'une conversation.
 */
async function getConversationParticipantIds(
  conversationId: number
): Promise<number[]> {
  const rows = await db
    .select({ user_id: conversationParticipants.user_id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversation_id, conversationId),
        isNull(conversationParticipants.left_at)
      )
    );

  return rows.map((r) => r.user_id);
}

// ============================================================
// HANDLERS
// ============================================================

export function registerSocketHandlers(
  io: Server,
  socket: AuthenticatedSocket
) {
  const user = socket.user!;
  console.log(`🔌 User #${user.id} (@${user.username}) connecté`);

  // Room par user
  socket.join(`user:${user.id}`);

  // ============================================================
  // CONVERSATION: JOIN
  // ============================================================
  socket.on("conversation:join", async (data: { conversationId: number }) => {
    try {
      const { conversationId } = data;
      if (!conversationId) throw new Error("conversationId requis");

      await getConversationById(conversationId, user.id);

      socket.join(`conversation:${conversationId}`);
      console.log(
        `👥 User #${user.id} rejoint la room conversation:${conversationId}`
      );

      socket.emit("conversation:joined", { conversationId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "conversation:join", message });
    }
  });

  // ============================================================
  // CONVERSATION: LEAVE
  // ============================================================
  socket.on("conversation:leave", (data: { conversationId: number }) => {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
    console.log(
      `👋 User #${user.id} quitte la room conversation:${conversationId}`
    );
  });

  // ============================================================
  // MESSAGE: SEND
  // ============================================================
  socket.on(
    "message:send",
    async (data: {
      conversationId: number;
      content?: string;
      type?: "text" | "image" | "file";
      media_url?: string;
      reply_to_message_id?: number;
    }) => {
      try {
        const {
          conversationId,
          content,
          type,
          media_url,
          reply_to_message_id,
        } = data;

        if (!conversationId) throw new Error("conversationId requis");

        const message = await sendMessage(conversationId, user.id, {
          content: content ?? null,
          type: type ?? "text",
          media_url: media_url ?? null,
          reply_to_message_id: reply_to_message_id ?? null,
        });

        const enriched = {
          ...message,
          author: {
            id: user.id,
            username: user.username,
            first_name: user.firstName,
          },
          reactions: {},
        };

        // Broadcast à la room
        io.to(`conversation:${conversationId}`).emit(
          "message:new",
          enriched
        );

        // Notif push aux autres participants
        const participantIds = await getConversationParticipantIds(
          conversationId
        );

        for (const pId of participantIds) {
          if (pId === user.id) continue;

          notifyNewMessage(
            pId,
            conversationId,
            message.id,
            user.firstName,
            content?.slice(0, 80) ?? "📎 Média"
          ).catch((err) =>
            console.error("❌ Erreur notif message:", err)
          );

          io.to(`user:${pId}`).emit("conversation:updated", {
            conversationId,
            lastMessage: enriched,
          });
        }

        console.log(
          `📨 Socket message:new envoyé dans conv #${conversationId}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur";
        console.error("❌ Erreur message:send:", message);
        socket.emit("error", { event: "message:send", message });
      }
    }
  );

  // ============================================================
  // MESSAGE: EDIT
  // ============================================================
  socket.on(
    "message:edit",
    async (data: { messageId: number; content: string }) => {
      try {
        const { messageId, content } = data;

        const updated = await editMessage(messageId, user.id, content);

        const [msg] = await db
          .select({ conversation_id: messages.conversation_id })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (msg?.conversation_id) {
          io.to(`conversation:${msg.conversation_id}`).emit(
            "message:edited",
            updated
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur";
        socket.emit("error", { event: "message:edit", message });
      }
    }
  );

  // ============================================================
  // MESSAGE: DELETE
  // ============================================================
  socket.on("message:delete", async (data: { messageId: number }) => {
    try {
      const { messageId } = data;

      const [msg] = await db
        .select({ conversation_id: messages.conversation_id })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!msg?.conversation_id) {
        throw new Error("Message introuvable");
      }

      await deleteMessage(messageId, user.id);

      io.to(`conversation:${msg.conversation_id}`).emit("message:deleted", {
        messageId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "message:delete", message });
    }
  });

  // ============================================================
  // MESSAGE: READ
  // ============================================================
  socket.on(
    "message:read",
    async (data: { conversationId: number; untilMessageId?: number }) => {
      try {
        const { conversationId, untilMessageId } = data;

        await markAsRead(conversationId, user.id, untilMessageId ?? null);

        io.to(`conversation:${conversationId}`).emit("message:read", {
          conversationId,
          userId: user.id,
          untilMessageId: untilMessageId ?? null,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur";
        socket.emit("error", { event: "message:read", message });
      }
    }
  );

  // ============================================================
  // MESSAGE: REACT
  // ============================================================
  socket.on(
    "message:react",
    async (data: { messageId: number; emoji: string }) => {
      try {
        const { messageId, emoji } = data;

        const result = await toggleReaction(messageId, user.id, emoji);

        const [msg] = await db
          .select({ conversation_id: messages.conversation_id })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (msg?.conversation_id) {
          io.to(`conversation:${msg.conversation_id}`).emit("message:reacted", {
            messageId,
            userId: user.id,
            emoji,
            action: result.action,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur";
        socket.emit("error", { event: "message:react", message });
      }
    }
  );

  // ============================================================
  // TYPING: START / STOP
  // ============================================================
  socket.on("typing:start", (data: { conversationId: number }) => {
    socket.to(`conversation:${data.conversationId}`).emit("typing:user", {
      conversationId: data.conversationId,
      userId: user.id,
      firstName: user.firstName,
      typing: true,
    });
  });

  socket.on("typing:stop", (data: { conversationId: number }) => {
    socket.to(`conversation:${data.conversationId}`).emit("typing:user", {
      conversationId: data.conversationId,
      userId: user.id,
      firstName: user.firstName,
      typing: false,
    });
  });

  // ============================================================
  // DISCONNECT
  // ============================================================
  socket.on("disconnect", (reason) => {
    console.log(
      `🔌 User #${user.id} (@${user.username}) déconnecté (${reason})`
    );
  });
}
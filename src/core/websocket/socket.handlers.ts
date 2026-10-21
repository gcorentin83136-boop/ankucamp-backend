import { Server } from "socket.io";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  conversationParticipants,
  messages,
  conversations,
  users,
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
import {
  hasReadReceiptsEnabled,
  hasTypingIndicatorEnabled,
  canCallUser,
} from "../api/settings/privacy/privacy.service";

// ============================================================
// HELPERS
// ============================================================

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

async function createCallMessage(
  io: Server,
  conversationId: number,
  initiatorId: number,
  callType: "audio" | "video",
  status: "ended" | "missed" | "rejected",
  durationSec: number
) {
  try {
    const content = JSON.stringify({ callType, status, duration: durationSec });
    const [created] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        sender_id: initiatorId,
        type: "call",
        content,
      })
      .returning();

    const label = callType === "video" ? "vidéo" : "vocal";
    const previewText =
      status === "missed"
        ? `📞 Appel ${label} manqué`
        : status === "rejected"
        ? `📞 Appel ${label} refusé`
        : `📞 Appel ${label} · ${Math.floor(durationSec / 60)}m${durationSec % 60}s`;

    await db
      .update(conversations)
      .set({ last_message_at: new Date(), last_message_preview: previewText })
      .where(eq(conversations.id, conversationId));

    const participantIds = await getConversationParticipantIds(conversationId);
    for (const pId of participantIds) {
      io.to(`user:${pId}`).emit("message:new", created);
      io.to(`user:${pId}`).emit("conversation:updated", {
        conversationId,
        lastMessage: created,
      });
    }
    console.log(`📞 Message call inséré dans conv #${conversationId} (${status})`);
  } catch (err) {
    console.error("❌ Erreur createCallMessage:", err);
  }
}

// ============================================================
// TIMEOUT APPELS
// ============================================================
const callTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function clearCallTimeout(callId: string) {
  const t = callTimeouts.get(callId);
  if (t) {
    clearTimeout(t);
    callTimeouts.delete(callId);
  }
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
  socket.join(`user:${user.id}`);

  socket.on("conversation:join", async (data: { conversationId: number }) => {
    try {
      const { conversationId } = data;
      if (!conversationId) throw new Error("conversationId requis");
      await getConversationById(conversationId, user.id);
      socket.join(`conversation:${conversationId}`);
      socket.emit("conversation:joined", { conversationId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "conversation:join", message });
    }
  });

  socket.on("conversation:leave", (data: { conversationId: number }) => {
    socket.leave(`conversation:${data.conversationId}`);
  });

  // MESSAGE: SEND
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
        const { conversationId, content, type, media_url, reply_to_message_id } = data;
        if (!conversationId) throw new Error("conversationId requis");
        const message = await sendMessage(conversationId, user.id, {
          content: content ?? null,
          type: type ?? "text",
          media_url: media_url ?? null,
          reply_to_message_id: reply_to_message_id ?? null,
        });
        const enriched = {
          ...message,
          author: { id: user.id, username: user.username, first_name: user.firstName },
          reactions: {},
        };
        socket.to(`conversation:${conversationId}`).emit("message:new", enriched);
        const participantIds = await getConversationParticipantIds(conversationId);
        for (const pId of participantIds) {
          if (pId === user.id) continue;
          notifyNewMessage(
            pId, conversationId, message.id, user.firstName,
            content?.slice(0, 80) ?? "📎 Média"
          ).catch((err) => console.error("❌ notif:", err));
          io.to(`user:${pId}`).emit("message:notification", enriched);
          io.to(`user:${pId}`).emit("conversation:updated", {
            conversationId, lastMessage: enriched,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur";
        socket.emit("error", { event: "message:send", message });
      }
    }
  );

  // MESSAGE: EDIT
  socket.on("message:edit", async (data: { messageId: number; content: string }) => {
    try {
      const updated = await editMessage(data.messageId, user.id, data.content);
      const [msg] = await db
        .select({ conversation_id: messages.conversation_id })
        .from(messages)
        .where(eq(messages.id, data.messageId))
        .limit(1);
      if (msg?.conversation_id) {
        io.to(`conversation:${msg.conversation_id}`).emit("message:edited", updated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "message:edit", message });
    }
  });

  // MESSAGE: DELETE
  socket.on("message:delete", async (data: { messageId: number }) => {
    try {
      const [msg] = await db
        .select({ conversation_id: messages.conversation_id })
        .from(messages)
        .where(eq(messages.id, data.messageId))
        .limit(1);
      if (!msg?.conversation_id) throw new Error("Message introuvable");
      await deleteMessage(data.messageId, user.id);
      io.to(`conversation:${msg.conversation_id}`).emit("message:deleted", {
        messageId: data.messageId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "message:delete", message });
    }
  });

  // MESSAGE: READ
  socket.on("message:read", async (data: { conversationId: number; untilMessageId?: number }) => {
    try {
      await markAsRead(data.conversationId, user.id, data.untilMessageId ?? null);

      // 🆕 N'émet l'event "message:read" que si l'accusé de lecture est activé
      const readReceiptsEnabled = await hasReadReceiptsEnabled(user.id);
      if (!readReceiptsEnabled) return;

      socket.to(`conversation:${data.conversationId}`).emit("message:read", {
        conversationId: data.conversationId,
        userId: user.id,
        untilMessageId: data.untilMessageId ?? null,
        readAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("error", { event: "message:read", message });
    }
  });

  // TYPING
  socket.on("typing:start", async (data: { conversationId: number }) => {
    // 🆕 N'émet que si l'indicateur de frappe est activé
    const typingEnabled = await hasTypingIndicatorEnabled(user.id);
    if (!typingEnabled) return;

    socket.to(`conversation:${data.conversationId}`).emit("typing:user", {
      conversationId: data.conversationId,
      userId: user.id,
      firstName: user.firstName,
      typing: true,
    });
  });
  socket.on("typing:stop", async (data: { conversationId: number }) => {
    // 🆕 N'émet que si l'indicateur de frappe est activé
    const typingEnabled = await hasTypingIndicatorEnabled(user.id);
    if (!typingEnabled) return;

    socket.to(`conversation:${data.conversationId}`).emit("typing:user", {
      conversationId: data.conversationId,
      userId: user.id,
      firstName: user.firstName,
      typing: false,
    });
  });

  // ============================================================
  // CALLS - SIGNALING WEBRTC
  // ============================================================

  socket.on("call:initiate", async (data: {
    conversationId: number;
    toUserId: number;
    callType: "audio" | "video";
  }) => {
    try {
      const { conversationId, toUserId, callType } = data;
      if (!conversationId || !toUserId) throw new Error("IDs requis");
      await getConversationById(conversationId, user.id);

      // 🆕 Vérifie que le destinataire autorise les appels
      const canCall = await canCallUser(user.id, toUserId);
      if (!canCall) {
        throw new Error("Ce destinataire n'accepte pas les appels");
      }

      // Récupère l'avatar de l'appelant
      const [caller] = await db
        .select({ avatar_url: users.avatar_url })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const callId = `call_${Date.now()}_${user.id}_${toUserId}`;
      io.to(`user:${toUserId}`).emit("call:incoming", {
        callId,
        conversationId,
        callType,
        fromUser: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          avatarUrl: caller?.avatar_url ?? null,
        },
      });
      socket.emit("call:initiated", { callId });

      // ⏱️ TIMEOUT 30s → missed
      const timeout = setTimeout(async () => {
        callTimeouts.delete(callId);
        io.to(`user:${toUserId}`).emit("call:hangup", {
          callId, fromUserId: user.id, reason: "missed",
        });
        io.to(`user:${user.id}`).emit("call:hangup", {
          callId, fromUserId: toUserId, reason: "missed",
        });
        await createCallMessage(io, conversationId, user.id, callType, "missed", 0);
        console.log(`⏱️ Appel ${callId} timeout 30s (missed)`);
      }, 30000);

      callTimeouts.set(callId, timeout);
      console.log(`📞 Appel ${callType} initié #${user.id} → #${toUserId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      socket.emit("call:error", { event: "call:initiate", message });
    }
  });

  socket.on("call:accept", (data: { callId: string; toUserId: number }) => {
    clearCallTimeout(data.callId);
    io.to(`user:${data.toUserId}`).emit("call:accepted", {
      callId: data.callId, fromUserId: user.id,
    });
  });

  socket.on("call:reject", async (data: {
    callId: string;
    toUserId: number;
    reason?: string;
    conversationId?: number;
    callType?: "audio" | "video";
  }) => {
    try {
      clearCallTimeout(data.callId);
      io.to(`user:${data.toUserId}`).emit("call:rejected", {
        callId: data.callId, fromUserId: user.id, reason: data.reason ?? "declined",
      });
      if (data.conversationId && data.callType) {
        await createCallMessage(io, data.conversationId, user.id, data.callType, "rejected", 0);
      }
    } catch (err) {
      console.error("❌ Erreur call:reject:", err);
    }
  });

  socket.on("call:hangup", async (data: {
    callId: string;
    toUserId: number;
    conversationId?: number;
    callType?: "audio" | "video";
    duration?: number;
  }) => {
    try {
      clearCallTimeout(data.callId);
      io.to(`user:${data.toUserId}`).emit("call:hangup", {
        callId: data.callId, fromUserId: user.id,
      });
      if (data.conversationId && data.callType) {
        await createCallMessage(io, data.conversationId, user.id, data.callType, "ended", data.duration ?? 0);
      }
    } catch (err) {
      console.error("❌ Erreur call:hangup:", err);
    }
  });

  socket.on("call:offer", (data: { callId: string; toUserId: number; sdp: any }) => {
    io.to(`user:${data.toUserId}`).emit("call:offer", {
      callId: data.callId, sdp: data.sdp, fromUserId: user.id,
    });
  });

  socket.on("call:answer", (data: { callId: string; toUserId: number; sdp: any }) => {
    io.to(`user:${data.toUserId}`).emit("call:answer", {
      callId: data.callId, sdp: data.sdp, fromUserId: user.id,
    });
  });

  socket.on("call:ice-candidate", (data: { callId: string; toUserId: number; candidate: any }) => {
    io.to(`user:${data.toUserId}`).emit("call:ice-candidate", {
      callId: data.callId, candidate: data.candidate, fromUserId: user.id,
    });
  });

  socket.on("call:request-video", (data: { callId: string; toUserId: number }) => {
    io.to(`user:${data.toUserId}`).emit("call:video-requested", {
      callId: data.callId, fromUserId: user.id,
    });
  });

  socket.on("call:accept-video", (data: { callId: string; toUserId: number }) => {
    io.to(`user:${data.toUserId}`).emit("call:video-accepted", {
      callId: data.callId, fromUserId: user.id,
    });
  });

  socket.on("call:reject-video", (data: { callId: string; toUserId: number }) => {
    io.to(`user:${data.toUserId}`).emit("call:video-rejected", {
      callId: data.callId, fromUserId: user.id,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 User #${user.id} déconnecté (${reason})`);
  });
}
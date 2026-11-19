import { z } from "zod";

// ============================================================
// RÉVOCATION D'UNE SESSION
// ============================================================

export const revokeSessionSchema = z.object({
  session_id: z
    .number()
    .int()
    .positive("ID de session invalide"),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
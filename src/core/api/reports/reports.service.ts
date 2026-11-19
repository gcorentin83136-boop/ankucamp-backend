import { db } from "../../db";
import { contentReports } from "../../db/schema"; // ✅ Utilisation de contentReports
import { AppError } from "../../errors/AppError";

export async function createReport(reporterId: number, targetType: string, targetId: number, reason: string) {
  if (!targetType || !targetId || !reason) {
    throw new AppError("Données de signalement invalides", 400);
  }

  const [created] = await db.insert(contentReports).values({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason: reason,
    status: "pending"
  }).returning();

  return created;
}
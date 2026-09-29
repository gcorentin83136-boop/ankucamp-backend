import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  list,
  getOne,
  create,
  update,
  remove,
  leave,
  addPart,
  removePart,
  listMessages,
  postMessage,
  read,
  editMsg,
  deleteMsg,
  react,
} from "./conversations.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// CONVERSATIONS
// ============================================================

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));

router.get("/:id", asyncHandler(getOne));
router.put("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

router.post("/:id/leave", asyncHandler(leave));

// ============================================================
// PARTICIPANTS
// ============================================================

router.post("/:id/participants", asyncHandler(addPart));
router.delete("/:id/participants/:userId", asyncHandler(removePart));

// ============================================================
// MESSAGES
// ============================================================

router.get("/:id/messages", asyncHandler(listMessages));
router.post("/:id/messages", asyncHandler(postMessage));
router.post("/:id/read", asyncHandler(read));

export default router;

// ============================================================
// ROUTER MESSAGES (séparé pour PUT/DELETE sur /messages/:id)
// ============================================================

export const messagesRouter = Router();

messagesRouter.use(authMiddleware);

messagesRouter.put("/:messageId", asyncHandler(editMsg));
messagesRouter.delete("/:messageId", asyncHandler(deleteMsg));
messagesRouter.post("/:messageId/reactions", asyncHandler(react));
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  chatStream,
  checkAIPermission,
  getChatHistory,
  clearChatHistory,
  getSessions,
  createSession,
  deleteSession,
  updateSessionTitle,
  saveMessage,
  deleteMessagesFrom,
} from "../controllers/aiController";

const router = Router();

router.use(authMiddleware);

router.get("/permission", checkAIPermission);

// 话题管理
router.get("/sessions", getSessions);
router.post("/sessions", createSession);
router.delete("/sessions/:sessionId", deleteSession);
router.put("/sessions/:sessionId/title", updateSessionTitle);
router.post("/sessions/:sessionId/messages", saveMessage);

// 聊天
router.post("/chat", chatStream);

// 聊天记录（按话题）
router.get("/history/:sessionId", getChatHistory);
router.delete("/history/:sessionId", clearChatHistory);
router.delete("/history/:sessionId/from/:messageId", deleteMessagesFrom);

export default router;

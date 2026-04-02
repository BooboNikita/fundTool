import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getAllUsers,
  updateUserAIPermission,
  batchUpdateAIPermission,
  getAIUsageStats,
} from "../controllers/adminController";

const router = Router();

router.use(authMiddleware);

router.get("/users", getAllUsers);
router.patch("/users/:userId/ai-permission", updateUserAIPermission);
router.post("/users/batch-ai-permission", batchUpdateAIPermission);
router.get("/ai-stats", getAIUsageStats);

export default router;

import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getMenuPermissions } from "../controllers/menuController";

const router = Router();

router.use(authMiddleware);

router.get("/permissions", getMenuPermissions);

export default router;

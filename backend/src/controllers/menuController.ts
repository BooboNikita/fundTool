import { Response } from "express";
import db from "../models/database";
import { AuthRequest } from "../types/express";

// 管理员用户名列表
const ADMIN_USERNAMES = ["Boobo"];

export interface MenuPermissions {
  aiAssistant: boolean;
  admin: boolean;
}

export async function getMenuPermissions(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const username = req.username;

  if (!userId || !username) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // 检查AI助手权限
    const [aiPermissionRows] = await db.execute(
      "SELECT can_use_ai_assistant FROM user_ai_permissions WHERE user_id = ?",
      [userId],
    );

    const aiPermissions = aiPermissionRows as any[];
    const canUseAI =
      aiPermissions.length > 0 && aiPermissions[0].can_use_ai_assistant === 1;

    // 检查是否是管理员
    const isAdmin = ADMIN_USERNAMES.includes(username);

    const permissions: MenuPermissions = {
      aiAssistant: canUseAI,
      admin: isAdmin,
    };

    res.json({ permissions });
  } catch (error) {
    console.error("Failed to get menu permissions:", error);
    res.status(500).json({ error: "Failed to get menu permissions" });
  }
}

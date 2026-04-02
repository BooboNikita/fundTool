import { Response } from "express";
import db from "../models/database";
import { AuthRequest } from "../types/express";

const ADMIN_USERNAME = "admin";

function isAdmin(req: AuthRequest): boolean {
  return req.userId === 1;
}

export async function getAllUsers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const [rows] = await db.execute(
      `SELECT 
        u.id, 
        u.username, 
        u.created_at,
        COALESCE(p.can_use_ai_assistant, FALSE) as can_use_ai_assistant
      FROM users u
      LEFT JOIN user_ai_permissions p ON u.id = p.user_id
      ORDER BY u.created_at DESC`,
    );

    res.json({ users: rows });
  } catch (error) {
    console.error("Failed to get users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
}

export async function updateUserAIPermission(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { userId } = req.params;
  const { can_use_ai_assistant } = req.body;

  if (!userId) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  try {
    const [existing] = await db.execute(
      "SELECT id FROM user_ai_permissions WHERE user_id = ?",
      [userId],
    );

    if ((existing as any[]).length > 0) {
      await db.execute(
        "UPDATE user_ai_permissions SET can_use_ai_assistant = ? WHERE user_id = ?",
        [can_use_ai_assistant ? 1 : 0, userId],
      );
    } else {
      await db.execute(
        "INSERT INTO user_ai_permissions (user_id, can_use_ai_assistant) VALUES (?, ?)",
        [userId, can_use_ai_assistant ? 1 : 0],
      );
    }

    res.json({
      message: "Permission updated successfully",
      userId,
      can_use_ai_assistant,
    });
  } catch (error) {
    console.error("Failed to update permission:", error);
    res.status(500).json({ error: "Failed to update permission" });
  }
}

export async function batchUpdateAIPermission(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { userIds, can_use_ai_assistant } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: "User IDs array is required" });
    return;
  }

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const userId of userIds) {
        const [existing] = await connection.execute(
          "SELECT id FROM user_ai_permissions WHERE user_id = ?",
          [userId],
        );

        if ((existing as any[]).length > 0) {
          await connection.execute(
            "UPDATE user_ai_permissions SET can_use_ai_assistant = ? WHERE user_id = ?",
            [can_use_ai_assistant ? 1 : 0, userId],
          );
        } else {
          await connection.execute(
            "INSERT INTO user_ai_permissions (user_id, can_use_ai_assistant) VALUES (?, ?)",
            [userId, can_use_ai_assistant ? 1 : 0],
          );
        }
      }

      await connection.commit();
      res.json({
        message: "Permissions updated successfully",
        updatedCount: userIds.length,
        can_use_ai_assistant,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to batch update permissions:", error);
    res.status(500).json({ error: "Failed to update permissions" });
  }
}

export async function getAIUsageStats(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const [totalUsers] = await db.execute(
      "SELECT COUNT(*) as count FROM users",
    );

    const [aiEnabledUsers] = await db.execute(
      "SELECT COUNT(*) as count FROM user_ai_permissions WHERE can_use_ai_assistant = TRUE",
    );

    const [totalChatMessages] = await db.execute(
      "SELECT COUNT(*) as count FROM ai_chat_history",
    );

    const [todayChatMessages] = await db.execute(
      "SELECT COUNT(*) as count FROM ai_chat_history WHERE DATE(created_at) = CURDATE()",
    );

    const [topUsers] = await db.execute(
      `SELECT 
        u.username,
        COUNT(h.id) as message_count
      FROM users u
      JOIN ai_chat_history h ON u.id = h.user_id
      GROUP BY u.id, u.username
      ORDER BY message_count DESC
      LIMIT 10`,
    );

    res.json({
      stats: {
        totalUsers: (totalUsers as any[])[0].count,
        aiEnabledUsers: (aiEnabledUsers as any[])[0].count,
        totalChatMessages: (totalChatMessages as any[])[0].count,
        todayChatMessages: (todayChatMessages as any[])[0].count,
        topUsers,
      },
    });
  } catch (error) {
    console.error("Failed to get AI usage stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
}

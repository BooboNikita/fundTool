import { Response } from "express";
import OpenAI from "openai";
import db from "../models/database";
import { AuthRequest } from "../types/express";
import { getTop10FundsData, searchFunds } from "./fundController";

const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY || "",
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
});

const SYSTEM_PROMPT = `你是基金助手，一个专业的基金投资顾问。你可以帮助用户：
1. 查询当前持有的基金
2. 查询自选基金
3. 查询当前热门的TOP10基金
4. 根据代码或名称搜索基金

请用专业、友好的语气回答用户的问题。如果用户询问基金相关信息，你可以调用相应的工具来获取数据。`;

export async function checkAIPermission(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [rows] = await db.execute(
      "SELECT can_use_ai_assistant FROM user_ai_permissions WHERE user_id = ?",
      [userId],
    );

    const permissions = rows as any[];
    const canUseAI =
      permissions.length > 0 && permissions[0].can_use_ai_assistant === 1;

    res.json({ canUseAI });
  } catch (error) {
    console.error("Failed to check AI permission:", error);
    res.status(500).json({ error: "Failed to check permission" });
  }
}

// 获取用户的话题列表
export async function getSessions(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, title, created_at, updated_at FROM ai_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
      [userId],
    );

    res.json({ sessions: rows });
  } catch (error) {
    console.error("Failed to get sessions:", error);
    res.status(500).json({ error: "Failed to get sessions" });
  }
}

// 创建新话题
export async function createSession(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { title = "新话题" } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO ai_chat_sessions (user_id, title) VALUES (?, ?)",
      [userId, title],
    );

    const sessionId = (result as any).insertId;
    res.json({ id: sessionId, title });
  } catch (error) {
    console.error("Failed to create session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
}

// 删除话题
export async function deleteSession(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.execute(
      "DELETE FROM ai_chat_sessions WHERE id = ? AND user_id = ?",
      [sessionId, userId],
    );

    res.json({ message: "Session deleted" });
  } catch (error) {
    console.error("Failed to delete session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
}

// 更新话题标题
export async function updateSessionTitle(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId } = req.params;
  const { title } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!title || title.trim() === "") {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  try {
    await db.execute(
      "UPDATE ai_chat_sessions SET title = ? WHERE id = ? AND user_id = ?",
      [title.trim(), sessionId, userId],
    );

    res.json({ message: "Title updated" });
  } catch (error) {
    console.error("Failed to update session title:", error);
    res.status(500).json({ error: "Failed to update title" });
  }
}

export async function chatStream(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { message, sessionId } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const [permissionRows] = await db.execute(
      "SELECT can_use_ai_assistant FROM user_ai_permissions WHERE user_id = ?",
      [userId],
    );

    const permissions = permissionRows as any[];
    if (permissions.length === 0 || permissions[0].can_use_ai_assistant !== 1) {
      res.status(403).json({ error: "AI assistant access denied" });
      return;
    }

    let currentSessionId = sessionId;

    // 如果没有提供sessionId，创建新话题
    if (!currentSessionId) {
      const [result] = await db.execute(
        "INSERT INTO ai_chat_sessions (user_id, title) VALUES (?, ?)",
        [userId, message.slice(0, 50) + (message.length > 50 ? "..." : "")],
      );
      currentSessionId = (result as any).insertId;
    }

    // 保存用户消息
    await db.execute(
      "INSERT INTO ai_chat_history (user_id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [userId, currentSessionId, "user", message],
    );

    // 更新话题时间
    await db.execute(
      "UPDATE ai_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [currentSessionId],
    );

    // 获取该话题的历史记录
    const [historyRows] = await db.execute(
      "SELECT role, content FROM ai_chat_history WHERE session_id = ? ORDER BY created_at DESC LIMIT 20",
      [currentSessionId],
    );

    const history = (historyRows as any[]).reverse();

    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "get_user_holdings",
          description: "获取当前用户持有的基金列表",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_user_watchlist",
          description: "获取当前用户的自选基金列表",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_top10_funds",
          description: "获取当前热门的TOP10基金",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_funds",
          description: "根据代码或名称搜索基金",
          parameters: {
            type: "object",
            properties: {
              keyword: {
                type: "string",
                description: "搜索关键词，可以是基金代码或基金名称",
              },
              limit: {
                type: "number",
                description: "返回结果数量限制，默认10",
              },
            },
            required: ["keyword"],
          },
        },
      },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // 发送sessionId
    res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}

`);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
    ];

    let currentResponse = "";
    let toolCalls: any[] = [];

    const stream = await openai.chat.completions.create({
      model: process.env.KIMI_MODEL || "moonshot-v1-8k",
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!toolCalls[toolCall.index]) {
              toolCalls[toolCall.index] = {
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function?.name || "",
                  arguments: toolCall.function?.arguments || "",
                },
              };
            } else {
              if (toolCall.function?.arguments) {
                toolCalls[toolCall.index].function.arguments +=
                  toolCall.function.arguments;
              }
            }
          }
        }
      }

      if (delta?.content) {
        currentResponse += delta.content;
        res.write(`data: ${JSON.stringify({ content: delta.content })}

`);
      }
    }

    console.log("First stream ended, currentResponse:", currentResponse);

    if (toolCalls.length > 0) {
      const toolResults = [];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

        let result;
        try {
          switch (functionName) {
            case "get_user_holdings":
              result = await getUserHoldingsInternal(userId);
              break;
            case "get_user_watchlist":
              result = await getUserWatchlistInternal(userId);
              break;
            case "get_top10_funds":
              result = await getTop10FundsInternal();
              break;
            case "search_funds":
              result = await searchFundsInternal(
                functionArgs.keyword,
                functionArgs.limit || 10,
              );
              break;
            default:
              result = { error: "Unknown function" };
          }
        } catch (error) {
          result = { error: String(error) };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool" as const,
          content: JSON.stringify(result),
        });
      }

      messages.push({
        role: "assistant",
        content: currentResponse || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        })),
      });

      for (const toolResult of toolResults) {
        messages.push(toolResult);
      }

      const finalStream = await openai.chat.completions.create({
        model: process.env.KIMI_MODEL || "moonshot-v1-8k",
        messages,
        stream: true,
      });

      for await (const chunk of finalStream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          currentResponse += content;
          console.log("Final stream content:", content);
          res.write(`data: ${JSON.stringify({ content })}

`);
        }
      }
      console.log("Final stream ended, total response:", currentResponse);
    }

    // 保存AI回复
    await db.execute(
      "INSERT INTO ai_chat_history (user_id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [userId, currentSessionId, "assistant", currentResponse],
    );

    res.write(`data: ${JSON.stringify({ done: true })}

`);
    res.end();
  } catch (error) {
    console.error("AI chat error:", error);
    res.write(`data: ${JSON.stringify({ error: "Chat service error" })}

`);
    res.end();
  }
}

async function getUserHoldingsInternal(userId: number) {
  const [rows] = await db.execute(
    "SELECT code, name, note FROM funds WHERE user_id = ? AND is_holding = TRUE",
    [userId],
  );
  return { holdings: rows };
}

async function getUserWatchlistInternal(userId: number) {
  const [rows] = await db.execute(
    "SELECT code, name, note FROM funds WHERE user_id = ? AND is_watchlist = TRUE",
    [userId],
  );
  return { watchlist: rows };
}

async function getTop10FundsInternal() {
  try {
    const top10 = await getTop10FundsData();
    return { top10 };
  } catch (error) {
    return { error: String(error) };
  }
}

async function searchFundsInternal(keyword: string, limit: number) {
  try {
    const results = await searchFunds(keyword, limit);
    return { results };
  } catch (error) {
    return { error: String(error) };
  }
}

// 获取指定话题的聊天记录
export async function getChatHistory(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, role, content, created_at FROM ai_chat_history WHERE user_id = ? AND session_id = ? AND deleted = FALSE ORDER BY created_at ASC LIMIT 100",
      [userId, sessionId],
    );

    res.json({ history: rows });
  } catch (error) {
    console.error("Failed to get chat history:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
}

// 清空指定话题的聊天记录
export async function clearChatHistory(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.execute(
      "DELETE FROM ai_chat_history WHERE user_id = ? AND session_id = ?",
      [userId, sessionId],
    );
    res.json({ message: "Chat history cleared" });
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}

// 标记指定消息及之后的所有消息为删除（用于刷新功能）
export async function deleteMessagesFrom(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId, messageId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // 先获取该消息的创建时间
    const [rows] = await db.execute(
      "SELECT created_at FROM ai_chat_history WHERE id = ? AND user_id = ? AND session_id = ?",
      [messageId, userId, sessionId],
    );

    const messages = rows as any[];
    if (messages.length === 0) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const createdAt = messages[0].created_at;

    // 标记该消息及之后创建的所有消息为删除
    await db.execute(
      "UPDATE ai_chat_history SET deleted = TRUE WHERE user_id = ? AND session_id = ? AND created_at >= ?",
      [userId, sessionId, createdAt],
    );

    res.json({ message: "Messages marked as deleted" });
  } catch (error) {
    console.error("Failed to mark messages as deleted:", error);
    res.status(500).json({ error: "Failed to mark messages as deleted" });
  }
}

// 保存消息（用于前端中止时保存已接收的内容）
export async function saveMessage(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const userId = req.userId;
  const { sessionId } = req.params;
  const { role, content } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!sessionId || !role || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    await db.execute(
      "INSERT INTO ai_chat_history (user_id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [userId, sessionId, role, content],
    );

    // 更新话题时间
    await db.execute(
      "UPDATE ai_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [sessionId],
    );

    res.json({ message: "Message saved" });
  } catch (error) {
    console.error("Failed to save message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
}

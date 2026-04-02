import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import db from "../models/database";
import { generateToken } from "../middleware/auth";

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  if (username.length < 3 || password.length < 6) {
    res
      .status(400)
      .json({
        error:
          "Username must be at least 3 characters, password at least 6 characters",
      });
    return;
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    const [result] = await db.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
    );

    const insertId = (result as any).insertId;
    const token = generateToken(insertId, username);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: insertId,
        username,
      },
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Username already exists" });
    } else {
      console.error("Register error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    const users = rows as any[];

    if (users.length === 0) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const user = users[0];

    if (!bcrypt.compareSync(password, user.password)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = generateToken(user.id, user.username);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
};

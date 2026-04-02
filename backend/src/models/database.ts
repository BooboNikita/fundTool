import mysql, { Pool, PoolConnection } from "mysql2/promise";

const env = process.env.NODE_ENV || "development";
const isDev = env === "development";

const dbConfig = {
  host: isDev
    ? process.env.DEV_DB_HOST
    : process.env.PROD_DB_HOST || "localhost",
  port: parseInt(
    isDev
      ? process.env.DEV_DB_PORT || "3306"
      : process.env.PROD_DB_PORT || "3306",
  ),
  user: isDev ? process.env.DEV_DB_USER : process.env.PROD_DB_USER || "root",
  password: isDev
    ? process.env.DEV_DB_PASSWORD
    : process.env.PROD_DB_PASSWORD || "",
  database: isDev
    ? process.env.DEV_DB_NAME
    : process.env.PROD_DB_NAME || "fund_tool",
};

console.log(
  `Running in ${env} mode, connecting to database: ${dbConfig.database}@${dbConfig.host}`,
);

async function createDatabaseIfNotExists(): Promise<void> {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  try {
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`Database '${dbConfig.database}' ensured to exist`);
  } finally {
    await connection.end();
  }
}

const pool: Pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function initDatabase(): Promise<void> {
  await createDatabaseIfNotExists();

  const connection = await pool.getConnection();

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS funds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        note TEXT,
        is_watchlist BOOLEAN DEFAULT TRUE,
        is_holding BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_fund (user_id, code)
      )
    `);

    try {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'funds' AND COLUMN_NAME = 'category'`,
      );
      if ((columns as any[]).length > 0) {
        await connection.execute(`
          UPDATE funds SET is_watchlist = TRUE, is_holding = (category = 'holding')
        `);
        await connection.execute(`ALTER TABLE funds DROP COLUMN category`);
      }
    } catch (e: any) {
      console.log("Migration check:", e.message);
    }

    try {
      await connection.execute(
        `ALTER TABLE funds ADD COLUMN is_watchlist BOOLEAN DEFAULT TRUE`,
      );
    } catch (e: any) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }

    try {
      await connection.execute(
        `ALTER TABLE funds ADD COLUMN is_holding BOOLEAN DEFAULT FALSE`,
      );
    } catch (e: any) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dingtalk_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        webhook_url VARCHAR(512) NOT NULL,
        secret VARCHAR(128),
        push_times JSON,
        push_interval_hours INT DEFAULT 0,
        push_enabled BOOLEAN DEFAULT FALSE,
        push_watchlist BOOLEAN DEFAULT TRUE,
        push_holding BOOLEAN DEFAULT TRUE,
        last_push_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_ai_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        can_use_ai_assistant BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '新话题',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_updated (user_id, updated_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id INT NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_time (session_id, created_at),
        INDEX idx_user_time (user_id, created_at)
      )
    `);

    // 检查并添加 session_id 列到已存在的表（迁移）
    try {
      const [sessionIdColumns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ai_chat_history' AND COLUMN_NAME = 'session_id'`,
        [dbConfig.database!],
      );

      if ((sessionIdColumns as any[]).length === 0) {
        console.log(
          "Migrating ai_chat_history table: adding session_id column...",
        );

        // 创建临时表
        await connection.execute(`
          CREATE TABLE ai_chat_history_new (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id INT NOT NULL,
            role ENUM('user', 'assistant') NOT NULL,
            content TEXT NOT NULL,
            deleted BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
            INDEX idx_session_time (session_id, created_at),
            INDEX idx_user_time (user_id, created_at)
          )
        `);

        // 删除旧表
        await connection.execute(`DROP TABLE ai_chat_history`);

        // 重命名新表
        await connection.execute(
          `RENAME TABLE ai_chat_history_new TO ai_chat_history`,
        );

        console.log("Migration completed");
      }

      // 检查是否需要添加 deleted 字段
      const [deletedColumns] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ai_chat_history' AND COLUMN_NAME = 'deleted'"
      );

      if ((deletedColumns as any[]).length === 0) {
        console.log("Adding deleted column to ai_chat_history table...");
        await connection.execute(
          "ALTER TABLE ai_chat_history ADD COLUMN deleted BOOLEAN DEFAULT FALSE"
        );
        console.log("deleted column added");
      }
    } catch (e: any) {
      console.log("Migration check error:", e.message);
    }

    console.log("Database tables initialized");
  } finally {
    connection.release();
  }
}

export default pool;

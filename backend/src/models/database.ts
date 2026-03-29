import mysql, { Pool, PoolConnection } from 'mysql2/promise';

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fund_tool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDatabase(): Promise<void> {
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
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'funds' AND COLUMN_NAME = 'category'`
      );
      if ((columns as any[]).length > 0) {
        await connection.execute(`
          UPDATE funds SET is_watchlist = TRUE, is_holding = (category = 'holding')
        `);
        await connection.execute(`ALTER TABLE funds DROP COLUMN category`);
      }
    } catch (e: any) {
      console.log('Migration check:', e.message);
    }
    
    try {
      await connection.execute(`ALTER TABLE funds ADD COLUMN is_watchlist BOOLEAN DEFAULT TRUE`);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    
    try {
      await connection.execute(`ALTER TABLE funds ADD COLUMN is_holding BOOLEAN DEFAULT FALSE`);
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
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
    
    console.log('Database tables initialized');
  } finally {
    connection.release();
  }
}

export default pool;

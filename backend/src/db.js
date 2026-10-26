import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let pool;
let initialized = false;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'records_user',
      password: process.env.DB_PASSWORD || 'records_password',
      database: process.env.DB_NAME || 'records_app',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      decimalNumbers: true
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (initialized) return;
  const db = getPool();
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_records_status (status),
    INDEX idx_records_name (last_name, first_name),
    INDEX idx_records_email (email)
  )`);
  const [users] = await db.execute('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
  if (users.length === 0) {
    const hash = await bcrypt.hash('Password123!', 10);
    await db.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', ['admin@example.com', hash]);
  }
  initialized = true;
}

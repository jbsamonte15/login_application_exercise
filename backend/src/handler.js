import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, ensureSchema } from './db.js';

const response = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  },
  body: JSON.stringify(payload)
});
const badRequest = (message) => response(400, { message });
const serverError = (err) => {
  console.error(err);
  return response(500, { message: 'Internal server error' });
};
const bodyOf = (event) => {
  try { return JSON.parse(event.body || '{}'); } catch { return null; }
};
const tokenFrom = (event) => {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};
function requireAuth(event) {
  const token = tokenFrom(event);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'local-demo-secret-change-me');
  } catch { return null; }
}
function validateRecord(input) {
  if (!input || typeof input !== 'object') return 'Invalid JSON body';
  if (!String(input.firstName || '').trim()) return 'First name is required';
  if (!String(input.lastName || '').trim()) return 'Last name is required';
  if (!String(input.email || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'A valid email is required';
  if (input.status && !['Active', 'Inactive'].includes(input.status)) return 'Status must be Active or Inactive';
  if (String(input.firstName).length > 100 || String(input.lastName).length > 100) return 'Names must be 100 characters or fewer';
  if (String(input.email).length > 255 || String(input.phone || '').length > 50) return 'Email or phone is too long';
  return null;
}
const recordFields = (r) => ({
  id: Number(r.id), firstName: r.first_name, lastName: r.last_name,
  email: r.email, phone: r.phone || '', status: r.status,
  notes: r.notes || '', createdAt: r.created_at, updatedAt: r.updated_at
});

export async function health() {
  try {
    await ensureSchema();
    await getPool().query('SELECT 1');
    return response(200, { status: 'ok' });
  } catch (e) { return serverError(e); }
}

export async function login(event) {
  try {
    await ensureSchema();
    const body = bodyOf(event);
    if (!body) return badRequest('Invalid JSON body');
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return badRequest('Email and password are required');
    const [rows] = await getPool().execute('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return response(401, { message: 'Invalid email or password' });
    }
    const token = jwt.sign({ sub: String(rows[0].id), email: rows[0].email },
      process.env.JWT_SECRET || 'local-demo-secret-change-me', { expiresIn: '8h' });
    return response(200, { token, user: { id: Number(rows[0].id), email: rows[0].email } });
  } catch (e) { return serverError(e); }
}

export async function listRecords(event) {
  try {
    await ensureSchema();
    if (!requireAuth(event)) return response(401, { message: 'Unauthorized' });
    const q = String(event.queryStringParameters?.q || '').trim().slice(0, 200);
    const status = String(event.queryStringParameters?.status || '').trim();
    const where = [];
    const values = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?)');
      values.push(like, like, like, like, like);
    }
    if (['Active', 'Inactive'].includes(status)) {
      where.push('status = ?');
      values.push(status);
    }
    const sql = `SELECT * FROM records ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC, id DESC`;
    const [rows] = await getPool().execute(sql, values);
    return response(200, { records: rows.map(recordFields) });
  } catch (e) { return serverError(e); }
}

export async function createRecord(event) {
  try {
    await ensureSchema();
    if (!requireAuth(event)) return response(401, { message: 'Unauthorized' });
    const body = bodyOf(event);
    const validation = validateRecord(body);
    if (validation) return badRequest(validation);
    const values = [
      String(body.firstName).trim(), String(body.lastName).trim(),
      String(body.email).trim().toLowerCase(), String(body.phone || '').trim(),
      body.status || 'Active', String(body.notes || '').trim()
    ];
    const [result] = await getPool().execute(
      'INSERT INTO records (first_name,last_name,email,phone,status,notes) VALUES (?,?,?,?,?,?)', values);
    const [rows] = await getPool().execute('SELECT * FROM records WHERE id = ?', [result.insertId]);
    return response(201, { record: recordFields(rows[0]) });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return response(409, { message: 'A record with that unique value already exists' });
    return serverError(e);
  }
}

export async function updateRecord(event) {
  try {
    await ensureSchema();
    if (!requireAuth(event)) return response(401, { message: 'Unauthorized' });
    const id = Number(event.pathParameters?.id);
    if (!Number.isSafeInteger(id) || id < 1) return badRequest('Invalid record ID');
    const body = bodyOf(event);
    const validation = validateRecord(body);
    if (validation) return badRequest(validation);
    const values = [
      String(body.firstName).trim(), String(body.lastName).trim(),
      String(body.email).trim().toLowerCase(), String(body.phone || '').trim(),
      body.status || 'Active', String(body.notes || '').trim(), id
    ];
    const [result] = await getPool().execute(
      'UPDATE records SET first_name=?,last_name=?,email=?,phone=?,status=?,notes=? WHERE id=?', values);
    if (!result.affectedRows) {
      const [existing] = await getPool().execute('SELECT id FROM records WHERE id=?', [id]);
      if (!existing.length) return response(404, { message: 'Record not found' });
    }
    const [rows] = await getPool().execute('SELECT * FROM records WHERE id=?', [id]);
    return response(200, { record: recordFields(rows[0]) });
  } catch (e) { return serverError(e); }
}

export async function deleteRecord(event) {
  try {
    await ensureSchema();
    if (!requireAuth(event)) return response(401, { message: 'Unauthorized' });
    const id = Number(event.pathParameters?.id);
    if (!Number.isSafeInteger(id) || id < 1) return badRequest('Invalid record ID');
    const [result] = await getPool().execute('DELETE FROM records WHERE id=?', [id]);
    if (!result.affectedRows) return response(404, { message: 'Record not found' });
    return response(200, { message: 'Record deleted' });
  } catch (e) { return serverError(e); }
}

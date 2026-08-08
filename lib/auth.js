import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const secret = () => {
  const value = process.env.JWT_SECRET || '';
  if (value.length < 32) throw new Error('JWT_SECRET en az 32 karakter olmali.');
  return new TextEncoder().encode(value);
};

export async function verifyAdminCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || '';
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  if (!expectedUser || !hash) return false;
  return username === expectedUser && await bcrypt.compare(password, hash);
}

export async function createSession(username) {
  return new SignJWT({ role: 'admin', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('umera-design-3d')
    .setAudience('umera-admin')
    .setExpirationTime('8h')
    .sign(secret());
}

export async function requireAdmin(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)umera_admin=([^;]+)/);
  if (!match) throw new Error('UNAUTHORIZED');
  try {
    const { payload } = await jwtVerify(decodeURIComponent(match[1]), secret(), {
      issuer: 'umera-design-3d', audience: 'umera-admin'
    });
    if (payload.role !== 'admin') throw new Error('UNAUTHORIZED');
    return payload;
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}

export function sessionCookie(token) {
  return `umera_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}
export const clearSessionCookie = 'umera_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

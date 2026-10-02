import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";

import { db } from "../../../db";
import { users, userTwoFactor } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { env } from "../../../../config/env";

const ISSUER = "ANKUCAMP";
const BACKUP_CODES_COUNT = 10;
const TOTP_WINDOW = 1; // tolérance ±30s
const TOTP_STEP = 30; // secondes
const TOTP_DIGITS = 6;

// ============================================================
// TOTP (RFC 6238) — implémentation native sans dépendance
// ============================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const cleaned = input
    .toUpperCase()
    .replace(/=+$/, "")
    .replace(/\s/g, "");

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Caractère base32 invalide : ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function generateTOTP(
  secret: string,
  time: number = Date.now()
): string {
  const counter = Math.floor(time / 1000 / TOTP_STEP);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

function verifyTOTP(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const now = Date.now();
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const time = now + i * TOTP_STEP * 1000;
    if (generateTOTP(secret, time) === token) return true;
  }
  return false;
}

function buildOtpauthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ============================================================
// HELPERS
// ============================================================

async function hashBackupCodes(plainCodes: string[]): Promise<string[]> {
  return Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
}

async function verifyAndConsumeBackupCode(
  row: any,
  plainCode: string
): Promise<boolean> {
  if (!row.backup_codes) return false;

  const codes: string[] = JSON.parse(row.backup_codes);
  const upperCode = plainCode.toUpperCase();

  for (let i = 0; i < codes.length; i++) {
    const ok = await bcrypt.compare(upperCode, codes[i]);
    if (ok) {
      codes.splice(i, 1);
      await db
        .update(userTwoFactor)
        .set({
          backup_codes: JSON.stringify(codes),
          updated_at: new Date(),
        })
        .where(eq(userTwoFactor.id, row.id));
      return true;
    }
  }
  return false;
}

// ============================================================
// STATUS
// ============================================================

export async function is2FAEnabled(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ enabled: userTwoFactor.enabled })
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  return row?.enabled === 1;
}

export async function get2FAStatus(userId: number) {
  const [row] = await db
    .select()
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  if (!row) {
    return { enabled: false, setup_in_progress: false };
  }
  return {
    enabled: row.enabled === 1,
    setup_in_progress: row.enabled === 0,
  };
}

// ============================================================
// SETUP
// ============================================================

export async function setup2FA(userId: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const [existing] = await db
    .select()
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  if (existing?.enabled === 1) {
    throw new AppError(
      "La 2FA est déjà activée. Désactive-la d'abord pour en générer une nouvelle.",
      409
    );
  }

  const secret = generateSecret();
  const otpauth = buildOtpauthUri(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  if (existing) {
    await db
      .update(userTwoFactor)
      .set({ secret, updated_at: new Date() })
      .where(eq(userTwoFactor.user_id, userId));
  } else {
    await db.insert(userTwoFactor).values({ user_id: userId, secret });
  }

  return { secret, qr_code: qrCodeDataUrl, otpauth };
}

export async function verify2FASetup(userId: number, code: string) {
  const [row] = await db
    .select()
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  if (!row) throw new AppError("Aucun setup 2FA en cours", 404);
  if (row.enabled === 1) throw new AppError("La 2FA est déjà activée", 409);

  const valid = verifyTOTP(code, row.secret);
  if (!valid) throw new AppError("Code invalide ou expiré", 400);

  const plainCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    plainCodes.push(crypto.randomBytes(5).toString("hex").toUpperCase());
  }
  const hashedCodes = await hashBackupCodes(plainCodes);

  await db
    .update(userTwoFactor)
    .set({
      enabled: 1,
      backup_codes: JSON.stringify(hashedCodes),
      enabled_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(userTwoFactor.user_id, userId));

  return { enabled: true, backup_codes: plainCodes };
}

// ============================================================
// DISABLE
// ============================================================

export async function disable2FA(
  userId: number,
  password: string,
  code: string
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const passwordOk = await bcrypt.compare(password, user.password_hash ?? "");
  if (!passwordOk) throw new AppError("Mot de passe incorrect", 401);

  const [row] = await db
    .select()
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  if (!row || row.enabled !== 1) {
    throw new AppError("La 2FA n'est pas activée", 400);
  }

  const totpValid = verifyTOTP(code, row.secret);
  if (!totpValid) {
    const backupValid = await verifyAndConsumeBackupCode(row, code);
    if (!backupValid) throw new AppError("Code invalide", 401);
  }

  await db.delete(userTwoFactor).where(eq(userTwoFactor.user_id, userId));

  return { disabled: true };
}

// ============================================================
// LOGIN ÉTAPE 2
// ============================================================

export function create2FATempToken(userId: number): string {
  return jwt.sign({ user_id: userId, purpose: "2fa" }, env.JWT_SECRET, {
    expiresIn: "5m",
  });
}

export async function validate2FALogin(tempToken: string, code: string) {
  let payload: any;
  try {
    payload = jwt.verify(tempToken, env.JWT_SECRET);
  } catch {
    throw new AppError("Session 2FA expirée ou invalide", 401);
  }

  if (payload.purpose !== "2fa" || !payload.user_id) {
    throw new AppError("Token invalide", 401);
  }

  const userId = Number(payload.user_id);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const [row] = await db
    .select()
    .from(userTwoFactor)
    .where(eq(userTwoFactor.user_id, userId))
    .limit(1);

  if (!row || row.enabled !== 1) {
    throw new AppError("La 2FA n'est pas activée pour ce compte", 400);
  }

  const totpValid = verifyTOTP(code, row.secret);
  if (!totpValid) {
    const backupValid = await verifyAndConsumeBackupCode(row, code);
    if (!backupValid) throw new AppError("Code invalide", 401);
  }

  await db
    .update(userTwoFactor)
    .set({ last_used_at: new Date() })
    .where(eq(userTwoFactor.user_id, userId));

  return user;
}
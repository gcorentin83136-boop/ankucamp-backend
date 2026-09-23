import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export interface TokenPayload {
  id: number;
  email: string;
  role: "professionnel" | "particulier";
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { config, cookieName } from "./config.js";
import { HttpError } from "./errors.js";
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  disabled: boolean;
}
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export const publicUser = (u: AuthUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
  disabled: u.disabled,
});
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[cookieName];
  if (typeof token !== "string")
    throw new HttpError(401, "Please sign in to continue.");
  let userId: string;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "assessment-api",
      audience: "assessment-web",
    });
    if (typeof decoded === "string" || typeof decoded.sub !== "string")
      throw new Error();
    userId = decoded.sub;
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.disabled)
    throw new HttpError(401, "This account is unavailable.");
  req.user = publicUser(user);
  next();
};
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required.");
  next();
};
export function issueToken(id: string) {
  return jwt.sign({}, config.JWT_SECRET, {
    subject: id,
    expiresIn: "12h",
    algorithm: "HS256",
    issuer: "assessment-api",
    audience: "assessment-web",
  });
}

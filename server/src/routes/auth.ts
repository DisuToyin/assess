import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { HttpError } from "../errors.js";
import { config, cookieName, cookieOptions } from "../config.js";
import { issueToken, publicUser, requireAuth } from "../auth.js";
export const authRouter = Router();
authRouter.use(
  ["/register", "/login"],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many authentication requests. Try again in 15 minutes.",
    },
  }),
);
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(10)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes.",
    ),
});
const dummyHash = await bcrypt.hash(
  "a-placeholder-used-to-reduce-login-timing-differences",
  12,
);
authRouter.post("/register", async (req, res) => {
  const data = credentials
    .extend({
      name: z.string().trim().min(2).max(100),
      adminSecret: z.string().max(200).optional(),
    })
    .parse(req.body);
  const isAdmin = data.email === "disujt@gmail.com";
  if (isAdmin) {
    const supplied = Buffer.from(data.adminSecret ?? "");
    const expected = Buffer.from(config.ADMIN_REGISTRATION_SECRET);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new HttpError(
        403,
        "The administrator registration key is required for this email.",
      );
  }
  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: isAdmin ? "ADMIN" : "TAKER",
    },
  });
  res
    .cookie(cookieName, issueToken(user.id), {
      ...cookieOptions,
      maxAge: 12 * 60 * 60 * 1000,
    })
    .status(201)
    .json(publicUser(user));
});
authRouter.post("/login", async (req, res) => {
  const data = credentials.parse(req.body);
  const user = await db.user.findUnique({ where: { email: data.email } });
  const valid = await bcrypt.compare(
    data.password,
    user?.passwordHash ?? dummyHash,
  );
  if (!user || !valid || user.disabled)
    throw new HttpError(
      401,
      "Email or password is incorrect, or the account is disabled.",
    );
  res
    .cookie(cookieName, issueToken(user.id), {
      ...cookieOptions,
      maxAge: 12 * 60 * 60 * 1000,
    })
    .json(publicUser(user));
});
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(cookieName, cookieOptions).json({ ok: true });
});
authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

import "dotenv/config";
import { z } from "zod";
const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    ADMIN_REGISTRATION_SECRET: z.string().min(20),
    CLIENT_ORIGIN: z.url(),
    TRUST_PROXY: z.enum(["true", "false"]).default("false"),
    COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (!env.CLIENT_ORIGIN.startsWith("https://") ||
    env.JWT_SECRET.startsWith("replace-") ||
    env.ADMIN_REGISTRATION_SECRET.startsWith("replace-"))
)
  throw new Error("Set HTTPS origin and unique production secrets.");
export const config = {
  ...env,
  CLIENT_ORIGIN: new URL(env.CLIENT_ORIGIN).origin,
};
export const cookieName =
  env.NODE_ENV === "production" ? "__Host-assessment" : "assessment";
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAME_SITE,
  path: "/",
} as const;

import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers, cookies } from "next/headers";
import { serviceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/config/server";

export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function tokenForSubmission(key: string, payload: string) {
  const secret = process.env.STATUS_TOKEN_SECRET;
  if (!secret || secret.length < 64) throw new Error("A strong status token secret is required.");
  return createHmac("sha256", secret).update(`${key}:${payload}`).digest("base64url");
}
export function newAccessToken() {
  return randomBytes(32).toString("base64url");
}
export function matchesHash(token: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(expected, "hex"));
}
const cookieName = (reference: string) => `vl_${reference}`;
export async function saveAccess(reference: string, token: string) {
  (await cookies()).set(cookieName(reference), token, {
    httpOnly: true,
    secure: siteUrl().startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}
export async function readAccess(reference: string) {
  return (await cookies()).get(cookieName(reference))?.value;
}
export function privateLink(reference: string, token: string) {
  return `${siteUrl()}/access#${new URLSearchParams({ reference, key: token })}`;
}
export async function rateLimit(scope: string, limit = 10, seconds = 3600) {
  const h = await headers();
  // Never trust arbitrary X-Forwarded-For. Unknown/local ingress shares one conservative bucket.
  const trusted = process.env.VERCEL === "1" && process.env.TRUST_VERCEL_IP === "true";
  const ip = trusted
    ? h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "shared"
    : "shared";
  const { data, error } = await serviceClient().rpc("consume_rate_limit", {
    p_key: hash(`${scope}:${ip}`),
    p_limit: limit,
    p_window_seconds: seconds,
  });
  if (error || data !== true)
    throw new Error("Too many requests. Please wait a while and try again.");
}

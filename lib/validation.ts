import { z } from "zod";
import { CHANNELS, PRODUCTS } from "./domain";

const role = z.enum(["reviewer", "marketer"]);
const copy = z.string().trim().min(20, "Add at least 20 characters of creative.").max(6000, "Creative must be 6,000 characters or fewer.");
const note = z.string().trim().max(2000);
const campaignId = z.string().min(1).max(80);
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("submit"), role, name: z.string().trim().min(3).max(120), product: z.enum(PRODUCTS as [typeof PRODUCTS[number], ...typeof PRODUCTS[number][]]), channel: z.enum(CHANNELS as [typeof CHANNELS[number], ...typeof CHANNELS[number][]]), partner: z.string().trim().max(100), dueAt: z.string().datetime(), copy }),
  z.object({ type: z.literal("revise"), role, campaignId, copy, note }),
  z.object({ type: z.literal("disposition"), role, campaignId, findingId: z.string().min(1).max(80), disposition: z.enum(["open", "confirmed", "dismissed"]), reason: note }),
  z.object({ type: z.literal("decision"), role, campaignId, decision: z.enum(["approved", "changes_requested"]), note, attested: z.boolean() }),
  z.object({ type: z.literal("comment"), role, campaignId, note: z.string().trim().min(2).max(2000) }),
  z.object({ type: z.literal("reset"), role }),
]);
export const mutationSchema = z.object({ revision: z.number().int().nonnegative(), action: actionSchema });
export const aiRequestSchema = z.object({ revision: z.number().int().nonnegative(), campaignId, role: role.default("reviewer"), version: z.number().int().positive(), model: z.enum(["gemini-3.8-flash", "gemini-3.5-flash-lite"]).default("gemini-3.5-flash-lite") });

import type { MemberRole, MemberTierKey } from "@/types/database";

export const MEMBER_TIER_ORDER: Record<MemberTierKey, number> = {
  super_poor: 10,
  poor: 20,
  commoner: 30,
  merchant: 40,
  noble: 50,
  royal_citizen: 60,
  royal_relative: 70,
  royal_direct: 80,
  king: 90,
};

export const MEMBER_TIER_LABELS: Record<MemberTierKey, string> = {
  super_poor: "超級窮",
  poor: "貧民",
  commoner: "平民",
  merchant: "商人",
  noble: "貴族",
  royal_citizen: "皇民",
  royal_relative: "皇親",
  royal_direct: "皇族",
  king: "國王",
};

export const MANUAL_ONLY_TIERS: MemberTierKey[] = ["royal_relative", "royal_direct", "king"];

// Stage 13: every legal tier ordered low -> high, reusing the shared tier order
// so this list can never drift from the rest of the app.
export const ADMIN_TIER_KEYS = (Object.keys(MEMBER_TIER_ORDER) as MemberTierKey[]).sort(
  (a, b) => MEMBER_TIER_ORDER[a] - MEMBER_TIER_ORDER[b],
);

// High-privilege royal tiers that only an owner may assign. admin may assign the rest.
export const OWNER_ONLY_TIER_KEYS: MemberTierKey[] = ["royal_relative", "royal_direct", "king"];

export type AdminTierOption = {
  key: MemberTierKey;
  label: string;
  ownerOnly: boolean;
};

export function isMemberTierKey(value: unknown): value is MemberTierKey {
  return typeof value === "string" && (ADMIN_TIER_KEYS as string[]).includes(value);
}

export function isOwnerOnlyTier(tier: MemberTierKey): boolean {
  return OWNER_ONLY_TIER_KEYS.includes(tier);
}

export function getAdminTierOptions(): AdminTierOption[] {
  return ADMIN_TIER_KEYS.map((key) => ({
    key,
    label: getTierLabel(key),
    ownerOnly: isOwnerOnlyTier(key),
  }));
}

// admin can assign the six general tiers; owner can assign everything.
export function canActorAssignTier(role: MemberRole, tier: MemberTierKey): boolean {
  if (role === "owner") return true;
  if (role === "admin") return !isOwnerOnlyTier(tier);
  return false;
}

export type TierCalculationInput = {
  role?: MemberRole | null;
  emailVerified?: boolean | null;
  lifetimeEarnedPoints?: number | null;
  totalValidSpend?: number | null;
  currentTier?: MemberTierKey | null;
  minimumTier?: MemberTierKey | null;
  upgradeDisabled?: boolean | null;
};

export function getTierLabel(tier: string | null | undefined) {
  return MEMBER_TIER_LABELS[(tier as MemberTierKey) || "super_poor"] ?? "超級窮";
}

export function getTierOrder(tier: string | null | undefined) {
  return MEMBER_TIER_ORDER[(tier as MemberTierKey) || "super_poor"] ?? 10;
}

export function calculateMinimumTier(input: Pick<TierCalculationInput, "role" | "emailVerified" | "totalValidSpend">): MemberTierKey {
  if (!input.emailVerified || input.role === "pending_member") return "super_poor";
  if (Number(input.totalValidSpend ?? 0) >= 2000) return "merchant";
  return "poor";
}

export function calculateEligibleTier(input: TierCalculationInput): MemberTierKey {
  if (!input.emailVerified || input.role === "pending_member") return "super_poor";

  const lifetimeEarnedPoints = Number(input.lifetimeEarnedPoints ?? 0);
  const totalValidSpend = Number(input.totalValidSpend ?? 0);

  if (lifetimeEarnedPoints >= 7000) return "royal_citizen";
  if (lifetimeEarnedPoints >= 5000) return "noble";
  if (totalValidSpend >= 2000) return "merchant";
  if (totalValidSpend >= 500) return "commoner";
  return "poor";
}

export function calculateTierAfterInactivity(input: TierCalculationInput): MemberTierKey {
  const minimumTier = input.minimumTier ?? calculateMinimumTier(input);
  const currentTier = input.currentTier ?? calculateEligibleTier(input);

  if (getTierOrder(currentTier) <= getTierOrder(minimumTier)) return minimumTier;
  return currentTier;
}

export function shouldUpgradeTier(input: TierCalculationInput) {
  if (input.upgradeDisabled) return false;
  const currentTier = input.currentTier ?? "super_poor";
  const eligibleTier = calculateEligibleTier(input);
  return getTierOrder(eligibleTier) > getTierOrder(currentTier);
}

export function shouldCreateTierHistory(oldTier: MemberTierKey | null | undefined, newTier: MemberTierKey | null | undefined) {
  return Boolean(oldTier && newTier && oldTier !== newTier);
}

export function getTierProgress(input: TierCalculationInput) {
  const eligibleTier = calculateEligibleTier(input);
  const lifetimeEarnedPoints = Number(input.lifetimeEarnedPoints ?? 0);
  const totalValidSpend = Number(input.totalValidSpend ?? 0);

  if (getTierOrder(eligibleTier) < getTierOrder("commoner")) {
    return { nextTier: "commoner" as MemberTierKey, current: totalValidSpend, target: 500 };
  }
  if (getTierOrder(eligibleTier) < getTierOrder("merchant")) {
    return { nextTier: "merchant" as MemberTierKey, current: totalValidSpend, target: 2000 };
  }
  if (getTierOrder(eligibleTier) < getTierOrder("noble")) {
    return { nextTier: "noble" as MemberTierKey, current: lifetimeEarnedPoints, target: 5000 };
  }
  if (getTierOrder(eligibleTier) < getTierOrder("royal_citizen")) {
    return { nextTier: "royal_citizen" as MemberTierKey, current: lifetimeEarnedPoints, target: 7000 };
  }
  return null;
}

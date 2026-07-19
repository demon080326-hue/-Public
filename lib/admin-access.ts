import "server-only";

import type { CurrentMemberContext } from "@/lib/member-profile";
import { getCurrentMemberContext } from "@/lib/member-profile";
import { getAuthUserSummary } from "@/lib/auth-user";
import type { AuthUserSummary } from "@/lib/auth-user";
import type { MemberRole, ProfileRow } from "@/types/database";

export type AdminAccessStatus =
  | "unauthenticated"
  | "profile_missing"
  | "email_unverified"
  | "reverification_required"
  | "forbidden"
  | "allowed";

export type AdminAccessState = {
  status: AdminAccessStatus;
  member: CurrentMemberContext | null;
  user: AuthUserSummary | null;
  profile: ProfileRow | null;
  role: MemberRole | null;
  ownerOnly: boolean;
};

export async function getCurrentAuthUser() {
  return getAuthUserSummary();
}

export async function getCurrentProfile() {
  const member = await getCurrentMemberContext({ syncProfileFromAuth: true });
  return member?.profile ?? null;
}

export async function getCurrentRole() {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}

export function isAdminRole(role: MemberRole | null | undefined): role is "admin" | "owner" {
  return role === "admin" || role === "owner";
}

export function isOwnerRole(role: MemberRole | null | undefined): role is "owner" {
  return role === "owner";
}

export async function getAdminAccessState(options: { ownerOnly?: boolean } = {}): Promise<AdminAccessState> {
  const ownerOnly = options.ownerOnly === true;
  const member = await getCurrentMemberContext({ syncProfileFromAuth: true });

  if (!member) {
    return { status: "unauthenticated", member: null, user: null, profile: null, role: null, ownerOnly };
  }

  const profile = member.profile;
  const role = profile?.role ?? null;

  if (member.profileStatus !== "ready" || !profile) {
    return { status: "profile_missing", member, user: member.user, profile: null, role: null, ownerOnly };
  }

  if (!member.user.emailVerified || profile.email_verified !== true) {
    return { status: "email_unverified", member, user: member.user, profile, role, ownerOnly };
  }

  if (member.securityStatus !== "ready" || member.securityState?.requires_reverification !== false) {
    return { status: "reverification_required", member, user: member.user, profile, role, ownerOnly };
  }

  if (ownerOnly ? !isOwnerRole(role) : !isAdminRole(role)) {
    return { status: "forbidden", member, user: member.user, profile, role, ownerOnly };
  }

  return { status: "allowed", member, user: member.user, profile, role, ownerOnly };
}

export async function requireAdminAccess() {
  return getAdminAccessState();
}

export async function requireOwnerAccess() {
  return getAdminAccessState({ ownerOnly: true });
}

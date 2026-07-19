import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminMemberList, normalizeAdminMemberFilters, writeAdminMemberAuditSafely } from "@/lib/admin-members";

export const runtime = "nodejs";

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }

  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  const filters = normalizeAdminMemberFilters(request.nextUrl.searchParams);

  try {
    const result = await getAdminMemberList(filters);

    await writeAdminMemberAuditSafely({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "manual_admin_action",
      resourceType: "profile",
      reason: "admin_member_search",
      metadata: {
        has_search: Boolean(filters.search),
        role_filter: filters.role,
        tier_filter: filters.tier,
        email_verified_filter: filters.emailVerified,
        result_count: result.members.length,
        limit: filters.limit,
        page: filters.page,
      },
      request,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Admin member lookup API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, code: "MEMBER_LOOKUP_FAILED", message: "目前無法查詢會員資料。" }, { status: 500 });
  }
}

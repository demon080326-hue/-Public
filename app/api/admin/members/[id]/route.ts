import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminMemberDetail, isValidProfileId, writeAdminMemberAuditSafely } from "@/lib/admin-members";

export const runtime = "nodejs";

type MemberDetailRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }

  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function GET(request: NextRequest, { params }: MemberDetailRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  const { id } = await params;
  if (!isValidProfileId(id)) {
    return NextResponse.json({ ok: false, code: "INVALID_MEMBER_ID", message: "會員 ID 格式不正確。" }, { status: 400 });
  }

  try {
    const result = await getAdminMemberDetail(id);
    if (!result) {
      return NextResponse.json({ ok: false, code: "MEMBER_NOT_FOUND", message: "找不到會員資料。" }, { status: 404 });
    }

    await writeAdminMemberAuditSafely({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "manual_admin_action",
      resourceType: "profile",
      resourceId: result.member.user_id,
      targetUserId: result.member.user_id,
      targetEmail: result.member.email,
      reason: "admin_member_detail_view",
      metadata: { viewed_sections: ["profile", "points", "tier", "ledger"] },
      request,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Admin member detail API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, code: "MEMBER_DETAIL_FAILED", message: "目前無法讀取會員詳細資料。" }, { status: 500 });
  }
}

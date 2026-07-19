import { getAdminAuditLogs } from "@/lib/admin-audit-log";

const actionLabels: Record<string, string> = {
  admin_news_create: "新增 AI 情報",
  manual_admin_action: "手動管理操作",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export async function AdminAuditSummary() {
  const logs = await getAdminAuditLogs(5);

  return (
    <section className="section" aria-labelledby="admin-audit-title">
      <div className="wrap">
        <div className="cms-panel">
          <div className="cms-library-head">
            <div>
              <p className="eyebrow">Admin Audit</p>
              <h2 id="admin-audit-title">管理操作紀錄</h2>
            </div>
            <span className="cms-pill">最近 5 筆</span>
          </div>

          {logs.length === 0 ? (
            <p className="cms-empty">稽核系統已建立，目前尚無管理操作紀錄。</p>
          ) : (
            <ol className="cms-list">
              {logs.map((log) => (
                <li className="cms-preview-empty" key={log.id}>
                  <strong>{actionLabels[log.action] ?? log.action}</strong>
                  <p>{log.resource_type}{log.resource_id ? ` · ${log.resource_id}` : ""}</p>
                  <small>{log.actor_email ?? "系統"} · {log.actor_role ?? "unknown"} · <time dateTime={log.created_at}>{formatDate(log.created_at)}</time></small>
                  {log.reason ? <p>{log.reason}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

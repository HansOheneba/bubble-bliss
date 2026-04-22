import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import LogsClient from "./logs-client";

type AdminLog = {
  id: number;
  admin_email: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

async function fetchLogs(): Promise<AdminLog[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("admin_logs")
    .select("id, admin_email, action, description, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as AdminLog[];
}

export default async function LogsPage() {
  const logs = await fetchLogs();
  return (
    <Suspense>
      <LogsClient logs={logs} />
    </Suspense>
  );
}

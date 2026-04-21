import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/sidebar";
import AdminTopbar from "@/components/admin/topbar";

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const primaryEmail = user?.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();

  if (!primaryEmail || !ALLOWED_EMAILS.includes(primaryEmail)) {
    redirect("https://www.google.com");
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full overflow-x-hidden bg-background">
        <AdminSidebar />

        <SidebarInset className="min-w-0">
          <AdminTopbar />
          <div className="p-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/sidebar";
import AdminTopbar from "@/components/admin/topbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

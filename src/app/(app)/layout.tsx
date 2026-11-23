import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

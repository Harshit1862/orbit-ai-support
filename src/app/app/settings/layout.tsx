import SettingsTabs from "@/components/orbit/SettingsTabs";

export default function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
      <SettingsTabs />
      {children}
    </>
  );
}

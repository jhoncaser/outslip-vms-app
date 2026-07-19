import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function ProfilePage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#eef1ee]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <PagePlaceholder
          title="Profile"
          description="Profile details are coming in a later update."
        />
      </div>
    </div>
  );
}

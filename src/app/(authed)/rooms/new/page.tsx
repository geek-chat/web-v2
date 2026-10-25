import Link from "next/link";
import { CreateRoomForm } from "@/components/room/CreateRoomForm";
import { t } from "@/i18n";

export default function NewRoomPage() {
  return (
    <main className="flex flex-1 justify-center overflow-y-auto px-6 py-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link href="/rooms" className="text-sm text-primary underline-offset-4 hover:underline md:hidden">
            {t("room.back")}
          </Link>
          <h2 className="text-2xl font-semibold">{t("rooms.create.title")}</h2>
        </header>
        <CreateRoomForm />
      </div>
    </main>
  );
}

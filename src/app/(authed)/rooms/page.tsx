import { RoomsPanel } from "@/components/room/RoomList";
import { t } from "@/i18n";

/** Mobile: the room list. Desktop: the list sits in the layout's sidebar, so this asks for a pick. */
export default function RoomsPage() {
  return (
    <>
      <div className="flex flex-1 flex-col md:hidden">
        <RoomsPanel />
      </div>
      <div className="hidden flex-1 items-center justify-center md:flex">
        <p className="text-sm text-muted-foreground">{t("rooms.select")}</p>
      </div>
    </>
  );
}

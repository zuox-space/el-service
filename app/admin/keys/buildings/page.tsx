// app/admin/keys/buildings/page.tsx
import { redirect } from "next/navigation";

export default function LegacyBuildingsPage() {
    redirect("/admin/buildings");
}
// app/guard/page.tsx
import { redirect } from "next/navigation";
import { getGuardAccess } from "@/lib/guard/auth";
import { GuardScreen } from "@/components/guard/GuardScreen";

export const dynamic = "force-dynamic";

export default async function GuardPage() {
    const access = await getGuardAccess();
    if (!access) redirect("/guard/login");

    return <GuardScreen />;
}

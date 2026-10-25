// app/api/guard/events/route.ts
export const dynamic = "force-dynamic";

import { getGuardAccess } from "@/lib/guard/auth";
import { KEYS_HEARTBEAT_MS, subscribeKeys } from "@/lib/keys/bus";

/** SSE для планшета охраны: ключи меняются — экран обновляется. */
export async function GET(request: Request) {
    const access = await getGuardAccess();
    if (!access) return new Response("Unauthorized", { status: 401 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            send("hello", { at: new Date().toISOString() });
            const unsubscribe = subscribeKeys(send);
            const timer = setInterval(() => {
                try {
                    send("ping", { at: new Date().toISOString() });
                } catch {
                    // закрыто
                }
            }, KEYS_HEARTBEAT_MS);

            request.signal.addEventListener("abort", () => {
                clearInterval(timer);
                unsubscribe();
                try {
                    controller.close();
                } catch {
                    // уже закрыт
                }
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

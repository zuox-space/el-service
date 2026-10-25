// app/api/keys/events/route.ts
export const dynamic = "force-dynamic";

import { requireAnySection } from "@/lib/access/server";
import { KEYS_HEARTBEAT_MS, subscribeKeys } from "@/lib/keys/bus";

/** SSE-поток: сообщает клиенту, что состояние ключей изменилось. */
export async function GET(request: Request) {
    const guard = await requireAnySection(["keys", "keysAdmin"]);
    if (!guard.ok) return guard.response;

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
                    // соединение закрылось — уборка ниже
                }
            }, KEYS_HEARTBEAT_MS);

            const cleanup = () => {
                clearInterval(timer);
                unsubscribe();
                try {
                    controller.close();
                } catch {
                    // поток уже закрыт
                }
            };

            request.signal.addEventListener("abort", cleanup);
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

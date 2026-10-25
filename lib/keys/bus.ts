// lib/keys/bus.ts
//
// Простейшая шина событий для SSE внутри одного процесса Next.js.
// В Dokploy приложение запускается одним контейнером, поэтому этого достаточно.

type Client = {
    id: number;
    send: (event: string, data: unknown) => void;
};

// globalThis — чтобы SSE-роут и API-роуты использовали один и тот же набор
// клиентов: в dev/prod каждый route может получать свой экземпляр модуля.
const globalBus = globalThis as typeof globalThis & { __keysBus?: Set<Client>; __keysBusId?: number };
const clients = (globalBus.__keysBus ??= new Set<Client>());
let nextId = globalBus.__keysBusId ?? 1;

export function subscribeKeys(send: Client["send"]): () => void {
    const client: Client = { id: nextId++, send };
    globalBus.__keysBusId = nextId;
    clients.add(client);
    return () => clients.delete(client);
}

export function broadcastKeys(event = "update", data: unknown = {}): void {
    for (const client of clients) {
        try {
            client.send(event, data);
        } catch {
            clients.delete(client);
        }
    }
}

export const KEYS_HEARTBEAT_MS = 25_000;

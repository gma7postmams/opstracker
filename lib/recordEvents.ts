import { Client } from "pg";

const CHANNEL = "opstracker_record_changes";
const RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

type Subscriber = () => void;

type EventHub = {
  subscribers: Set<Subscriber>;
  listenerStarted: boolean;
};

declare global {
  var __opsTrackerRecordEventHub: EventHub | undefined;
}

function getHub() {
  globalThis.__opsTrackerRecordEventHub ??= {
    subscribers: new Set(),
    listenerStarted: false,
  };

  return globalThis.__opsTrackerRecordEventHub;
}

function broadcastInvalidation() {
  for (const subscriber of getHub().subscribers) {
    subscriber();
  }
}

async function listenForRecordChanges() {
  let retryDelay = RETRY_DELAY_MS;

  while (true) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
      application_name: "opstracker-record-events",
    });
    let resolveDisconnected!: () => void;
    const disconnected = new Promise<void>((resolve) => {
      resolveDisconnected = resolve;
    });

    client.on("notification", (message) => {
      if (message.channel === CHANNEL && message.payload === "records-changed") {
        broadcastInvalidation();
      }
    });
    client.on("error", (error) => {
      console.error("PostgreSQL record event listener error:", error);
      resolveDisconnected();
    });
    client.once("end", resolveDisconnected);

    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      retryDelay = RETRY_DELAY_MS;
      broadcastInvalidation();
      await disconnected;
    } catch (error) {
      console.error("Could not connect PostgreSQL record event listener:", error);
    } finally {
      client.removeAllListeners();
      await client.end().catch(() => undefined);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
  }
}

export function subscribeToRecordChanges(subscriber: Subscriber) {
  const hub = getHub();
  hub.subscribers.add(subscriber);

  if (!hub.listenerStarted) {
    hub.listenerStarted = true;
    void listenForRecordChanges();
  }

  return () => hub.subscribers.delete(subscriber);
}
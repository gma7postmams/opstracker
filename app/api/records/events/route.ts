import { currentUser } from "@/lib/auth";
import { subscribeToRecordChanges } from "@/lib/recordEvents";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribeToRecordChanges(() => {
        send("event: records-changed\ndata: {}\n\n");
      });
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), 25_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };

      send("event: records-changed\ndata: {}\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
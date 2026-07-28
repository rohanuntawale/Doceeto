import { getRequestSession } from "@/lib/auth/session";
import { subscribe } from "@/lib/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: pushes {entities:[...]} whenever a write happens,
 * so clients refresh instantly instead of polling. Works fully on a
 * long-running server (Render / `npm start` / dev); on serverless the
 * client silently falls back to its polling interval.
 */
export async function GET(req: Request) {
  // EventSource cannot set headers, so the client passes ?surface= instead.
  const session = await getRequestSession(req);
  if (!session) return new Response("Not signed in.", { status: 401 });

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (line: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(line));
        } catch {
          closed = true;
        }
      };

      // Hello + heartbeat keep proxies from buffering/killing the stream.
      send(`retry: 5000\n\n`);
      send(`data: ${JSON.stringify({ hello: true, at: Date.now() })}\n\n`);
      const heartbeat = setInterval(() => send(`: hb\n\n`), 25_000);

      const unsubscribe = subscribe((evt) =>
        send(`data: ${JSON.stringify(evt)}\n\n`),
      );

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

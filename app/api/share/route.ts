import { saveSharedHtml } from "@/lib/share-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { html?: string };
    if (!body.html || typeof body.html !== "string" || body.html.length < 100) {
      return Response.json({ error: "html is required." }, { status: 400 });
    }

    if (body.html.length > 8_000_000) {
      return Response.json({ error: "html is too large to share." }, { status: 413 });
    }

    const id = await saveSharedHtml(body.html);
    return Response.json({ id, path: `/s/${id}` });
  } catch {
    return Response.json({ error: "Failed to create share page." }, { status: 500 });
  }
}

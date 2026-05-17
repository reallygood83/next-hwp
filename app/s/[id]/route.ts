import { firebaseConfig } from "@/lib/firebase-config";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await readFirebaseShare(id);

  if (!share?.htmlUrl) {
    return new Response("Shared briefing page not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const htmlResponse = await fetch(share.htmlUrl);
  if (!htmlResponse.ok) {
    return new Response("Shared briefing file not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const html = await htmlResponse.text();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function readFirebaseShare(id: string) {
  if (!/^[a-f0-9]{20}$/i.test(id)) return null;

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/sharedBriefings/${id}`,
  );
  url.searchParams.set("key", firebaseConfig.apiKey);

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) return null;

  const body = (await response.json()) as {
    fields?: {
      htmlUrl?: { stringValue?: string };
      isPublic?: { booleanValue?: boolean };
    };
  };
  if (!body.fields?.isPublic?.booleanValue) return null;
  return {
    htmlUrl: body.fields.htmlUrl?.stringValue || "",
  };
}

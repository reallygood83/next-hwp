import { firebaseConfig } from "@/lib/firebase-config";

export const runtime = "nodejs";

export async function GET(
  request: Request,
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
  return new Response(injectOpenGraph(html, share, request.url), {
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
      sourceFilename?: { stringValue?: string };
      title?: { stringValue?: string };
      isPublic?: { booleanValue?: boolean };
    };
  };
  if (!body.fields?.isPublic?.booleanValue) return null;
  return {
    htmlUrl: body.fields.htmlUrl?.stringValue || "",
    sourceFilename: body.fields.sourceFilename?.stringValue || "",
    title: body.fields.title?.stringValue || "한글소리 AI 음성 브리핑",
  };
}

type FirebaseShare = NonNullable<Awaited<ReturnType<typeof readFirebaseShare>>>;

function injectOpenGraph(html: string, share: FirebaseShare, requestUrl: string) {
  const url = new URL(requestUrl);
  const title = share.title || "한글소리 AI 음성 브리핑";
  const description = share.sourceFilename
    ? `${share.sourceFilename} 문서를 한글소리 AI로 변환한 음성 브리핑 공유 페이지입니다.`
    : "한글 문서를 AI 음성 브리핑과 공유 HTML로 변환한 페이지입니다.";
  const imageUrl = new URL("/og/share", url.origin);
  imageUrl.searchParams.set("title", title);
  if (share.sourceFilename) imageUrl.searchParams.set("source", share.sourceFilename);

  const tags = [
    `<meta name="description" content="${escapeAttribute(description)}" />`,
    `<meta property="og:site_name" content="한글소리 AI" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    `<meta property="og:url" content="${escapeAttribute(url.toString())}" />`,
    `<meta property="og:image" content="${escapeAttribute(imageUrl.toString())}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttribute(imageUrl.toString())}" />`,
  ].join("\n  ");

  const withTitle = html.replace(/<title>.*?<\/title>/i, `<title>${escapeText(title)}</title>`);
  if (withTitle.includes("</head>")) {
    return withTitle.replace("</head>", `  ${tags}\n</head>`);
  }
  return withTitle;
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

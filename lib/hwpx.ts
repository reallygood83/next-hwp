import JSZip from "jszip";
import type { ExtractionResult } from "./types";

const TEXT_TAGS = new Set(["t", "hp:t", "text"]);
const PARAGRAPH_TAGS = new Set(["p", "hp:p"]);

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    return {
      text,
      html: textToPreviewHtml(text),
      status: text.trim() ? "ready" : "empty",
      warnings: [],
    };
  }

  if (name.endsWith(".hwpx")) {
    return extractTextFromHwpx(await file.arrayBuffer());
  }

  if (name.endsWith(".hwp")) {
    return {
      text: "",
      html: "",
      status: "unsupported",
      warnings: [
        "이 MVP는 아직 HWP 바이너리 렌더링 bridge가 없습니다. HWPX로 변환하거나 본문을 붙여넣어 브리핑을 만들 수 있습니다.",
      ],
    };
  }

  return {
    text: "",
    html: "",
    status: "unsupported",
    warnings: ["Only HWPX, TXT, and Markdown files can be extracted in this MVP."],
  };
}

async function extractTextFromHwpx(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const sectionFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir && /section\d+\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  if (sectionFiles.length === 0) {
    return {
      text: "",
      html: "",
      status: "empty",
      warnings: ["No HWPX section XML files were found."],
    };
  }

  const pages: string[][] = [];
  for (const entry of sectionFiles) {
    const xml = await entry.async("text");
    pages.push(extractXmlParagraphs(xml));
  }

  const paragraphs = pages.flat().filter(Boolean);

  return {
    text: normalizeWhitespace(paragraphs.join("\n\n")),
    html: paragraphsToPreviewHtml(paragraphs),
    status: paragraphs.length > 0 ? "ready" : "empty",
    warnings: [],
  };
}

function extractXmlParagraphs(xml: string): string[] {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const paragraphNodes = [...doc.querySelectorAll("*")].filter((node) =>
      PARAGRAPH_TAGS.has(node.tagName.toLowerCase()),
    );
    const paragraphs = paragraphNodes.map((paragraph) => {
      const parts: string[] = [];
      paragraph.querySelectorAll("*").forEach((node) => {
        const tag = node.tagName.toLowerCase();
        if (TEXT_TAGS.has(tag) && node.textContent) {
          parts.push(node.textContent);
        }
      });
      return normalizeWhitespace(parts.join(""));
    });

    if (paragraphs.some(Boolean)) {
      return paragraphs;
    }

    const fallbackParts: string[] = [];
    doc.querySelectorAll("*").forEach((node) => {
      if (TEXT_TAGS.has(node.tagName.toLowerCase()) && node.textContent) {
        fallbackParts.push(node.textContent);
      }
    });
    return [normalizeWhitespace(fallbackParts.join(" "))];
  }

  const paragraphMatches = [
    ...xml.matchAll(/<[^:>]*:?p(?:\s[^>]*)?>([\s\S]*?)<\/[^:>]*:?p>/gi),
  ];
  const source = paragraphMatches.length > 0 ? paragraphMatches.map((m) => m[1] ?? "") : [xml];

  return source.map((fragment) => {
    const parts = [
      ...fragment.matchAll(/<[^:>]*:?t(?:\s[^>]*)?>([\s\S]*?)<\/[^:>]*:?t>/gi),
    ].map((match) => decodeXmlEntities(stripTags(match[1] ?? "")));
    return normalizeWhitespace(parts.join(""));
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textToPreviewHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(normalizeWhitespace)
    .filter(Boolean);
  return paragraphsToPreviewHtml(paragraphs.length > 0 ? paragraphs : [text]);
}

function paragraphsToPreviewHtml(paragraphs: string[]): string {
  return paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

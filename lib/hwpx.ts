import JSZip from "jszip";
import type { ExtractionResult } from "./types";

const TEXT_TAGS = new Set(["t", "hp:t", "text"]);

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return {
      text: await file.text(),
      warnings: [],
    };
  }

  if (name.endsWith(".hwpx")) {
    return extractTextFromHwpx(await file.arrayBuffer());
  }

  if (name.endsWith(".hwp")) {
    return {
      text: "",
      warnings: [
        "HWP binary extraction is not implemented in this web MVP. Paste extracted text or use an HWPX file.",
      ],
    };
  }

  return {
    text: "",
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
      warnings: ["No HWPX section XML files were found."],
    };
  }

  const pages: string[] = [];
  for (const entry of sectionFiles) {
    const xml = await entry.async("text");
    pages.push(extractXmlText(xml));
  }

  return {
    text: normalizeWhitespace(pages.join("\n\n")),
    warnings: [],
  };
}

function extractXmlText(xml: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const parts: string[] = [];
    doc.querySelectorAll("*").forEach((node) => {
      const tag = node.tagName.toLowerCase();
      if (TEXT_TAGS.has(tag) && node.textContent) {
        parts.push(node.textContent);
      }
    });
    return parts.join(" ");
  }

  const parts = [...xml.matchAll(/<[^:>]*:?t[^>]*>([\s\S]*?)<\/[^:>]*:?t>/gi)].map(
    (match) => decodeXmlEntities(stripTags(match[1] ?? "")),
  );
  return parts.join(" ");
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

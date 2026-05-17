import type { ExtractionResult } from "./types";
import pako from "pako";

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;
const HWP_PARA_TEXT = 67;

type DirectoryEntry = {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  startSector: number;
  size: number;
};

type CfbFile = {
  entries: Map<string, Uint8Array>;
  names: string[];
};

export async function extractTextFromHwp(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const cfb = parseCfb(buffer);
    const sectionEntries = [...cfb.entries.entries()]
      .filter(([path]) => /(^|\/)bodytext\/section\d+$/i.test(path))
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));

    if (sectionEntries.length === 0) {
      return {
        text: "",
        html: "",
        status: "unsupported",
        warnings: [
          "HWP 본문 스트림을 찾지 못했습니다. 암호화/배포용 문서이거나 지원하지 않는 HWP 구조일 수 있습니다.",
        ],
      };
    }

    const paragraphs = (
      await Promise.all(sectionEntries.map(([, data]) => extractSectionParagraphs(data)))
    )
      .flat()
      .map(normalizeText)
      .filter(Boolean);

    if (paragraphs.length === 0) {
      return {
        text: "",
        html: "",
        status: "empty",
        warnings: ["HWP 파일을 열었지만 표시 가능한 본문 텍스트를 찾지 못했습니다."],
      };
    }

    return {
      text: normalizeText(paragraphs.join("\n\n")),
      html: paragraphsToPreviewHtml(paragraphs),
      status: "ready",
      warnings: ["HWP 원문은 텍스트 중심으로 추출했습니다. 표/그림/정밀 레이아웃은 HWPX 변환 또는 rhwp bridge가 필요합니다."],
    };
  } catch {
    return {
      text: "",
      html: "",
      status: "unsupported",
      warnings: ["HWP 파일 구조를 읽지 못했습니다. HWPX로 저장하거나 본문을 붙여넣어 주세요."],
    };
  }
}

function parseCfb(buffer: ArrayBuffer): CfbFile {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (!CFB_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error("Not a CFB file.");
  }

  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const fatSectorCount = view.getUint32(44, true);
  const firstDirectorySector = view.getUint32(48, true);
  const miniStreamCutoff = view.getUint32(56, true);
  const firstMiniFatSector = view.getUint32(60, true);
  const miniFatSectorCount = view.getUint32(64, true);
  const firstDifatSector = view.getUint32(68, true);
  const difatSectorCount = view.getUint32(72, true);
  const difat = readDifat(
    view,
    sectorSize,
    fatSectorCount,
    firstDifatSector,
    difatSectorCount,
  );
  const fat = readFat(view, sectorSize, difat);
  const directoryBytes = readRegularChain(bytes, sectorSize, fat, firstDirectorySector);
  const directory = readDirectory(directoryBytes);
  const root = directory[0];
  const rootMiniStream = root ? readRegularChain(bytes, sectorSize, fat, root.startSector) : new Uint8Array();
  const miniFat =
    firstMiniFatSector !== ENDOFCHAIN && miniFatSectorCount > 0
      ? readFat(view, sectorSize, readRegularChainIndexes(fat, firstMiniFatSector).slice(0, miniFatSectorCount))
      : [];
  const entries = new Map<string, Uint8Array>();
  const names: string[] = [];

  walkDirectory(directory, 0, "", (path, entry) => {
    names.push(path);
    if (entry.type !== 2) return;
    const stream =
      entry.size < miniStreamCutoff && rootMiniStream.length > 0
        ? readMiniChain(rootMiniStream, miniSectorSize, miniFat, entry.startSector, entry.size)
        : readRegularChain(bytes, sectorSize, fat, entry.startSector, entry.size);
    entries.set(path.toLowerCase(), stream);
  });

  return { entries, names };
}

function readDifat(
  view: DataView,
  sectorSize: number,
  fatSectorCount: number,
  firstDifatSector: number,
  difatSectorCount: number,
) {
  const difat: number[] = [];
  for (let offset = 76; offset < 512; offset += 4) {
    const sector = view.getUint32(offset, true);
    if (sector !== FREESECT) difat.push(sector);
  }

  let next = firstDifatSector;
  for (let i = 0; i < difatSectorCount && next !== ENDOFCHAIN; i += 1) {
    const offset = sectorOffset(next, sectorSize);
    const entriesPerDifatSector = sectorSize / 4 - 1;
    for (let j = 0; j < entriesPerDifatSector; j += 1) {
      const sector = view.getUint32(offset + j * 4, true);
      if (sector !== FREESECT) difat.push(sector);
    }
    next = view.getUint32(offset + entriesPerDifatSector * 4, true);
  }

  return difat.filter((sector) => sector !== FATSECT && sector !== DIFSECT).slice(0, fatSectorCount);
}

function readFat(view: DataView, sectorSize: number, fatSectors: number[] | Uint8Array) {
  const sectors = Array.isArray(fatSectors) ? fatSectors : [];
  const fat: number[] = [];
  for (const sector of sectors) {
    const offset = sectorOffset(sector, sectorSize);
    for (let cursor = 0; cursor < sectorSize; cursor += 4) {
      fat.push(view.getUint32(offset + cursor, true));
    }
  }
  return fat;
}

function readRegularChain(
  source: Uint8Array,
  sectorSize: number,
  fat: number[],
  startSector: number,
  expectedSize?: number,
) {
  if (startSector === ENDOFCHAIN || startSector === FREESECT) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  for (const sector of readRegularChainIndexes(fat, startSector)) {
    const offset = sectorOffset(sector, sectorSize);
    chunks.push(source.slice(offset, offset + sectorSize));
  }
  const joined = concat(chunks);
  return typeof expectedSize === "number" ? joined.slice(0, expectedSize) : joined;
}

function readRegularChainIndexes(fat: number[], startSector: number) {
  const indexes: number[] = [];
  const seen = new Set<number>();
  let sector = startSector;
  while (sector !== ENDOFCHAIN && sector !== FREESECT && !seen.has(sector)) {
    if (sector < 0 || sector >= fat.length) break;
    indexes.push(sector);
    seen.add(sector);
    sector = fat[sector];
  }
  return indexes;
}

function readMiniChain(
  miniStream: Uint8Array,
  miniSectorSize: number,
  miniFat: number[],
  startSector: number,
  expectedSize: number,
) {
  const chunks: Uint8Array[] = [];
  const seen = new Set<number>();
  let sector = startSector;
  while (sector !== ENDOFCHAIN && sector !== FREESECT && !seen.has(sector)) {
    const offset = sector * miniSectorSize;
    chunks.push(miniStream.slice(offset, offset + miniSectorSize));
    seen.add(sector);
    sector = miniFat[sector];
  }
  return concat(chunks).slice(0, expectedSize);
}

function readDirectory(bytes: Uint8Array): DirectoryEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-16le");
  const entries: DirectoryEntry[] = [];
  for (let offset = 0; offset + 128 <= bytes.length; offset += 128) {
    const nameLength = view.getUint16(offset + 64, true);
    const nameBytes = bytes.slice(offset, offset + Math.max(0, nameLength - 2));
    entries.push({
      name: decoder.decode(nameBytes).replace(/\u0000/g, ""),
      type: view.getUint8(offset + 66),
      left: view.getUint32(offset + 68, true),
      right: view.getUint32(offset + 72, true),
      child: view.getUint32(offset + 76, true),
      startSector: view.getUint32(offset + 116, true),
      size: view.getUint32(offset + 120, true),
    });
  }
  return entries;
}

function walkDirectory(
  directory: DirectoryEntry[],
  index: number,
  parentPath: string,
  visit: (path: string, entry: DirectoryEntry) => void,
) {
  const root = directory[index];
  if (!root || root.child === FREESECT) return;
  walkSiblings(directory, root.child, parentPath, visit);
}

function walkSiblings(
  directory: DirectoryEntry[],
  index: number,
  parentPath: string,
  visit: (path: string, entry: DirectoryEntry) => void,
) {
  if (index === FREESECT) return;
  const entry = directory[index];
  if (!entry) return;

  walkSiblings(directory, entry.left, parentPath, visit);
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  visit(path, entry);
  if (entry.type === 1 && entry.child !== FREESECT) {
    walkSiblings(directory, entry.child, path, visit);
  }
  walkSiblings(directory, entry.right, parentPath, visit);
}

async function extractSectionParagraphs(data: Uint8Array) {
  const inflated = (await inflateHwpSection(data)) || data;
  const recordText = extractParaTextRecords(inflated);
  if (recordText.length > 0) return recordText;

  const decoded = decodeUtf16(inflated);
  return decoded
    .split(/\n{2,}| {4,}/)
    .map(normalizeText)
    .filter((line) => /[가-힣A-Za-z0-9]/.test(line));
}

async function inflateHwpSection(data: Uint8Array) {
  for (const inflateFn of [pako.inflateRaw, pako.inflate]) {
    try {
      const inflated = inflateFn(data);
      if (inflated.length > 0) return inflated;
    } catch {
      continue;
    }
  }

  for (const format of ["deflate-raw", "deflate"] as const) {
    try {
      if (typeof DecompressionStream === "undefined") return null;
      const input = new ArrayBuffer(data.byteLength);
      new Uint8Array(input).set(data);
      const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      continue;
    }
  }
  return null;
}

function extractParaTextRecords(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const paragraphs: string[] = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const header = view.getUint32(offset, true);
    offset += 4;
    const tagId = header & 0x3ff;
    let size = (header >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (offset + 4 > data.length) break;
      size = view.getUint32(offset, true);
      offset += 4;
    }
    if (size < 0 || offset + size > data.length) break;
    if (tagId === HWP_PARA_TEXT && size > 0) {
      const text = decodeUtf16(data.slice(offset, offset + size));
      const cleaned = cleanHwpText(text);
      if (isReadableText(cleaned)) paragraphs.push(cleaned);
    }
    offset += size;
  }
  return paragraphs;
}

function cleanHwpText(value: string) {
  return normalizeText(
    value
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/[\u3400-\u9fff]{2,}/g, " ")
      .replace(/[\uf000-\uf8ff]+/g, " "),
  );
}

function isReadableText(value: string) {
  const meaningful = [...value].filter((char) => /[가-힣A-Za-z0-9 .,;:!?()[\]{}'"“”‘’·\-_/]/.test(char))
    .length;
  return value.length >= 2 && meaningful / value.length > 0.45;
}

function decodeUtf16(bytes: Uint8Array) {
  return new TextDecoder("utf-16le", { fatal: false }).decode(bytes);
}

function sectorOffset(sector: number, sectorSize: number) {
  return (sector + 1) * sectorSize;
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b-\u001f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function paragraphsToPreviewHtml(paragraphs: string[]): string {
  return paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

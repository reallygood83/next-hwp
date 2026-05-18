export function contentDisposition(disposition: "attachment" | "inline", filename: string) {
  const fallback = asciiFallbackFilename(filename);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

function asciiFallbackFilename(filename: string) {
  const cleaned =
    filename
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]+/g, "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "hwpvoice-download";
  return cleaned.replace(/"/g, "");
}

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

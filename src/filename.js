/**
 * Download name for a converted Swiss QR-bill. Pure; no filesystem.
 *
 * @param   { string }        inputName
 * @param   { "spc" | "pdf" } kind
 * @returns { string }
 * @pure
 */
export const createOutputFilename = (inputName, kind) => {
  const leaf = (inputName.split(/[/\\]/).pop() ?? "").trim() || "qr-invoice";
  const base = leaf.replace(/\.(pdf|txt|spc)$/i, "") || "qr-invoice";
  return `${base}-structured.${kind === "pdf" ? "pdf" : "txt"}`;
};

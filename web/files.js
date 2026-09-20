/**
 * Bulk-drop helpers. Same idea as NuSkin's addFiles + file-row meta, without that project's layout demo.
 */

/**
 * @param   { number } bytes
 * @returns { string }
 * @pure
 */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * @param   { string } name
 * @returns { string }
 * @pure
 */
export function fileStem(name) {
  return name.replace(/\.(pdf|txt|spc)$/i, "") || "qr-invoice";
}

/**
 * Append dropped files. Does not replace the existing queue.
 *
 * @template { { name: string } } _T_
 * @param   { _T_[] } queue
 * @param   { _T_[] } added
 * @returns { _T_[] }
 * @pure
 */
export function appendQueue(queue, added) {
  return queue.concat(added);
}

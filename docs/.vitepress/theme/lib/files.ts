/**
 * Decode an uploaded text file. Excel on Windows saves "CSV" in the legacy Central European
 * code page, not UTF-8, which turns Czech letters into garbage if read naively.
 */
export function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

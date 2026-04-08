import { openUrl, openPath } from "@tauri-apps/plugin-opener";

export type LinkType = "external" | "local-file" | "internal-note";

const INTERNAL_NOTE_PREFIX = "rnotes://note/";

const trustedSites = new Set<string>();

export function classifyLink(href: string): LinkType {
  if (href.startsWith(INTERNAL_NOTE_PREFIX)) {
    return "internal-note";
  }
  if (href.startsWith("file://")) {
    return "local-file";
  }
  return "external";
}

export function extractNoteId(href: string): string | null {
  if (!href.startsWith(INTERNAL_NOTE_PREFIX)) return null;
  return href.slice(INTERNAL_NOTE_PREFIX.length) || null;
}

function getHostname(href: string): string | null {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

export function isTrusted(href: string): boolean {
  const hostname = getHostname(href);
  return hostname !== null && trustedSites.has(hostname);
}

export function trustSite(href: string): void {
  const hostname = getHostname(href);
  if (hostname) {
    trustedSites.add(hostname);
  }
}

export async function openLink(href: string): Promise<void> {
  if (href.startsWith("file://")) {
    await openPath(href.replace("file://", ""));
  } else {
    await openUrl(href);
  }
}

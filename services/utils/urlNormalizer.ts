const IS_DEV = process.env.NODE_ENV === "development";

export interface NormalizedUrl {
  url: string;
  hadToken: boolean;
  hadForcedownload: boolean;
}

export function normalizeMoodleUrl(url: string, token?: string | null): NormalizedUrl {
  const result: NormalizedUrl = {
    url: url,
    hadToken: false,
    hadForcedownload: false,
  };
  
  if (!url || url.length < 10) {
    return result;
  }
  
  let cleaned = url.trim();
  
  result.hadForcedownload = /\?.*forcedownload/i.test(cleaned) || /\&.*forcedownload/i.test(cleaned);
  
  cleaned = cleaned.replace(/([?&])forceddownload=\d*/gi, "$1");
  cleaned = cleaned.replace(/([?&])download=\d*/gi, "$1");
  cleaned = cleaned.replace(/([?&])forcedown(load)?/gi, "$1");
  cleaned = cleaned.replace(/=1([?&])/gi, "$1");
  cleaned = cleaned.replace(/&=1$/gi, "");
  cleaned = cleaned.replace(/\?=1$/gi, "?");
  
  cleaned = cleaned.replace(/\?&/g, "?").replace(/&\?/g, "?");
  cleaned = cleaned.replace(/\?\?/g, "?").replace(/&&/g, "&");
  
  while (cleaned.endsWith("?") || cleaned.endsWith("&") || cleaned.endsWith("=")) {
    cleaned = cleaned.slice(0, -1);
  }
  
  result.hadToken = /[?&]token=/i.test(cleaned) || /[?&]wstoken=/i.test(cleaned);
  
  if (token && token.length > 5) {
    if (!result.hadToken) {
      const separator = cleaned.includes("?") ? "&" : "?";
      if (cleaned.includes("pluginfile.php")) {
        cleaned = `${cleaned}${separator}token=${token}`;
      } else {
        cleaned = `${cleaned}${separator}wstoken=${token}`;
      }
    }
  }
  
  result.url = cleaned;
  
  if (IS_DEV) {
    console.log("[URL] Input:", url);
    console.log("[URL] Forcedownload removed:", result.hadForcedownload);
    console.log("[URL] Token present:", result.hadToken);
    console.log("[URL] Output:", result.url);
  }
  
  return result;
}

export function normalizeFilePath(path: string | undefined | null): string {
  if (!path) return "";
  let cleaned = String(path).trim();
  
  // Supprime les doublons file://
  cleaned = cleaned.replace(/^file:\/file:\/+/i, "file://");
  
  // Si ça commence déjà par file://, OK
  if (cleaned.startsWith("file://")) return cleaned;
  
  // Si ça commence par / (chemin Unix/Android), ajouter file://
  if (cleaned.startsWith("/")) {
    return "file://" + cleaned;
  }
  
  return "file://" + cleaned;
}

export function stripFileProtocol(path: string): string {
  if (!path) return "";
  if (path.startsWith("file://")) {
    return path.substring(7);
  }
  return path;
}

export function ensureFileProtocol(path: string): string {
  if (!path) return "";
  if (path.startsWith("file://")) return path;
  if (path.startsWith("/")) return "file://" + path;
  return "file://" + path;
}

import { useSelector } from "react-redux";
import { RootState } from "../services/redux/store";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;
const IS_DEV = process.env.NODE_ENV === "development";

export function getUserToken(token?: string | null): string {
  if (token && token.length > 10) return token;
  if (IS_DEV && ADMIN_TOKEN)
    console.log("[URL Auth] Using admin token (no user token)");
  return ADMIN_TOKEN || "";
}

export function cleanAndAuthUrl(
  url: string,
  userToken?: string | null,
): string {
  if (!url) return url;

  const authToken = getUserToken(userToken);

  let cleaned = url;

  cleaned = cleaned.replace(/[?&]forcedownload=[^&]*/gi, "");
  cleaned = cleaned.replace(/[?&]download=[^&]*/gi, "");

  while (cleaned.endsWith("?") || cleaned.endsWith("&")) {
    cleaned = cleaned.slice(0, -1);
  }

  if (cleaned.includes("token=") || cleaned.includes("wstoken=")) {
    return cleaned;
  }

  if (!authToken) return cleaned;

  if (cleaned.includes("pluginfile.php")) {
    return `${cleaned}?token=${authToken}`;
  }
  return `${cleaned}?wstoken=${authToken}`;
}

export function createAuthHeaders(
  token?: string | null,
): Record<string, string> {
  const authToken = getUserToken(token);
  return {
    Authorization: `Bearer ${authToken}`,
    Accept: "application/json, text/html, */*",
  };
}

export function useAuthToken(): string | null {
  return useSelector((state: RootState) => state.auth.token);
}

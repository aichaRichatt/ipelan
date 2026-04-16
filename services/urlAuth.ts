import { useSelector } from "react-redux";
import { RootState } from "../services/redux/store";
import { normalizeMoodleUrl } from "./utils/urlNormalizer";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_TOKEN;

export function getUserToken(token?: string | null): string {
  if (token && token.length > 10) return token;
  return ADMIN_TOKEN || "";
}

export function cleanAndAuthUrl(
  url: string,
  userToken?: string | null,
): string {
  const authToken = getUserToken(userToken);
  const result = normalizeMoodleUrl(url, authToken);
  return result.url;
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

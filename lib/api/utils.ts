import { NextResponse } from "next/server";

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

/**
 * Standardizes API error responses.
 * Logs the original error to the server console for debugging,
 * but returns a sanitized message to the client to avoid leaking internals.
 */
export function handleApiError(err: unknown, customMessage?: string, status = 500): NextResponse {
  console.error("[API ERROR]:", err);
  
  const message = customMessage || "An unexpected error occurred. Please try again.";
  
  return NextResponse.json(
    { error: message },
    { status }
  );
}

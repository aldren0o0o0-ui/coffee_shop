const BACKEND_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
).replace(/\/api\/v1\/?$/, "");

/**
 * Resolves an image URL to a full accessible URL.
 * Handles:
 * - Full URLs (e.g. https://... or http://...)
 * - Relative upload paths (e.g. /uploads/menu/1/abc.jpg)
 * - Blob/Object URLs (e.g. blob:http://...)
 */
export function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("blob:") || imagePath.startsWith("data:")) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${BACKEND_BASE}${cleanPath}`;
}

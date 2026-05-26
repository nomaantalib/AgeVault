/**
 * Resolves ID card and selfie image URLs, handling both Cloudinary/external links
 * and local relative paths safely and dynamically. It also dynamically rewrites
 * old absolute URLs (like localhost:5000) stored in the database if the active server
 * host or port has changed, preventing broken images.
 * 
 * @param {string} url - The image URL or relative path stored in the database.
 * @param {string} apiUrl - The active backend API base URL (e.g. http://localhost:5000).
 * @returns {string} The fully qualified and correct URL to render.
 */
export const resolveImageUrl = (url, apiUrl) => {
  if (!url) return '';

  // 1. If it's a Cloudinary URL or general absolute external URL (e.g. Google profile pic), return as-is
  if (
    url.includes('res.cloudinary.com') ||
    url.startsWith('http://res.cloudinary.com') ||
    url.startsWith('https://res.cloudinary.com') ||
    url.includes('lh3.googleusercontent.com')
  ) {
    return url;
  }

  let relativePath = url;

  // 2. If it is an old absolute local URL containing http:// or https:// (e.g. from a different port/domain),
  // extract only the /uploads/ part so we can prepend the CURRENT active apiUrl dynamically.
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/uploads/')) {
        relativePath = parsed.pathname;
      } else {
        return url; // Unknown external absolute URL, leave it untouched
      }
    } catch (e) {
      console.warn('Failed to parse URL in resolveImageUrl:', url, e);
      return url;
    }
  }

  // 3. Ensure it starts with / for clean concatenation
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  // 4. Return correct resolved URL
  return `${apiUrl}${relativePath}`;
};

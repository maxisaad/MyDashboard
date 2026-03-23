const API_URL = import.meta.env.VITE_API_URL || '';

if (import.meta.env.VITE_API_URL) {
  try {
    new URL(API_URL);
  } catch {
    console.error(`Invalid VITE_API_URL: "${API_URL}" — must be a valid URL`);
  }
}

export const env = {
  VITE_API_URL: API_URL,
};

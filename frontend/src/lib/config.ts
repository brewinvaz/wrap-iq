function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    console.error('NEXT_PUBLIC_API_URL is not set in production build');
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl();

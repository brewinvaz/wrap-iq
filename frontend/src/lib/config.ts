function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL environment variable is required in production. ' +
      'Set it to the backend API URL before building.',
    );
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl();

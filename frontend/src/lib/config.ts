export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  console.error(
    'NEXT_PUBLIC_API_URL is not set — API calls will target localhost:8000, which is almost certainly wrong in production.',
  );
}

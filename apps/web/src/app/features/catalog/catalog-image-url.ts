/** Resolve API-owned assets independently of the Angular development server. */
export function catalogImageUrl(url: string, apiUrl: string, preview = false): string {
  const match = /^\/api\/public\/images\/([a-f\d]{24})$/i.exec(url ?? '');
  if (!match) return url;
  return `${apiUrl.replace(/\/$/, '')}/${preview ? 'catalog-images' : 'public/images'}/${match[1]}`;
}

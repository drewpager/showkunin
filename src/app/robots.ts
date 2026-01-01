import { type MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.greadings.com';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/tasks',
        '/tasks/',
        '/_next/',
        '/static/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

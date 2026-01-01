import { type MetadataRoute } from 'next';
import { prisma } from '~/server/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.greadings.com';

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/solutions/vibe-automation`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/legal/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic routes (Public Videos with linkShareSeo: true)
  const publicVideos = await prisma.video.findMany({
    where: {
      linkShareSeo: true,
      fileDeletedAt: null,
    },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  const videoRoutes: MetadataRoute.Sitemap = publicVideos.map((video) => ({
    url: `${baseUrl}/task/${video.id}`,
    lastModified: video.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...videoRoutes];
}

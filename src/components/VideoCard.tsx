import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export interface VideoCardProps {
  title: string;
  id: string;
  thumbnailUrl: string;
  createdAt: Date;
  fileDeletedAt?: Date | null;
  author?: {
    name: string | null;
    image: string | null;
  };
}

export const VideoCardSkeleton = () => {
  return (
    <div className="h-[320px] w-[280px] animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-video w-full bg-gray-200" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="mt-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div className="h-3 w-1/3 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
};

export const VideoCard = ({
  title,
  id,
  createdAt,
  thumbnailUrl,
  fileDeletedAt,
  author,
}: VideoCardProps) => {
  const [imgError, setImgError] = useState(!!fileDeletedAt);

  return (
    <Link href={`/task/${id}`}>
      <div className="group h-[320px] w-[280px] cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-custom-dark-orange/50">
        <figure className="relative aspect-video w-full overflow-hidden bg-gray-100">
          {!imgError && !fileDeletedAt ? (
            <Image
              src={thumbnailUrl}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              alt={title || "video thumbnail"}
              width={280}
              height={157}
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {fileDeletedAt && (
                <span className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">
                  Video unavailable
                </span>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
            <span className="text-white text-xs font-medium bg-custom-dark-orange px-2 py-1 rounded">View Example</span>
          </div>
        </figure>
        <div className="p-4 flex flex-col h-[calc(320px-157px)] justify-between">
          <div>
            <h3 className="line-clamp-2 text-base font-bold text-gray-900 group-hover:text-custom-dark-orange transition-colors">
              {title}
            </h3>
            <p className="mt-1 text-[10px] text-gray-400">
              {createdAt.toLocaleDateString()}
            </p>
          </div>

          {author && (
            <div className="mt-4 flex items-center gap-3 border-t pt-4">
              <div className="h-8 w-8 relative overflow-hidden rounded-full ring-2 ring-gray-100">
                {author.image ? (
                  <Image
                    src={author.image}
                    alt={author.name ?? "Author"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-custom-dark-orange/10 flex items-center justify-center text-custom-dark-orange text-xs font-bold">
                    {author.name?.charAt(0) ?? "?"}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">
                {author.name ?? "Anonymous"}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

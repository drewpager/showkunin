import { type NextPage } from "next";
import Head from "next/head";
import { api } from "~/utils/api";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import { VideoCard, VideoCardSkeleton } from "~/components/VideoCard";

const ExamplesHub: NextPage = () => {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.video.getExamples.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const videos = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <Head>
        <title>Examples | Greadings</title>
        <meta
          name="description"
          content="Explore examples of tasks automated with Greadings."
        />
      </Head>
      <div className="bg-custom-white">
        <Header />
        <main className="flex h-screen min-h-screen flex-col items-center bg-gray-50">
          <div
            className="flex w-full grow items-start justify-center overflow-auto pt-14"
            suppressHydrationWarning={true}
          >
            <div className="flex w-full max-w-[1300px] flex-col px-4 pb-16">
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                  Automation <span className="text-custom-dark-orange">Examples</span>
                </h1>
                <p className="mt-3 text-xl text-gray-500">
                  See what Greadings can do. These are tasks people have actually automated.
                </p>
              </div>

              <div className="flex-start grid w-full grid-cols-[repeat(auto-fill,280px)] flex-row flex-wrap items-start justify-center gap-8">
                {videos &&
                  videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      title={video.title}
                      id={video.id}
                      createdAt={video.createdAt}
                      thumbnailUrl={video.thumbnailUrl ?? ""}
                      author={video.user}
                    />
                  ))}

                {(isLoading || isFetchingNextPage) && (
                  <>
                    <VideoCardSkeleton />
                    <VideoCardSkeleton />
                    <VideoCardSkeleton />
                    <VideoCardSkeleton />
                  </>
                )}

                {!isLoading && videos.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-gray-500">No public examples found yet.</p>
                  </div>
                )}

                {!isLoading && hasNextPage && (
                  <div className="col-span-full flex w-full items-center justify-center py-8">
                    <button
                      onClick={() => void fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="rounded-full bg-custom-dark-orange px-8 py-3 text-base font-medium text-white shadow-lg hover:bg-custom-dark-orange/80 transition-all focus:outline-none focus:ring-2 focus:ring-custom-dark-orange focus:ring-offset-2"
                    >
                      {isFetchingNextPage ? "Loading..." : "Load More Examples"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ExamplesHub;

import { type NextPage } from "next";
import Head from "next/head";

import { api } from "~/utils/api";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { getTime } from "~/utils/getTime";
import ProfileMenu from "~/components/ProfileMenu";
import NewVideoMenu from "~/components/NewVideoMenu";
import VideoRecordModal from "~/components/VideoRecordModal";
import VideoUploadModal from "~/components/VideoUploadModal";
import { useAtom } from "jotai";
import uploadVideoModalOpen from "~/atoms/uploadVideoModalOpen";
import recordVideoModalOpen from "~/atoms/recordVideoModalOpen";
import Paywall from "~/components/Paywall";
import paywallAtom from "~/atoms/paywallAtom";
import { usePostHog } from "posthog-js/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import logo from "~/assets/logo.png";

import { getTasksCache, setTasksCache } from "~/utils/cacheUtils";

const VideoList: NextPage = () => {
  const [, setRecordOpen] = useAtom(recordVideoModalOpen);
  const [, setUploadOpen] = useAtom(uploadVideoModalOpen);
  const [, setPaywallOpen] = useAtom(paywallAtom);
  const router = useRouter();
  const { status, data: session } = useSession();

  // Use any state to track mount status to avoid hydration mismatches
  const utils = api.useContext();

  useEffect(() => {
    if (status !== "authenticated") return;

    const cached = getTasksCache(session?.user?.id);
    if (cached) {
      // Inject cached data into the query client after mounting
      utils.video.getAll.setInfiniteData({ limit: 20 }, cached.data);
    }
  }, [utils, session?.user?.id, status]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    dataUpdatedAt
  } = api.video.getAll.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 0, // Always refresh in background while showing cache
    }
  );

  useEffect(() => {
    if (data) {
      setTasksCache(data, dataUpdatedAt, session?.user?.id);
    }
  }, [data, dataUpdatedAt, session?.user?.id]);

  const videos = data?.pages.flatMap((page) => page.items) ?? [];
  const posthog = usePostHog();
  const searchParams = useSearchParams();
  const [closeWindow, setCloseWindow] = useState<boolean>(false);

  if (status === "unauthenticated") {
    void router.replace("/sign-in");
  }

  const checkoutCanceledQueryParam = searchParams.get("checkoutCanceled");
  const closeQueryParam = searchParams.get("close");

  const openRecordModal = () => {
    if (
      !navigator?.mediaDevices?.getDisplayMedia &&
      !navigator?.mediaDevices?.getDisplayMedia
    ) {
      return alert("Your browser is currently NOT supported.");
    }
    if (
      session?.user.stripeSubscriptionStatus === "active" || videos.length < 10 ||
      !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ) {
      setRecordOpen(true);

      posthog?.capture("open record video modal", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
        cta: "empty video list page",
      });
    } else {
      setPaywallOpen(true);

      posthog?.capture("hit video record paywall", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
        cta: "empty video list page",
      });
    }
  };

  const openUploadModal = () => {
    if (
      session?.user.stripeSubscriptionStatus === "active" || videos.length < 10 ||
      !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ) {
      setUploadOpen(true);

      posthog?.capture("open upload video modal", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
        cta: "empty video list page",
      });
    } else {
      setPaywallOpen(true);

      posthog?.capture("hit video upload paywall", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
        cta: "empty video list page",
      });
    }
  };

  useEffect(() => {
    const closeWindow =
      (window.innerWidth === 500 &&
        (window.innerHeight === 499 || window.innerHeight === 500)) ||
      closeQueryParam === "true";
    setCloseWindow(closeWindow);
  }, [closeQueryParam]);

  useEffect(() => {
    if (checkoutCanceledQueryParam && closeQueryParam === "false") {
      setTimeout(() => {
        void router.push("/tasks").then(() => router.reload());
      }, 5000);
    }
  }, [checkoutCanceledQueryParam, closeQueryParam, router]);

  return (
    <>
      <Head>
        <title>Task Library | Greadings</title>
        <meta
          name="description"
          content="Greadings library of screencast video prompts to stop doing repetitive tasks."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex h-screen min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        <div className="flex min-h-[62px] w-full items-center justify-between border-b border-solid border-b-[#E7E9EB] bg-custom-white px-6">
          <div className="flex flex-start items-center">
            <Link href="/" className="flex items-center">
              <Image
                className="cursor-pointer p-2"
                src={logo}
                alt="logo"
                width={42}
                height={42}
                unoptimized
              />
              <p className="text-xl font-bold text-custom-black">Greadings</p>
            </Link>
          </div>
          <div className="flex flex-row items-center justify-center">
            <VideoRecordModal />
            <VideoUploadModal />
            <Paywall />

            {videos?.length &&
              session?.user?.stripeSubscriptionStatus !== "active" ? (
              <div className="hidden md:block mr-2 flex flex-col items-center justify-center rounded px-2 py-2 text-sm text-[#6c6685]">
                <span>{videos.length}/10 tasks</span>
                <div className="mt-1 h-[3px] w-full rounded-full bg-gray-200">
                  <div
                    className={`h-[3px] w-[45%] rounded-full ${videos.length >= 7 ? "bg-red-600" : "bg-blue-600"
                      }`}
                    style={{
                      width: videos.length.toString() + "0%",
                    }}
                  ></div>
                </div>
              </div>
            ) : null}
            <NewVideoMenu videos={videos} />
            {status === "authenticated" && (
              <div className="ml-4 flex items-center justify-center">

                <ProfileMenu />
              </div>
            )}
          </div>
        </div>
        <div
          className="flex w-full grow items-start justify-center overflow-auto bg-custom-white pt-14"
          suppressHydrationWarning={true}
        >
          {closeWindow || checkoutCanceledQueryParam ? (
            <>
              {checkoutCanceledQueryParam === "false" ? (
                <div className="flex flex-col">
                  <span className="text-lg font-semibold text-zinc-700">
                    Successfully upgraded
                  </span>
                  {closeQueryParam === "true" ? (
                    <span className="mt-1 text-base text-zinc-500">
                      You can now close this window and try to upload the video
                      again!
                    </span>
                  ) : (
                    <span className="mt-1 text-base text-zinc-500">
                      You will be redirected shortly
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  {checkoutCanceledQueryParam === "true" ? (
                    <>
                      <span className="text-lg font-semibold text-zinc-700">
                        Purchase cancelled
                      </span>
                      {closeQueryParam === "true" ? (
                        <span className="mt-1 text-base text-zinc-500">
                          You can now close this window
                        </span>
                      ) : (
                        <span className="mt-1 text-base text-zinc-500">
                          You will be redirected shortly
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-zinc-700">
                        Successfully logged in
                      </span>
                      <span className="mt-1 text-base text-zinc-500">
                        You can now close this window and try to upload the
                        video again!
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {!isLoading && videos && videos?.length <= 0 ? (
                <div className="flex items-center justify-center px-8">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-zinc-700">
                      No automations found
                    </span>
                    <span className="mt-1 text-base text-zinc-500">
                      Tasks you record will show up here. Already got tasks recorded?
                      Upload them!
                    </span>
                    <div className="mt-4 flex flex-wrap gap-4">
                      <button
                        onClick={openRecordModal}
                        className="inline-flex items-center rounded-md border border-transparent bg-black px-4 py-1 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      >
                        Record a task
                      </button>
                      <button
                        onClick={openUploadModal}
                        className="inline-flex items-center rounded-md border border-black bg-white px-4 py-2 text-sm font-medium text-black shadow-sm hover:border-custom-dark-orange hover:text-custom-dark-orange focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      >
                        Upload a video
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-start grid w-full max-w-[1300px] grid-cols-[repeat(auto-fill,250px)] flex-row flex-wrap items-center justify-center gap-14 px-4 pb-16">
                  {videos &&
                    videos.map(
                      ({ title, id, createdAt, thumbnailUrl, fileDeletedAt }) => (
                        <VideoCard
                          title={title}
                          id={id}
                          createdAt={createdAt}
                          thumbnailUrl={thumbnailUrl}
                          fileDeletedAt={fileDeletedAt}
                          key={id}
                        />
                      )
                    )}

                  {isLoading || isFetchingNextPage ? (
                    <>
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                      <VideoCardSkeleton />
                    </>
                  ) : null}

                  {!isLoading && hasNextPage && (
                    <div className="col-span-full flex w-full items-center justify-center py-4">
                      <button
                        onClick={() => void fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        {isFetchingNextPage ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
};

interface VideoCardProps {
  title: string;
  id: string;
  thumbnailUrl: string;
  createdAt: Date;
  fileDeletedAt?: Date | null;
}

const VideoCardSkeleton = () => {
  return (
    <div className="h-[240px] w-[250px] animate-pulse overflow-hidden rounded-lg border border-[#6c668533] text-sm font-normal">
      <figure className="relative aspect-video w-full bg-slate-200" />
      <div className="m-4 flex flex-col">
        <span className="h-4 rounded bg-slate-200"></span>
        <span className="mt-4 h-4 rounded bg-slate-200"></span>
      </div>
    </div>
  );
};

const VideoCard = ({
  title,
  id,
  createdAt,
  thumbnailUrl,
  fileDeletedAt,
}: VideoCardProps) => {
  const [imgError, setImgError] = useState(!!fileDeletedAt);

  return (
    <Link href={`/task/${id}`}>
      <div className="group h-[240px] w-[250px] cursor-pointer overflow-hidden rounded-lg border border-[#6c668533] bg-white transition-all hover:border-custom-dark-orange/50 hover:shadow-md">
        <figure className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-50">
          {!imgError && !fileDeletedAt ? (
            <Image
              src={thumbnailUrl}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              alt={title || "video thumbnail"}
              width={248}
              height={139.5}
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10"
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
                <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                  Video unavailable
                </span>
              )}
            </div>
          )}
        </figure>
        <div className="m-4 flex flex-col">
          <span className="line-clamp-2 text-sm font-semibold text-[#0f0f0f]">
            {title}
          </span>
          <span className="mt-2 text-xs text-[#606060]" suppressHydrationWarning>
            {getTime(createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default VideoList;

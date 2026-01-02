import { type NextPage } from "next";
import Head from "next/head";

import { api } from "~/utils/api";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { getTime } from "~/utils/getTime";
import { ShareModal } from "~/components/ShareModal";
import { useSession, signIn } from "next-auth/react";
import VideoMoreMenu from "~/components/VideoMoreMenu";
import ProfileMenu from "~/components/ProfileMenu";
import { usePostHog } from "posthog-js/react";
import { useAtom } from "jotai";
import recordVideoModalOpen from "~/atoms/recordVideoModalOpen";
import VideoRecordModal from "~/components/VideoRecordModal";
import defaultProfileIcon from "~/assets/default profile icon.jpg";
import VideoPlayer from "~/components/VideoPlayer";
import VideoAnalysis from "~/components/VideoAnalysis";
import logo from "~/assets/logo.png";
import Paywall from "~/components/Paywall";
import paywallAtom from "~/atoms/paywallAtom";

const VideoList: NextPage = () => {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { videoId } = router.query as { videoId: string };
  const posthog = usePostHog();
  const [, setRecordOpen] = useAtom(recordVideoModalOpen);
  const [, setPaywallOpen] = useAtom(paywallAtom);

  const { data: video, isLoading } = api.video.get.useQuery(
    { videoId },
    {
      enabled: router.isReady,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.data?.code === "FORBIDDEN") return false;
        else return failureCount < 2;
      },
      onError: (err) => {
        if (err?.data?.code === "FORBIDDEN") {
          posthog?.capture("video page: FORBIDDEN");
        } else if (err?.data?.code === "NOT_FOUND") {
          posthog?.capture("video page: NOT_FOUND");
        }
      },
    }
  );

  const copyTaskMutation = api.video.copyTask.useMutation({
    onSuccess: (data) => {
      void router.push(`/task/${data.newVideoId}`);
    },
    onError: (err) => {
      if (err.message.includes("maximum video limit")) {
        setPaywallOpen(true);
      } else {
        alert(err.message);
      }
    },
  });

  const openRecordModal = () => {
    if (status !== "authenticated") {
      void signIn();
      return;
    }

    if (
      !navigator?.mediaDevices?.getDisplayMedia &&
      !navigator?.mediaDevices?.getDisplayMedia
    ) {
      return alert("Your browser is currently NOT supported.");
    }
    setRecordOpen(true);

    posthog?.capture("open record video modal", {
      stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
      cta: "shared video",
    });
  };

  if (!isLoading && (!video || (!video.video_url && !video.fileDeletedAt))) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <span className="max-w-[80%] text-center text-2xl font-medium">
          This task is currently private or unavailable
        </span>
        <span className="mt-3 max-w-[80%] text-center text-sm">
          To create your own automations,{" "}
          <Link
            onClick={() =>
              posthog?.capture("click sign-up from video error page")
            }
            href="/sign-in"
            className="pointer text-[#4169e1] underline"
          >
            create an account
          </Link>{" "}
          for free!
        </span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {video?.title ?? "Greadings | Show AI What You Want Automated"}
        </title>
        <meta property="og:image" content={video?.thumbnailUrl} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="600" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Record your workflows, tasks and problems to give AI the context it needs to help you automate your processes and resolve your issues."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex min-h-[62px] w-full items-center justify-between border-b border-solid border-b-[#E7E9EB] bg-white px-6">
          <div className="flex flex-start items-center">
            <Link href="/" className="flex items-center">
              <Image
                className="cursor-pointer p-2"
                src={logo}
                alt="logo"
                width={42}
                height={42}
              />
              <p className="text-xl font-bold text-custom-black">Greadings</p>
            </Link>
          </div>
          <div className="flex items-center justify-center">
            {video && video.userId === session?.user.id ? (
              <>
                <VideoMoreMenu video={video} />
                <ShareModal video={video} />
              </>
            ) : video?.sharing || video?.linkShareSeo ? (
              <button
                onClick={() => {
                  if (status !== "authenticated") {
                    void signIn();
                    return;
                  }
                  void copyTaskMutation.mutateAsync({ videoId: video.id });
                }}
                disabled={copyTaskMutation.isLoading}
                className="inline-flex max-h-[35px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 transition-all mr-2"
              >
                {copyTaskMutation.isLoading ? (
                  <svg className="h-4 w-4 animate-spin mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                )}
                Copy task
              </button>
            ) : null}
            {status === "authenticated" ? (
              <>
                <Link href="/tasks">
                  <span className="hidden md:block cursor-pointer rounded border border-black bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-700">
                    My Tasks
                  </span>
                </Link>
                <div className="ml-4 flex items-center justify-center">
                  <ProfileMenu />
                </div>
              </>
            ) : (
              <button
                onClick={openRecordModal}
                className="inline-flex max-h-[35px] items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Record a task
              </button>
            )}
          </div>
        </div>
        <div className="flex w-full grow flex-col items-center justify-start bg-[#fbfbfb]">
          <div className="flex max-h-[calc(100vh-169px)] w-full md:w-[94%] md:max-w-6xl justify-center bg-black md:bg-transparent md:my-8 2xl:max-h-[1160px]">
            {isLoading ? (
              <div className="aspect-video h-full w-full max-h-[60vh] md:max-h-[60dvh] animate-pulse bg-gray-900 md:rounded-xl md:shadow-2xl" />
            ) : video?.fileDeletedAt ? (
              <div className="flex aspect-video md:aspect-auto h-full w-full md:max-h-[20dvh] flex-col items-center justify-center bg-gray-900 text-white md:rounded-xl md:shadow-2xl">
                <div className="rounded-lg bg-gray-800 p-8 text-center shadow-lg">
                  <h3 className="mb-2 text-xl font-semibold text-[#eb4a3a]">
                    Video No Longer Available
                  </h3>
                  <p className="text-gray-300">
                    This video was deleted according to our retention policy. You
                    can still access the task solution!
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    (30 days for free plans, 60 days for paid plans)
                  </p>
                </div>
              </div>
            ) : video?.video_url ? (
              <div className="aspect-video h-full md:max-h-[60dvh] w-full md:rounded-xl md:shadow-2xl md:overflow-hidden bg-black">
                <VideoPlayer
                  video_url={video.video_url}
                  thumbnailUrl={video.thumbnailUrl}
                  className="md:max-h-none h-full w-full"
                />
              </div>
            ) : null}
          </div>
          <div className="mb-10 mt-4 w-full max-w-[1800px] px-4 md:pl-6">
            <div>
              {video?.title ? (
                <div className="mb-4 flex flex-col">
                  <span className="text-[18px] text-lg font-medium">
                    {video.title}
                  </span>
                  <span className="text-[18px] text-sm text-gray-800" suppressHydrationWarning>
                    {getTime(video.createdAt)}
                  </span>
                </div>
              ) : (
                <div className="mb-4 flex flex-col">
                  <div className="h-7 w-[40%] animate-pulse rounded bg-slate-200"></div>
                  <div className="mt-2 h-4 w-[20%] animate-pulse rounded bg-slate-200"></div>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-row items-center">
              {!isLoading ? (
                <>
                  <div className="h-10 w-10 overflow-hidden rounded-full">
                    <Image
                      src={video?.user.image ?? defaultProfileIcon}
                      alt="profile icon"
                      width={40}
                      height={40}
                      unoptimized
                    />
                  </div>
                  <span className="ml-3 font-medium">{video?.user.name}</span>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 animate-pulse overflow-hidden rounded-full bg-slate-200"></div>
                  <div className="ml-3 h-4 w-[150px] animate-pulse rounded bg-slate-200 font-medium"></div>
                </>
              )}
            </div>

            {/* AI Analysis Section */}
            {video ? (
              <VideoAnalysis
                videoId={video.id}
                initialAnalysis={video.aiAnalysis}
                initialGeneratedAt={video.aiAnalysisGeneratedAt}
                initialSolved={video.solved}
                isOwner={video.userId === session?.user.id}
              />
            ) : (
              <div className="mt-6 mr-5">
                <div className="h-[80px] w-full animate-pulse rounded-lg bg-slate-200"></div>
              </div>
            )}
          </div>
        </div>
      </main>

      <VideoRecordModal />
      <Paywall />
    </>
  );
};

export default VideoList;

import { useState } from "react";
import { useAtom } from "jotai/index";
import recordVideoModalOpen from "~/atoms/recordVideoModalOpen";
import { usePostHog } from "posthog-js/react";
import VideoModal from "./VideoModal";

export default function CTA() {
  const [, setRecordOpen] = useAtom(recordVideoModalOpen);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const posthog = usePostHog();

  const openRecordModal = () => {
    if (
      !navigator?.mediaDevices?.getDisplayMedia &&
      !navigator?.mediaDevices?.getDisplayMedia
    ) {
      return alert("Your browser is currently NOT supported.");
    }
    setRecordOpen(true);

    posthog?.capture("open record video modal", {
      cta: "cta section",
    });
  };

  const openVideoModal = () => {
    setVideoModalOpen(true);
  };

  const demoVideoUrl = "https://storage.googleapis.com/greadings/welcome-to-greadings.mp4";
  const demoThumbnailUrl = "https://storage.googleapis.com/greadings/welcome-to-greadings.png";

  return (
    <div className="bg-custom-white">
      <div className="mx-auto max-w-7xl py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="relative isolate overflow-hidden bg-custom-black px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
          <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-custom-white">
            Ready to prompt more efficiently?
          </h2>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={openRecordModal}
              className="inline-flex max-h-[40px] items-center rounded-md border border-transparent bg-white px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-custom-black"
            >
              Record a task
            </button>
            <button
              onClick={() => {
                openVideoModal();
                posthog?.capture("clicked watch recorded demo");
              }}
              className="text-sm font-semibold leading-6 text-custom-white"
            >
              Watch demo <span aria-hidden="true">→</span>
            </button>
            {/* <a
              onClick={() => {
                alert("Not implemented");
                posthog?.capture("clicked schedule demo", { cta: true });
              }}
              target="_blank"
              className="text-sm font-semibold leading-6 text-custom-white"
            >
              Schedule Demo <span aria-hidden="true">→</span>
            </a> */}
            <VideoModal
              isOpen={videoModalOpen}
              onClose={() => setVideoModalOpen(false)}
              videoUrl={demoVideoUrl}
              thumbnailUrl={demoThumbnailUrl}
            />
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2"
            aria-hidden="true"
          >
            <circle
              cx={512}
              cy={512}
              r={512}
              fill="url(#827591b1-ce8c-4110-b064-7cb85a0b1217)"
              fillOpacity="0.7"
            />
            <defs>
              <radialGradient
                id="827591b1-ce8c-4110-b064-7cb85a0b1217"
                cx={0}
                cy={0}
                r={1}
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(512 512) rotate(90) scale(512)"
              >
                <stop stopColor="#7775D6" />
                <stop offset={1} stopColor="#E935C1" stopOpacity={0} />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

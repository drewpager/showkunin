import { type NextPage } from "next";
import { useState } from "react";
import Head from "next/head";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import CTA from "~/components/CTA";
import Pricing from "~/components/Pricing";
import Image from "next/image";
// import { useAtom } from "jotai";
// import recordVideoModalOpen from "~/atoms/recordVideoModalOpen";
import { usePostHog } from "posthog-js/react";
import logo from "~/assets/logo.png";
import feature1 from "~/assets/vibe-automation-1-min.png";
import feature2 from "~/assets/vibe-automation-2-min.png";
import feature3 from "~/assets/vibe-automation-3-min.png";
import { useRouter } from "next/navigation";
import VideoModal from "~/components/VideoModal";

const VibeAutomation: NextPage = () => {
  // const [, setRecordOpen] = useAtom(recordVideoModalOpen);
  const posthog = usePostHog();
  const router = useRouter();
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // const openRecordModal = () => {
  //   if (
  //     !navigator?.mediaDevices?.getDisplayMedia &&
  //     !navigator?.mediaDevices?.getDisplayMedia
  //   ) {
  //     return alert("Your browser is currently NOT supported.");
  //   }
  //   setRecordOpen(true);

  //   posthog?.capture("open record video modal", {
  //     cta: "vibe automation landing page",
  //   });
  // };

  const openVideoModal = () => {
    setVideoModalOpen(true);
  };

  const demoVideoUrl = "https://storage.googleapis.com/greadings/welcome-to-greadings.mp4";
  const demoThumbnailUrl = "https://storage.googleapis.com/greadings/welcome-to-greadings.png";

  return (
    <>
      <Head>
        <title>Vibe Automation | Show AI What You Want Automated</title>
        <meta
          name="description"
          content="Automate your workflow by showing AI exactly how you want things done through simple screencasts. You bring the vibes, AI will do the rest."
        />
      </Head>

      <div className="bg-custom-white min-h-screen">
        <Header />

        <main className="isolate">
          {/* Hero Section */}
          <section className="relative px-6 pt-14 lg:px-8">
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
              <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-custom-orange to-[#ff80b5] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
            </div>
            {/* <div className="flex items-center justify-center">
              <h1 className="text-md font-normal p-2 px-6 bg-black text-white rounded-lg">Vibe Automation</h1>
            </div> */}
            <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
              <div className="flex items-center justify-center mb-6">
                <h1 className="text-md font-normal p-2 px-6 bg-custom-dark-orange text-white rounded-lg">Vibe Automation</h1>
              </div>
              <Image
                src={logo}
                alt="Greadings Logo"
                width={120}
                height={120}
                className="mx-auto mb-10 transition-transform hover:scale-105 duration-300"
              />
              <h1 className="text-4xl font-bold tracking-tight text-custom-black sm:text-6xl animate-fade-in">
                Show AI Your <span className="text-custom-dark-orange">Work</span> and Let Ideas <span className="text-custom-dark-orange">Flow</span>
              </h1>
              <p className="mt-6 text-xl leading-8 text-custom-dark">
                Show and tell AI the most accurate context window for automation: your real-time workflow environment.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <button
                  // onClick={openRecordModal}
                  onClick={() => router.push("/sign-in")}
                  className="rounded-full bg-custom-orange px-10 py-5 text-lg font-semibold text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-custom-orange transition-all duration-300"
                >
                  Start Automating Now
                </button>
              </div>
            </div>

            <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
              <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-custom-orange opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
            </div>
          </section>

          {/* Feature 1 */}
          <section className="py-24 sm:py-32 bg-white overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:gap-y-20 lg:grid-cols-2 lg:items-center">
                <div className="lg:pr-8">
                  <div className="lg:max-w-lg">
                    <h2 className="text-3xl font-bold tracking-tight text-custom-black sm:text-4xl">
                      An AI shadow for your workflow.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-custom-dark">
                      Screencast your workflow, AI provides a low- to no-code solution, Refine and iterate the automation.
                    </p>
                    <button
                      onClick={() => {
                        openVideoModal();
                        posthog?.capture("clicked watch recorded demo");
                      }}
                      className="text-sm mt-4 font-semibold leading-6 text-custom-black hover:text-custom-dark-orange hover:underline transition-colors"
                    >
                      Watch demo
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-2xl lg:max-w-none">
                    <Image
                      src={feature1}
                      alt="Feature 1"
                      width={1200}
                      height={800}
                      className="w-full rounded-2xl transition-transform hover:scale-[1.02] duration-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 2 */}
          <section className="py-24 sm:py-32 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:gap-y-20 lg:grid-cols-2 lg:items-center">
                <div className="lg:order-last lg:pl-8">
                  <div className="lg:max-w-lg">
                    <h2 className="text-3xl font-bold tracking-tight text-custom-black sm:text-4xl">
                      Refine response with additional screencasts.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-custom-dark">
                      Provide updated context with text prompt or follow-up screencast.
                    </p>
                    <button
                      onClick={() => {
                        openVideoModal();
                        posthog?.capture("clicked watch recorded demo");
                      }}
                      className="text-sm mt-4 font-semibold leading-6 text-custom-black hover:text-custom-dark-orange hover:underline transition-colors"
                    >
                      Watch demo
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center lg:order-first">
                  <div className="relative w-full max-w-2xl lg:max-w-none">
                    <Image
                      src={feature2}
                      alt="Feature 2"
                      width={1200}
                      height={800}
                      className="w-full rounded-2xl transition-transform hover:scale-[1.02] duration-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature 3 */}
          <section className="py-24 sm:py-32 bg-white overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:gap-y-20 lg:grid-cols-2 lg:items-center">
                <div className="lg:pr-8">
                  <div className="lg:max-w-lg">
                    <h2 className="text-3xl font-bold tracking-tight text-custom-black sm:text-4xl">
                      From problem to solved, fast.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-custom-dark">
                      Go from recording to a fully functional automation in minutes, not weeks. Our framework generates robust, repeatable scripts that scale with your needs.
                    </p>
                    <button
                      onClick={() => {
                        openVideoModal();
                        posthog?.capture("clicked watch recorded demo");
                      }}
                      className="text-sm mt-4 font-semibold leading-6 text-custom-black hover:text-custom-dark-orange hover:underline transition-colors"
                    >
                      Watch demo
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-2xl lg:max-w-none">
                    <Image
                      src={feature3}
                      alt="Feature 3"
                      width={1200}
                      height={800}
                      className="w-full rounded-2xl transition-transform hover:scale-[1.02] duration-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing Component */}
          <Pricing />

          {/* CTA */}
          <CTA />
        </main>

        <VideoModal
          isOpen={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          videoUrl={demoVideoUrl}
          thumbnailUrl={demoThumbnailUrl}
        />

        <Footer />
      </div>
    </>
  );
};

export default VibeAutomation;

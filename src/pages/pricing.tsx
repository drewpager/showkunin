import Footer from "~/components/Footer";
import Header from "~/components/Header";
import Head from "next/head";
import dynamic from "next/dynamic";
import { Disclosure, DisclosureButton, DisclosurePanel, Transition } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/20/solid";
import CTA from "~/components/CTA";
import PricingComponent from "~/components/Pricing";

// Dynamic import for heavy modal component
const VideoRecordModal = dynamic(() => import("~/components/VideoRecordModal"), { ssr: false });

export default function Pricing() {
  return (
    <>
      <Head>
        <title>Greadings | Pricing</title>
        <meta
          name="description"
          content="Pricing page for Greadings, a platform to show (and tell) AI what you want automated and stop doing repetitive tasks."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />

      <PricingComponent />

      <div className="flex flex-col items-center justify-center border-y border-[#eaeaea] bg-[#fafafa] pb-8">
        <div className="mb-12 mt-8">
          <span className="text-5xl font-bold">FAQs</span>
        </div>
        <div className="flex flex-1 border-collapse flex-col justify-center px-6">
          {[
            {
              question: "What are my payment options?",
              answer:
                "You can be billed monthly, but save 33% if you pay annually. We currently accept credit card payment. Contact us at drew@greadings.com if you need an alternative payment method.",
            },
            {
              question: "Can I upload videos I already recorded?",
              answer: "Yes! Greadings allows you to import your existing videos and automate.",
            },
            {
              question: "How do I contact Support?",
              answer:
                "If you need to contact our Support, email drew@greadings.com.",
            },
          ].map(({ answer, question }) => (
            <Disclosure
              key={question}
              as="div"
              className="max-w-[80vw] sm:w-[600px]"
            >
              {({ open }) => (
                <>
                  <DisclosureButton className="flex h-12 w-full items-center justify-between border-t border-[#eaeaea] px-4 py-8 text-left text-md font-medium">
                    <span>{question}</span>
                    <ChevronUpIcon
                      className={`transition-transform ${open ? "rotate-180" : ""
                        } h-5 w-5`}
                    />
                  </DisclosureButton>
                  <Transition
                    enter="transition duration-100 ease-out"
                    enterFrom="transform scale-95 opacity-0"
                    enterTo="transform scale-100 opacity-100"
                    leave="transition duration-75 ease-out"
                    leaveFrom="transform scale-100 opacity-100"
                    leaveTo="transform scale-95 opacity-0"
                  >
                    <DisclosurePanel className="px-4 pb-2 pt-0 text-md text-gray-500">
                      {answer}
                    </DisclosurePanel>
                  </Transition>
                </>
              )}
            </Disclosure>
          ))}
        </div>
      </div>

      <CTA />

      <Footer />

      <VideoRecordModal />
    </>
  );
}

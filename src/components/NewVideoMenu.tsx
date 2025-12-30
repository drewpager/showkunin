import { Menu, Transition, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Fragment } from "react";
import uploadVideoModalOpen from "~/atoms/uploadVideoModalOpen";
import { useAtom } from "jotai";
import recordVideoModalOpen from "~/atoms/recordVideoModalOpen";
import paywallAtom from "~/atoms/paywallAtom";
import { useSession } from "next-auth/react";
import { usePostHog } from "posthog-js/react";
import { type Video } from "@prisma/client";


export default function NewVideoMenu({ videos }: { videos?: Video[] }) {
  const [, setRecordOpen] = useAtom(recordVideoModalOpen);
  const [, setUploadOpen] = useAtom(uploadVideoModalOpen);
  const [, setPaywallOpen] = useAtom(paywallAtom);
  const { data: session } = useSession();
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
      stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
    });
  };

  const openUploadModal = () => {
    if (
      session?.user.stripeSubscriptionStatus === "active" ||
      videos && videos.length <= 10 ||
      !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ) {
      setUploadOpen(true);

      posthog?.capture("open upload video modal", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
      });
    } else {
      setPaywallOpen(true);

      posthog?.capture("hit video upload paywall", {
        stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
      });
    }
  };

  return (
    <>
      {session?.user.stripeSubscriptionStatus === "active" ||
        videos && videos.length <= 10 ||
        !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
        <Menu as="div" className="relative inline-block text-left">
          <MenuButton>
            <span className="cursor-pointer rounded-md border border-black px-4 py-1.5 text-sm font-medium bg-black text-white hover:bg-white hover:text-black hover:border-black">
              New task
            </span>
          </MenuButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems className="absolute right-0 z-10 mt-2 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="px-1 py-1 ">
                <MenuItem>
                  {({ active }) => (
                    <div
                      onClick={openRecordModal}
                      className={`mx-2 flex h-8 w-40 cursor-pointer flex-row content-center rounded-md p-2 ${active ? "bg-gray-100" : ""
                        }`}
                    >
                      <p className="leading-2 text-sm leading-4">Record workflow</p>
                    </div>
                  )}
                </MenuItem>
                <MenuItem>
                  {({ active }) => (
                    <div
                      onClick={openUploadModal}
                      className={`mx-2 flex h-8 w-40 cursor-pointer flex-row content-center rounded-md p-2 ${active ? "bg-gray-100" : ""
                        }`}
                    >
                      <p className="leading-2 text-sm leading-4">Upload a video</p>
                    </div>
                  )}
                </MenuItem>
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      ) : (
        <button
          onClick={() => {
            setPaywallOpen(true);
            posthog?.capture("hit video upload/record paywall", {
              stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
            });
          }}
          className="cursor-pointer rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-black hover:bg-gray-50 transition-colors"
        >
          New task
        </button>
      )}
    </>
  );
}

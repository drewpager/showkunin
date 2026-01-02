import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { Fragment, useState } from "react";
import { ModernSwitch } from "~/components/ModernSwitch";
import { api, type RouterOutputs } from "~/utils/api";
import ExpireDateSelectMenu from "~/components/ExpireDateSelectMenu";
import { usePostHog } from "posthog-js/react";

interface Props {
  video: RouterOutputs["video"]["get"];
}

export function ShareModal({ video }: Props) {
  const utils = api.useContext();
  const [open, setOpen] = useState<boolean>(false);
  const posthog = usePostHog();

  const openModal = () => {
    setOpen(true);
    posthog?.capture("open video share modal", {
      videoSharing: video.sharing,
      videoId: video.id,
    });
  };

  const closeModal = () => {
    setOpen(false);
    posthog?.capture("close video share modal", {
      videoSharing: video.sharing,
      videoId: video.id,
    });
  };

  const setSharingMutation = api.video.setSharing.useMutation({
    onMutate: async ({ videoId, sharing }) => {
      await utils.video.get.cancel();
      const previousValue = utils.video.get.getData({ videoId });
      if (previousValue) {
        utils.video.get.setData({ videoId }, { ...previousValue, sharing });
      }
      return { previousValue };
    },
    onError: (err, { videoId }, context) => {
      if (context?.previousValue) {
        utils.video.get.setData({ videoId }, context.previousValue);
      }
      console.error(err.message);
    },
  });

  const setDeleteAfterLinkExpiresMutation =
    api.video.setDeleteAfterLinkExpires.useMutation({
      onMutate: async ({ videoId, delete_after_link_expires }) => {
        await utils.video.get.cancel();
        const previousValue = utils.video.get.getData({ videoId });
        if (previousValue) {
          utils.video.get.setData(
            { videoId },
            { ...previousValue, delete_after_link_expires }
          );
        }
        return { previousValue };
      },
      onError: (err, { videoId }, context) => {
        if (context?.previousValue) {
          utils.video.get.setData({ videoId }, context.previousValue);
        }
        console.error(err.message);
      },
    });

  const setLinkShareSeoMutation = api.video.setLinkShareSeo.useMutation({
    onMutate: async ({ videoId, linkShareSeo }) => {
      await utils.video.get.cancel();
      const previousValue = utils.video.get.getData({ videoId });
      if (previousValue) {
        utils.video.get.setData({ videoId }, { ...previousValue, linkShareSeo });
      }
      return { previousValue };
    },
    onError: (err, { videoId }, context) => {
      if (context?.previousValue) {
        utils.video.get.setData({ videoId }, context.previousValue);
      }
      console.error(err.message);
    },
  });

  const setSolvedMutation = api.video.setSolved.useMutation({
    onMutate: async ({ videoId, solved }) => {
      await utils.video.get.cancel();
      const previousValue = utils.video.get.getData({ videoId });
      if (previousValue) {
        utils.video.get.setData({ videoId }, { ...previousValue, solved });
      }
      return { previousValue };
    },
    onError: (err, { videoId }, context) => {
      if (context?.previousValue) {
        utils.video.get.setData({ videoId }, context.previousValue);
      }
      console.error(err.message);
    },
  });

  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [showSolvedPrompt, setShowSolvedPrompt] = useState<boolean>(false);

  const handleToggleSeo = () => {
    const newVal = !video.linkShareSeo;
    if (newVal && video.solved !== true) {
      setShowSolvedPrompt(true);
    } else {
      setLinkShareSeoMutation.mutate({
        videoId: video.id,
        linkShareSeo: newVal,
      });
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => {
      setLinkCopied(false);
    }, 5000);

    posthog?.capture("public video link copied", {
      videoSharing: video.sharing,
      videoId: video.id,
    });
  };

  return (
    <>
      <button
        onClick={openModal}
        className="mr-1 md:mr-4 min-h-[33px] cursor-pointer rounded border border-black px-4 py-1 text-sm text-black hover:bg-black hover:text-white"
      >
        Share
      </button>

      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded bg-white p-6 text-left align-middle text-custom-black shadow-xl transition-all">
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-medium">
                      Share this automation
                    </span>
                    <div className="mt-6 flex w-full items-center justify-between">
                      <span className="text-sm font-medium">
                        Share link with anyone
                      </span>
                      <ModernSwitch
                        enabled={video.sharing}
                        toggle={() =>
                          setSharingMutation.mutate({
                            videoId: video.id,
                            sharing: !video.sharing,
                          })
                        }
                      />
                    </div>
                    {video.sharing ? (
                      <>
                        <button
                          onClick={handleCopy}
                          className="my-2 h-8 w-full rounded-md bg-custom-black text-sm font-medium text-white hover:bg-custom-black/80"
                        >
                          {linkCopied ? "Copied!" : "Copy public link"}
                        </button>
                        <div className="w-full border border-solid border-[#e9ebf0] bg-[#fafbfc] px-[15px] py-3 text-xs">
                          <div className="flex h-6 items-center justify-between">
                            <span>Expire link</span>
                            <ExpireDateSelectMenu
                              videoId={video.id}
                              shareLinkExpiresAt={video.shareLinkExpiresAt}
                            />
                          </div>
                          <div className="mt-3 flex h-6 items-center justify-between">
                            <span>Delete video after link expires</span>
                            <ModernSwitch
                              enabled={video.delete_after_link_expires}
                              toggle={() =>
                                setDeleteAfterLinkExpiresMutation.mutate({
                                  videoId: video.id,
                                  delete_after_link_expires:
                                    !video.delete_after_link_expires,
                                })
                              }
                            />
                          </div>
                          <div className="mt-3 flex h-6 items-center justify-between">
                            <div className="flex flex-col">
                              <span>Appear in search results</span>
                              <span className="text-[10px] text-custom-dark-orange">Public videos with SEO enabled are indexed by search engines</span>
                            </div>
                            <ModernSwitch
                              enabled={video.linkShareSeo}
                              toggle={handleToggleSeo}
                            />
                          </div>
                          {showSolvedPrompt && (
                            <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
                              <p className="text-sm font-semibold">Is this task solved correctly?</p>
                              <p className="mt-1 text-xs text-gray-500">
                                Setting a task as &quot;solved&quot; is required before it can appear in search results.
                              </p>
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => {
                                    const updateSolved = async () => {
                                      try {
                                        await setSolvedMutation.mutateAsync({ videoId: video.id, solved: true });
                                        setLinkShareSeoMutation.mutate({ videoId: video.id, linkShareSeo: true });
                                      } catch (err) {
                                        console.error("Failed to update solved status", err);
                                      }
                                      setShowSolvedPrompt(false);
                                    };
                                    void updateSolved();
                                  }}
                                  className="rounded bg-custom-green px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-custom-green/90"
                                >
                                  Yes, it&#39;s solved
                                </button>
                                <button
                                  onClick={() => {
                                    setSolvedMutation.mutate({ videoId: video.id, solved: false });
                                    setShowSolvedPrompt(false);
                                  }}
                                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => setShowSolvedPrompt(false)}
                                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

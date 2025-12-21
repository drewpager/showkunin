import React, { type ChangeEvent, Fragment, useRef, useState } from "react";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { api } from "~/utils/api";
import axios from "axios";
import { useRouter } from "next/router";
import { useAtom } from "jotai";
import uploadVideoModalOpen from "~/atoms/uploadVideoModalOpen";
import { usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";
import generateThumbnail from "~/utils/generateThumbnail";

import { invalidateTasksCache } from "~/utils/cacheUtils";

export default function VideoUploadModal() {
  const [open, setOpen] = useAtom(uploadVideoModalOpen);
  const router = useRouter();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [file, setFile] = useState<File>();
  const [userContext, setUserContext] = useState<string | undefined>(undefined);
  const getSignedUrl = api.video.getUploadUrl.useMutation();
  const apiUtils = api.useContext();
  const videoRef = useRef<null | HTMLVideoElement>(null);
  const posthog = usePostHog();
  const { data: session } = useSession();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  function closeModal() {
    setOpen(false);

    posthog?.capture("cancel video upload", {
      stripeSubscriptionStatus: session?.user.stripeSubscriptionStatus,
    });
  }

  const handleSubmit = async (): Promise<void> => {
    if (!file) return;
    setSubmitting(true);
    const title = file.name.replace(/\.[^/.]+$/, "");
    const { signedVideoUrl, signedThumbnailUrl, id } =
      await getSignedUrl.mutateAsync({
        key: title,
        userContext: userContext || undefined,
      });
    await axios
      .put(signedVideoUrl, file.slice(), {
        headers: { "Content-Type": file.type },
      })
      .then(async () => {
        if (!videoRef.current) return;
        return axios.put(
          signedThumbnailUrl,
          await generateThumbnail(videoRef.current),
          {
            headers: { "Content-Type": "image/png" },
          }
        );
      })
      .then(() => {
        setOpen(false);
        invalidateTasksCache(session?.user?.id);
        void router.push("task/" + id + "?analyze=true");
      })
      .catch((err) => {
        console.error(err);
      });
    setSubmitting(false);
    void apiUtils.video.getAll.invalidate();
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={() => void closeModal()}
      >
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
              <DialogPanel className="w-fit transform rounded-lg bg-custom-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex flex-col items-center gap-2">
                  <label className="flex h-32 w-full min-w-[300px] cursor-pointer appearance-none justify-center rounded-md border-2 border-dashed border-gray-300 px-4 transition hover:border-gray-400 focus:outline-none">
                    <span className="mx-6 flex items-center space-x-2 text-black">
                      {file ? (
                        <video
                          src={URL.createObjectURL(file)}
                          controls
                          ref={videoRef}
                          className="max-h-[0px] max-w-[15px]"
                          controlsList="nodownload"
                        />
                      ) : null}
                      {file ? (
                        <span className="font-medium">{file.name}</span>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <span className="font-medium">
                            {"Drop files to Attach, or browse"}
                          </span>
                        </>
                      )}
                    </span>
                    <input
                      accept="video/mp4,video/webm"
                      onChange={handleFileChange}
                      type="file"
                      name="file_upload"
                      className="hidden"
                    />
                  </label>
                  <textarea
                    name="user_context"
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    placeholder="Additional context (e.g. documentation, data, etc.)"
                    className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-2 font-sans text-gray-900 focus:border-black focus:ring-black"
                    maxLength={100000}
                  />
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold leading-6 text-white shadow transition duration-150 ease-in-out hover:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? (
                      <>
                        <svg
                          className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>Upload</>
                    )}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

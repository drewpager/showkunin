import React, { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import "@vidstack/react/player/styles/base.css";

import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Poster,
  type MediaCanPlayDetail,
  type MediaCanPlayEvent,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
} from "@vidstack/react";

import { VideoLayout } from "./VideoLayout";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  thumbnailUrl: string;
}

const VideoModal = ({ isOpen, onClose, videoUrl, thumbnailUrl }: VideoModalProps) => {
  if (!isOpen) return null;
  const player = useRef<MediaPlayerInstance>(null);

  useEffect(() => {
    // Subscribe to state updates.
    return player.current?.subscribe(({ paused, viewType }) => {
      console.log('is paused?', '->', paused);
      console.log('is audio view?', '->', viewType === 'audio');
    });
  }, []);

  function onProviderChange(
    provider: MediaProviderAdapter | null,
    _nativeEvent: MediaProviderChangeEvent
  ) {
    // We can configure provider's here.
    if (isHLSProvider(provider)) {
      provider.config = {};
    }
  }

  // We can listen for the `can-play` event to be notified when the player is ready.
  function onCanPlay(
    _detail: MediaCanPlayDetail,
    _nativeEvent: MediaCanPlayEvent
  ) {
    // ...
  }

  const [posterError, setPosterError] = React.useState(false);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="video-modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-zinc-900 p-2 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-5xl border border-white/10">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          <div className="aspect-video w-full overflow-hidden rounded-xl">
            <MediaPlayer
              className="ring-media-focus aspect-video w-full overflow-hidden rounded-md bg-black font-sans text-white data-[focus]:ring-4"
              src={videoUrl}
              crossOrigin
              playsInline
              onProviderChange={onProviderChange}
              onCanPlay={onCanPlay}
              ref={player}
              keyTarget="document"
            >
              <MediaProvider>
                {thumbnailUrl && !posterError ? (
                  <Poster
                    className="absolute inset-0 block h-full w-full rounded-md object-cover opacity-0 transition-opacity data-[visible]:opacity-100"
                    src={thumbnailUrl}
                    alt="video thumbnail"
                    onError={() => setPosterError(true)}
                  />
                ) : (
                  <></>
                )}
              </MediaProvider>

              <VideoLayout />
            </MediaPlayer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;

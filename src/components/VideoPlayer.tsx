import "@vidstack/react/player/styles/base.css";

import React, { useEffect, useRef } from "react";

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

interface Props {
  video_url: string;
  thumbnailUrl?: string;
}

export default function VideoPlayer({ video_url, thumbnailUrl }: Props) {
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
    <MediaPlayer
      className="ring-media-focus aspect-video w-full overflow-hidden rounded-md bg-black font-sans text-white data-[focus]:ring-4"
      src={[
        {
          src: video_url,
          type: "video/webm",
        },
      ]}
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
          // <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          //   <svg
          //     xmlns="http://www.w3.org/2000/svg"
          //     className="h-12 w-12 text-zinc-700"
          //     fill="none"
          //     viewBox="0 0 24 24"
          //     stroke="currentColor"
          //   >
          //     <path
          //       strokeLinecap="round"
          //       strokeLinejoin="round"
          //       strokeWidth={1.5}
          //       d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          //     />
          //   </svg>
          // </div>
        )}
      </MediaProvider>

      <VideoLayout />
    </MediaPlayer>
  );
}

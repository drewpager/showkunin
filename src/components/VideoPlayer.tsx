import "@vidstack/react/player/styles/base.css";

import React, { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";

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
  className?: string;
}

export default function VideoPlayer({ video_url, thumbnailUrl, className }: Props) {
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
      className={twMerge(
        "ring-media-focus aspect-video h-full w-full max-h-[60dvh] min-h-[26dvh] sm:max-w-[100dvw] md:max-h-[45dvh] overflow-hidden rounded-md bg-black font-sans text-white data-[focus]:ring-4",
        className
      )}
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
            className="absolute inset-0 block h-full w-full rounded-md object-cover opacity-0 transition-opacity data-[visible]:opacity-100 poster-eager"
            src={thumbnailUrl}
            alt="video thumbnail"
            onError={() => setPosterError(true)}
          />
        ) : (
          <></>
        )}
      </MediaProvider>

      <VideoLayout thumbnails={thumbnailUrl} />
    </MediaPlayer>
  );
}

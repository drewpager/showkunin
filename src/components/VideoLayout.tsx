import * as Tooltip from "@radix-ui/react-tooltip";
import { Gesture, useMediaState, TimeSlider } from "@vidstack/react";
import { useState, useEffect, useRef } from "react";

import * as Buttons from "./buttons";
import * as Sliders from "./sliders";
import { TimeGroup } from "./time-group";

const popupOffset = 30;

export interface VideoLayoutProps {
  thumbnails?: string;
}

export function VideoLayout({ thumbnails }: VideoLayoutProps) {
  const paused = useMediaState('paused');
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showControls = paused || !isIdle;

  // Reset idle timer on interaction
  const resetIdleTimer = () => {
    setIsIdle(false);
    clearTimeout(timeoutRef.current);
    if (!paused) {
      timeoutRef.current = setTimeout(() => setIsIdle(true), 2000);
    }
  };

  useEffect(() => {
    if (paused) {
      setIsIdle(false);
      clearTimeout(timeoutRef.current);
    } else {
      resetIdleTimer();
    }
    return () => clearTimeout(timeoutRef.current);
  }, [paused]);

  return (
    <div className="vds-video-layout absolute inset-0 z-10 touch-manipulation pointer-events-none">
      <Gestures />
      <div
        className={`absolute inset-0 z-10 flex h-full w-full flex-col bg-gradient-to-t from-black/10 to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'
          }`}
      >
        <Tooltip.Provider>
          <div className="flex-1" />
          <div
            className={`flex w-full items-center px-2 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onPointerMove={resetIdleTimer}
            onPointerDown={resetIdleTimer}
          >
            <Sliders.Time thumbnails={thumbnails} />
          </div>
          <div
            className={`-mt-0.5 flex w-full items-center px-2 pb-2 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onPointerMove={resetIdleTimer}
            onPointerDown={resetIdleTimer}
          >
            <Buttons.Play tooltipAlign="start" tooltipOffset={popupOffset} />
            <Buttons.Mute tooltipOffset={popupOffset} />
            <Sliders.Volume />
            <TimeGroup />
            <div className="flex-1" />
            <Buttons.PIP tooltipOffset={popupOffset} />
            <Buttons.Fullscreen tooltipAlign="end" tooltipOffset={popupOffset} />
          </div>
          <div className="controlsShadow absolute bottom-0 z-[-1] h-full w-full" />
        </Tooltip.Provider>
      </div>
    </div>
  );
}

function Gestures() {
  return (
    <>
      <Gesture
        className="absolute inset-0 z-0 block h-full w-full pointer-events-auto"
        event="pointerup"
        action="toggle:paused"
      />
      <Gesture
        className="absolute inset-0 z-0 block h-full w-full pointer-events-auto"
        event="dblclick"
        action="toggle:fullscreen"
      />
      <Gesture
        className="absolute left-0 top-0 z-10 block h-full w-1/5 pointer-events-auto"
        event="dblclick"
        action="seek:-10"
      />
      <Gesture
        className="absolute right-0 top-0 z-10 block h-full w-1/5 pointer-events-auto"
        event="dblclick"
        action="seek:10"
      />
    </>
  );
}

import {
  TimeSlider,
  VolumeSlider,
} from "@vidstack/react";

export function Volume() {
  return (
    <VolumeSlider.Root className="group relative inline-flex h-12 w-full max-w-[80px] cursor-pointer select-none items-center outline-none touch-none">
      <VolumeSlider.Track className="relative h-[5px] w-full rounded-sm bg-white/30">
        <VolumeSlider.TrackFill className="absolute h-full w-[var(--slider-fill)] rounded-sm bg-[#f5f5f5] will-change-[width]" />
      </VolumeSlider.Track>
      <VolumeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 block h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 outline-none ring-white/40 transition-opacity will-change-[left] focus:opacity-100 focus:ring-4 group-hover:opacity-100 data-[active]:opacity-100 data-[dragging]:opacity-100" />
    </VolumeSlider.Root>
  );
}

export interface TimeSliderProps {
  thumbnails?: string;
}

export function Time({ thumbnails }: TimeSliderProps) {
  return (
    <TimeSlider.Root className="group relative inline-flex h-10 w-full cursor-pointer select-none items-center outline-none touch-none">
      <TimeSlider.Track className="relative h-[5px] w-full rounded-sm bg-white/30">
        <TimeSlider.Progress className="absolute h-full w-[var(--slider-progress)] rounded-sm bg-white/50 will-change-[width]" />
        <TimeSlider.TrackFill className="absolute h-full w-[var(--slider-fill)] rounded-sm bg-[#f5f5f5] will-change-[width]" />
      </TimeSlider.Track>
      <TimeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 block h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 outline-none ring-white/40 transition-opacity will-change-[left] focus:opacity-100 focus:ring-4 group-hover:opacity-100 data-[active]:opacity-100 data-[dragging]:opacity-100" />
      <TimeSlider.Preview className="pointer-events-none absolute flex flex-col items-center opacity-0 transition-opacity duration-200 data-[visible]:opacity-100">
        {thumbnails ? (
          <TimeSlider.Thumbnail.Root
            src={thumbnails}
            className="mb-2 block h-[var(--thumbnail-height)] max-h-[160px] min-h-[80px] w-[var(--thumbnail-width)] min-w-[120px] max-w-[180px] overflow-hidden border border-white bg-black"
          >
            <TimeSlider.Thumbnail.Img />
          </TimeSlider.Thumbnail.Root>
        ) : null}
        <TimeSlider.Value className="text-[13px] text-white" />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}
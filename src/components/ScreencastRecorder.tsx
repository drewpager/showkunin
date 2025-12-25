import React, { useState, useRef } from "react";
import RecordRTC from "recordrtc";
import * as EBML from "ts-ebml";

interface ScreencastRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ScreencastRecorder({
  onRecordingComplete,
  onCancel,
  isOpen,
}: ScreencastRecorderProps) {
  const [step, setStep] = useState<"pre" | "recording" | "post">("pre");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const recorderRef = useRef<RecordRTC | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const getSeekableBlob = (inputBlob: Blob, callback: (blob: Blob) => void) => {
    const reader = new EBML.Reader();
    const decoder = new EBML.Decoder();
    const tools = EBML.tools;

    const fileReader = new FileReader();
    fileReader.onload = function () {
      if (!this.result || typeof this.result === "string") return;
      const ebmlElms = decoder.decode(this.result);
      ebmlElms.forEach(function (element) {
        reader.read(element);
      });
      reader.stop();

      const refinedMetadataBuf = tools.makeMetadataSeekable(
        reader.metadatas,
        duration * 1000,
        reader.cues
      );

      const body = this.result.slice(reader.metadataSize);
      const newBlob = new Blob([refinedMetadataBuf, body], {
        type: "video/webm",
      });

      callback(newBlob);
    };
    fileReader.readAsArrayBuffer(inputBlob);
  };

  const handleStartRecording = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1280,
          height: 720,
          frameRate: 24,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 22050, // Lower sample rate for smaller file size
        },
      });

      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch (error) {
        console.error("Failed to access microphone:", error);
      }

      const mediaStream = new MediaStream();
      if (micStream) {
        micStream
          .getAudioTracks()
          .forEach((track) => mediaStream.addTrack(track));
      }
      screenStream
        .getVideoTracks()
        .forEach((track) => mediaStream.addTrack(track));

      const firstVideoTrack = screenStream.getVideoTracks()[0];
      if (firstVideoTrack) {
        firstVideoTrack.addEventListener("ended", () => handleStopRecording());
      }

      setStream(mediaStream);
      recorderRef.current = new RecordRTC(mediaStream, {
        type: "video",
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mimeType: 'video/webm;codecs="vp9,opus"',
      });
      recorderRef.current.startRecording();
      startTimer();
      setStep("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current === null) return;
    stopTimer();
    recorderRef.current.stopRecording(() => {
      if (recorderRef.current) {
        getSeekableBlob(recorderRef.current.getBlob(), function (fixedBlob) {
          setBlob(fixedBlob);
        });
        stream?.getTracks().forEach((track) => track.stop());
      }
    });
    setStep("post");
  };

  const handlePauseResume = () => {
    if (recorderRef.current) {
      if (isPaused) {
        recorderRef.current.resumeRecording();
        startTimer();
      } else {
        recorderRef.current.pauseRecording();
        stopTimer();
      }
      setIsPaused(!isPaused);
    }
  };

  const handleCancel = () => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        stream?.getTracks().forEach((track) => track.stop());
      });
    }
    stopTimer();
    setStep("pre");
    setDuration(0);
    setBlob(null);
    onCancel();
  };

  const handleComplete = () => {
    if (blob) {
      onRecordingComplete(blob);
      setStep("pre");
      setDuration(0);
      setBlob(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        {step === "pre" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Record Screencast Update
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Record a new screencast to provide additional visual context for your refinement request.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleStartRecording()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
                Start Recording
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "recording" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recording...
            </h3>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-3xl font-mono text-red-600">
                {formatTime(duration)}
              </div>
              <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleStopRecording}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
                Stop
              </button>
              <button
                onClick={handlePauseResume}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {isPaused ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "post" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recording Complete
            </h3>
            {blob && (
              <div className="mb-4">
                <video
                  src={URL.createObjectURL(blob)}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Use This Recording
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { AbsoluteFill, Sequence, Audio } from "remotion";
import { SceneComponent } from "./Scene";
import { ProgressBar } from "./components/ProgressBar";

interface VideoCompositionProps {
  scenePlan: {
    title: string;
    scenes: Array<{
      sceneNumber: number;
      duration: number;
      narrationText: string;
      backgroundColor: string;
      voiceoverUrl?: string;
      textOverlays: Array<{
        text: string;
        position: string;
        fontSize: number;
        animation: string;
        color: string;
        delay: number;
      }>;
      elements: Array<{
        role: string;
        assetTag: string;
        motion: string;
        position: { x: number; y: number };
        scale: number;
        delay: number;
        duration: number;
        resolvedSrc?: string;
      }>;
      transition: string;
    }>;
  };
  musicUrl?: string | null;
  musicVolume?: number;
  showCaptions?: boolean;
  captionSize?: "small" | "medium" | "large";
  showProgressBar?: boolean;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenePlan,
  musicUrl,
  musicVolume = 0.15,
  showCaptions = true,
  captionSize = "medium",
  showProgressBar = true,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f13" }}>
      {scenePlan.scenes.map((scene, index) => {
        const durationInFrames = Math.round(scene.duration * FPS);
        const startFrame = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <SceneComponent scene={scene} durationInFrames={durationInFrames} showCaptions={showCaptions} captionSize={captionSize} />
            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} volume={1} />
            )}
          </Sequence>
        );
      })}
      {musicUrl && (
        <Audio src={musicUrl} volume={musicVolume} />
      )}
      {showProgressBar && <ProgressBar />}
    </AbsoluteFill>
  );
};

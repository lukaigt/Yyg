import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SceneComponent } from "./Scene";

interface VideoCompositionProps {
  scenePlan: {
    title: string;
    scenes: Array<{
      sceneNumber: number;
      duration: number;
      narrationText: string;
      backgroundColor: string;
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
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ scenePlan }) => {
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
            <SceneComponent scene={scene} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

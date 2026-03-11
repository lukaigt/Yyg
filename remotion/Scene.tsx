import React from "react";
import { AbsoluteFill } from "remotion";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { AnimatedAsset } from "./components/AnimatedAsset";
import { AnimatedText } from "./components/AnimatedText";
import { AnimatedOverlay } from "./components/AnimatedOverlay";
import { SceneTransition } from "./components/SceneTransition";
import { SubtitleOverlay } from "./components/SubtitleOverlay";

interface SceneProps {
  scene: {
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
  };
  showCaptions?: boolean;
  captionSize?: "small" | "medium" | "large";
  durationInFrames: number;
}

export const SceneComponent: React.FC<SceneProps> = ({ scene, durationInFrames, showCaptions = true, captionSize = "medium" }) => {
  return (
    <SceneTransition type={scene.transition} durationFrames={durationInFrames}>
      <AbsoluteFill>
        <BackgroundLayer color={scene.backgroundColor} />

        {scene.elements.map((element, i) => {
          if (!element.resolvedSrc) return null;
          const isVideo = element.resolvedSrc.endsWith(".mp4") || element.resolvedSrc.endsWith(".webm");
          return (
            <AnimatedAsset
              key={`asset-${i}`}
              src={element.resolvedSrc}
              motion={element.motion}
              position={element.position}
              scale={element.scale}
              delay={element.delay}
              duration={element.duration}
              isVideo={isVideo}
            />
          );
        })}

        {scene.textOverlays.map((overlay, i) => (
          <AnimatedText
            key={`text-${i}`}
            text={overlay.text}
            position={overlay.position}
            fontSize={overlay.fontSize}
            animation={overlay.animation}
            color={overlay.color}
            delay={overlay.delay}
          />
        ))}

        {showCaptions && scene.narrationText && (
          <SubtitleOverlay text={scene.narrationText} size={captionSize} sceneDurationInFrames={durationInFrames} />
        )}

      </AbsoluteFill>
    </SceneTransition>
  );
};

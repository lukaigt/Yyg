import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface SceneTransitionProps {
  type: string;
  durationFrames: number;
  children: React.ReactNode;
}

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  type,
  durationFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const transitionDuration = Math.min(durationFrames, Math.round(fps * 0.5));

  const enterProgress = interpolate(frame, [0, transitionDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitStart = durationFrames - transitionDuration;
  const exitProgress = interpolate(frame, [exitStart, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let opacity = 1;
  let transform = "none";

  switch (type) {
    case "crossfade":
      opacity = frame < transitionDuration ? enterProgress : frame > exitStart ? exitProgress : 1;
      break;
    case "wipeLeft":
      const clipEnter = interpolate(enterProgress, [0, 1], [100, 0]);
      const clipExit = interpolate(exitProgress, [1, 0], [0, 100]);
      const clip = frame < transitionDuration ? clipEnter : frame > exitStart ? clipExit : 0;
      return (
        <div style={{ clipPath: `inset(0 ${clip}% 0 0)`, width: "100%", height: "100%" }}>
          {children}
        </div>
      );
    case "slideLeft":
      const slideEnterX = interpolate(enterProgress, [0, 1], [100, 0]);
      const slideExitX = interpolate(exitProgress, [1, 0], [0, -100]);
      const slideX = frame < transitionDuration ? slideEnterX : frame > exitStart ? slideExitX : 0;
      transform = `translateX(${slideX}%)`;
      break;
    case "slideUp":
      const slideEnterY = interpolate(enterProgress, [0, 1], [100, 0]);
      const slideExitY = interpolate(exitProgress, [1, 0], [0, -100]);
      const slideY = frame < transitionDuration ? slideEnterY : frame > exitStart ? slideExitY : 0;
      transform = `translateY(${slideY}%)`;
      break;
    case "zoom":
      const zoomEnter = interpolate(enterProgress, [0, 1], [1.5, 1]);
      const zoomExit = interpolate(exitProgress, [1, 0], [1, 0.5]);
      const zoomVal = frame < transitionDuration ? zoomEnter : frame > exitStart ? zoomExit : 1;
      const zoomOpacity = frame < transitionDuration ? enterProgress : frame > exitStart ? exitProgress : 1;
      transform = `scale(${zoomVal})`;
      opacity = zoomOpacity;
      break;
    default:
      opacity = frame < transitionDuration ? enterProgress : frame > exitStart ? exitProgress : 1;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
        transform,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
};

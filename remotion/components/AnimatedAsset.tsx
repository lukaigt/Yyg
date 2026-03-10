import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, OffthreadVideo } from "remotion";

interface AnimatedAssetProps {
  src: string;
  motion: string;
  position: { x: number; y: number };
  scale: number;
  delay: number;
  duration: number;
  isVideo?: boolean;
}

export const AnimatedAsset: React.FC<AnimatedAssetProps> = ({
  src,
  motion,
  position,
  scale,
  delay,
  duration,
  isVideo = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayFrames = Math.round(delay * fps);
  const adjustedFrame = Math.max(0, frame - delayFrames);
  const durationFrames = Math.round(duration * fps);

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });

  let translateX = 0;
  let translateY = 0;
  let opacity = 1;
  let scaleVal = scale;
  let rotation = 0;

  switch (motion) {
    case "slideFromLeft":
      translateX = interpolate(progress, [0, 1], [-800, 0]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "slideFromRight":
      translateX = interpolate(progress, [0, 1], [800, 0]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "slideFromTop":
      translateY = interpolate(progress, [0, 1], [-600, 0]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "slideFromBottom":
      translateY = interpolate(progress, [0, 1], [600, 0]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "bounceIn":
      scaleVal = interpolate(progress, [0, 1], [0, scale]);
      opacity = interpolate(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "fadeIn":
      opacity = interpolate(progress, [0, 1], [0, 1]);
      break;
    case "scaleIn":
      scaleVal = interpolate(progress, [0, 1], [0.3, scale]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "floatIn":
      translateY = interpolate(progress, [0, 1], [100, 0]);
      opacity = interpolate(progress, [0, 1], [0, 1]);
      const floatOffset = Math.sin((adjustedFrame / fps) * 2) * 5;
      if (progress > 0.8) translateY += floatOffset;
      break;
    case "spinIn":
      rotation = interpolate(progress, [0, 1], [360, 0]);
      scaleVal = interpolate(progress, [0, 1], [0, scale]);
      opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    default:
      opacity = interpolate(progress, [0, 1], [0, 1]);
  }

  if (frame < delayFrames) {
    opacity = 0;
  }

  const idleProgress = Math.max(0, adjustedFrame - durationFrames * 0.5) / fps;
  const gentleFloat = Math.sin(idleProgress * 1.5) * 3;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY + gentleFloat}px) scale(${scaleVal}) rotate(${rotation}deg)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {isVideo ? (
        <OffthreadVideo
          src={src}
          style={{
            maxWidth: 400,
            maxHeight: 350,
            objectFit: "contain",
          }}
          muted
        />
      ) : (
        <Img
          src={src}
          style={{
            maxWidth: 400,
            maxHeight: 350,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
};

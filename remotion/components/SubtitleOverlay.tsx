import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface SubtitleOverlayProps {
  text: string;
  size: "small" | "medium" | "large";
  sceneDurationInFrames: number;
}

const FONT_SIZES: Record<string, number> = {
  small: 28,
  medium: 36,
  large: 48,
};

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ text, size, sceneDurationInFrames }) => {
  const frame = useCurrentFrame();
  const durationInFrames = sceneDurationInFrames;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const fontSize = FONT_SIZES[size] || FONT_SIZES.medium;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationInFrames - 15), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  const framesPerWord = Math.max(1, Math.floor(durationInFrames / words.length));
  const visibleWordCount = Math.min(words.length, Math.floor(frame / framesPerWord) + 1);
  const visibleText = words.slice(0, visibleWordCount).join(" ");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.7)",
          borderRadius: 8,
          padding: "12px 28px",
          maxWidth: "80%",
        }}
      >
        <p
          style={{
            color: "#ffffff",
            fontSize,
            fontFamily: "Inter, Arial, sans-serif",
            fontWeight: 600,
            textAlign: "center",
            margin: 0,
            lineHeight: 1.4,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {visibleText}
        </p>
      </div>
    </div>
  );
};

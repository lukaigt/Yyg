import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface ProgressBarProps {
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ color = "#7c4dff" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = (frame / Math.max(durationInFrames - 1, 1)) * 100;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: 4,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          backgroundColor: color,
          borderRadius: "0 2px 2px 0",
          transition: "none",
        }}
      />
    </div>
  );
};

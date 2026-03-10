import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface AnimatedOverlayProps {
  type: "lowerThird" | "stepIndicator" | "callout";
  text: string;
  number?: number;
  delay: number;
  color?: string;
}

export const AnimatedOverlay: React.FC<AnimatedOverlayProps> = ({
  type,
  text,
  number,
  delay,
  color = "#7c5cfc",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayFrames = Math.round(delay * fps);
  const adjustedFrame = Math.max(0, frame - delayFrames);

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });

  if (frame < delayFrames) return null;

  switch (type) {
    case "lowerThird":
      return (
        <div
          style={{
            position: "absolute",
            bottom: "12%",
            left: 0,
            transform: `translateX(${interpolate(progress, [0, 1], [-100, 0])}%)`,
            opacity: interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              padding: "14px 32px 14px 24px",
              borderRadius: "0 8px 8px 0",
              color: "white",
              fontSize: 24,
              fontWeight: 600,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            {text}
          </div>
        </div>
      );

    case "stepIndicator":
      return (
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "5%",
            transform: `scale(${interpolate(progress, [0, 1], [0, 1])})`,
            opacity: interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {number}
            </div>
            <div
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              {text}
            </div>
          </div>
        </div>
      );

    case "callout":
      return (
        <div
          style={{
            position: "absolute",
            right: "5%",
            top: "50%",
            transform: `translateY(-50%) scale(${interpolate(progress, [0, 1], [0.5, 1])})`,
            opacity: interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              border: `2px solid ${color}`,
              borderRadius: 12,
              padding: "16px 24px",
              color: "white",
              fontSize: 18,
              fontWeight: 500,
              maxWidth: 300,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {text}
          </div>
        </div>
      );

    default:
      return null;
  }
};

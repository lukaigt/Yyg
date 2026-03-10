import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface AnimatedTextProps {
  text: string;
  position: string;
  fontSize: number;
  animation: string;
  color: string;
  delay: number;
}

const positionStyles: Record<string, React.CSSProperties> = {
  top: { top: "8%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  center: { top: "45%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" },
  bottom: { bottom: "10%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  topLeft: { top: "8%", left: "5%", textAlign: "left" },
  topRight: { top: "8%", right: "5%", textAlign: "right" },
  bottomLeft: { bottom: "10%", left: "5%", textAlign: "left" },
  bottomRight: { bottom: "10%", right: "5%", textAlign: "right" },
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  position,
  fontSize,
  animation,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delayFrames = Math.round(delay * fps);
  const adjustedFrame = Math.max(0, frame - delayFrames);

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.6 },
  });

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;
  let scaleVal = 1;
  let displayText = text;

  if (frame < delayFrames) {
    opacity = 0;
  } else {
    switch (animation) {
      case "fadeIn":
        opacity = interpolate(progress, [0, 1], [0, 1]);
        break;
      case "slideIn":
        translateY = interpolate(progress, [0, 1], [60, 0]);
        opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
        break;
      case "typewriter": {
        const charsToShow = Math.floor(interpolate(progress, [0, 1], [0, text.length]));
        displayText = text.substring(0, charsToShow);
        opacity = 1;
        break;
      }
      case "bounceIn":
        scaleVal = interpolate(progress, [0, 1], [0.3, 1]);
        translateY = interpolate(progress, [0, 1], [-40, 0]);
        opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
        break;
      case "scaleIn":
        scaleVal = interpolate(progress, [0, 1], [0, 1]);
        opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
        break;
      default:
        opacity = interpolate(progress, [0, 1], [0, 1]);
    }
  }

  const posStyle = positionStyles[position] || positionStyles.center;

  return (
    <div
      style={{
        position: "absolute",
        ...posStyle,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color,
          textShadow: "0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          maxWidth: "80vw",
          transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scaleVal})`,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {displayText}
      </div>
    </div>
  );
};

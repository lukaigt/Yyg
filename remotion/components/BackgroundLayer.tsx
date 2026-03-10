import React from "react";
import { Img } from "remotion";

interface BackgroundLayerProps {
  color: string;
  imageSrc?: string;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  color,
  imageSrc,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: color,
      }}
    >
      {imageSrc && (
        <Img
          src={imageSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
          }}
        />
      )}
    </div>
  );
};

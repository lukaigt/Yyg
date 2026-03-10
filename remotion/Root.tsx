import React from "react";
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";

const defaultScenePlan = {
  title: "Sample Video",
  scenes: [
    {
      sceneNumber: 1,
      duration: 3,
      narrationText: "Welcome",
      backgroundColor: "#1a1a2e",
      textOverlays: [
        {
          text: "Welcome to VideoForge",
          position: "center",
          fontSize: 56,
          animation: "bounceIn",
          color: "#ffffff",
          delay: 0.3,
        },
      ],
      elements: [],
      transition: "crossfade",
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenePlan: defaultScenePlan,
        }}
      />
    </>
  );
};

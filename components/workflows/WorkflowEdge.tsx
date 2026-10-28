"use client";

import { memo, type CSSProperties } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

/** Moving highlights are reserved for an execution that is actually running. */
export const WorkflowEdge = memo(function WorkflowEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath({ ...props, borderRadius: 28, offset: 32 });
  const running = props.data?.running === true;
  const muted = props.data?.muted === true;
  const phase =
    [...props.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8;
  return (
    <g
      className={`wf-flow-edge ${running ? "is-running" : ""} ${muted ? "is-muted" : ""}`}
    >
      <path d={path} fill="none" className="wf-edge-halo" aria-hidden="true" />
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
        style={props.style}
      />
      {running && !muted && (
        <circle
          r={running ? 3.2 : 2.4}
          className="wf-edge-traveler"
          style={
            {
              offsetPath: `path('${path}')`,
              animationDuration: running ? "1.8s" : "8s",
              animationDelay: `-${phase}s`,
            } as CSSProperties
          }
          aria-hidden="true"
          pointerEvents="none"
        />
      )}
    </g>
  );
});

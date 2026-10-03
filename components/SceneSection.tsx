import type { CSSProperties, ReactNode } from "react";
import { SCENES } from "@/lib/scenes";

/** A scene: a scroll range in the document with a fixed, art-directed stage. */
export function SceneSection({
  index,
  label,
  children,
  stageClassName = "",
  flow,
}: {
  index: number;
  label: string;
  children: ReactNode;
  stageClassName?: string;
  /** in-flow scenes scroll their own content instead of using a fixed stage */
  flow?: ReactNode;
}) {
  const def = SCENES[index];
  const style = { "--h-d": def.vh[0], "--h-m": def.vh[1] } as CSSProperties;
  return (
    <section
      id={def.id}
      data-scene={def.id}
      data-on="0"
      aria-label={label}
      className={`scene ${def.flow ? "scene-flow" : ""}`}
      style={style}
    >
      <div className={`scene-stage ${stageClassName}`}>{children}</div>
      {flow}
    </section>
  );
}

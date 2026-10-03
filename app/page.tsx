import { Experience } from "@/components/Experience";
import { Loader } from "@/components/Loader";
import { BackType } from "@/components/BackType";
import { Hud } from "@/components/Hud";
import { Cursor } from "@/components/Cursor";
import { Dialogs } from "@/components/dialogs/Dialogs";
import { Debug } from "@/components/Debug";
import { Reveal } from "@/components/scenes/Reveal";
import { Mass } from "@/components/scenes/Mass";
import { Aero } from "@/components/scenes/Aero";
import { Exploded } from "@/components/scenes/Exploded";
import { Power } from "@/components/scenes/Power";
import { Interface } from "@/components/scenes/Interface";
import { Materials } from "@/components/scenes/Materials";
import { Motion } from "@/components/scenes/Motion";
import { Ninety } from "@/components/scenes/Ninety";
import { Final } from "@/components/scenes/Final";

export default function Home() {
  return (
    <Experience>
      <BackType />
      <Hud />
      <main className="layer-content">
        <Reveal />
        <Mass />
        <Aero />
        <Exploded />
        <Power />
        <Interface />
        <Materials />
        <Motion />
        <Ninety />
        <Final />
      </main>
      <Cursor />
      <Dialogs />
      <Debug />
      <Loader />
    </Experience>
  );
}

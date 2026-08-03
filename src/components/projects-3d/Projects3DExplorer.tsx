import {
  useMemo,
  useRef,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
} from "@react-three/drei";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { Project } from "../../types";
import { NextActionItem } from "../ProjectNextActionsDrawer";
import ProjectPlanet from "./ProjectPlanet";
import { getProjectPosition } from "./sceneLayout";

interface ProjectCluster extends Project {
  project_title?: string;
  reports?: any[];
}

interface Projects3DExplorerProps {
  projects: ProjectCluster[];
  nextActions: NextActionItem[];

  onOpenActions: (
    project: Project,
  ) => void;

  onOpenReports: (
    project: ProjectCluster,
  ) => void;
}

export default function Projects3DExplorer({
  projects,
  nextActions,
  onOpenActions,
  onOpenReports,
}: Projects3DExplorerProps) {
  const controlsRef =
    useRef<OrbitControlsImpl | null>(null);

  const sceneProjects = useMemo(
    () =>
      projects.map((project, index) => ({
        project,
        position: getProjectPosition(index),

        actions: nextActions.filter(
          (action) =>
            action.project?.id === project.id,
        ),
      })),
    [projects, nextActions],
  );

  return (
    <div className="relative h-[76vh] min-h-[620px] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* راهنما و Reset */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 dir-rtl">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-right text-white shadow-xl backdrop-blur-md">
          <p className="text-xs font-black text-amber-400">
            دنیای سه‌بعدی پروژه‌ها
          </p>

          <p className="mt-1 text-[10px] leading-5 text-slate-300">
            چرخ ماوس: زوم
            <br />
            کشیدن با دکمه چپ: چرخش
            <br />
            کشیدن با دکمه راست: جابه‌جایی
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            controlsRef.current?.reset()
          }
          className="pointer-events-auto rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          بازنشانی دوربین
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">
          پروژه‌ای برای نمایش وجود ندارد.
        </div>
      ) : (
        <Canvas
          camera={{
            position: [0, 13, 34],
            fov: 48,
            near: 0.1,
            far: 220,
          }}
          dpr={[1, 1.7]}
          gl={{
            antialias: true,
            powerPreference:
              "high-performance",
          }}
          fallback={
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-300">
              مرورگر یا کارت گرافیک این دستگاه
              از WebGL پشتیبانی نمی‌کند.
            </div>
          }
        >
          <color
            attach="background"
            args={["#020617"]}
          />

          <fog
            attach="fog"
            args={["#020617", 28, 105]}
          />

          <ambientLight intensity={0.78} />

          <directionalLight
            position={[12, 18, 10]}
            intensity={2}
            color="#ffffff"
          />

          <pointLight
            position={[-18, 6, -10]}
            intensity={85}
            distance={65}
            color="#0ea5e9"
          />

          <pointLight
            position={[16, -4, 14]}
            intensity={70}
            distance={55}
            color="#f59e0b"
          />

          <Stars
            radius={100}
            depth={48}
            count={1700}
            factor={3}
            saturation={0}
            fade
            speed={0.35}
          />

          {sceneProjects.map(
            ({
              project,
              position,
              actions,
            }) => (
              <ProjectPlanet
                key={project.id}
                project={project}
                actions={actions}
                position={position}
                onOpenActions={
                  onOpenActions
                }
                onOpenReports={
                  onOpenReports
                }
              />
            ),
          )}

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableRotate
            enableZoom
            enablePan
            enableDamping
            dampingFactor={0.065}
            rotateSpeed={0.55}
            panSpeed={0.75}
            zoomSpeed={0.8}
            minDistance={7}
            maxDistance={105}
            zoomToCursor
          />
        </Canvas>
      )}
    </div>
  );
}
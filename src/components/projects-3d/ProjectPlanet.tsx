import {
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import type { Group } from "three";

import { Project } from "../../types";
import { NextActionItem } from "../ProjectNextActionsDrawer";
import {
  getProjectPlanetRadius,
  Position3D,
} from "./sceneLayout";

interface ProjectPlanetProps {
  project: Project & {
    reports?: any[];
  };

  actions: NextActionItem[];
  position: Position3D;

  onOpenActions: (project: Project) => void;
  onOpenReports: (project: Project & {
    reports?: any[];
  }) => void;
}

interface ActionOrbitProps {
  actions: NextActionItem[];
  ringIndex: number;
  planetRadius: number;
  onOpenActions: () => void;
}

const ACTIONS_PER_RING = 15;

function getActionColor(
  action: NextActionItem,
): string {
  if (action.is_completed) {
    return "#10b981";
  }

  if (!action.target_date) {
    return "#64748b";
  }

  const targetTime =
    new Date(action.target_date).getTime();

  if (Date.now() > targetTime) {
    return "#e11d48";
  }

  return "#0ea5e9";
}

function ActionOrbit({
  actions,
  ringIndex,
  planetRadius,
  onOpenActions,
}: ActionOrbitProps) {
  const orbitRef = useRef<Group>(null);
  const [hoveredActionId, setHoveredActionId] =
    useState<number | null>(null);

  const orbitRadius =
    planetRadius + 1.25 + ringIndex * 1.05;

  useFrame((_, delta) => {
    if (!orbitRef.current) return;

    const direction =
      ringIndex % 2 === 0 ? 1 : -1;

    orbitRef.current.rotation.z +=
      delta *
      (0.045 + ringIndex * 0.012) *
      direction;
  });

  return (
    <group
      ref={orbitRef}
      rotation={[
        Math.PI / 2.7 + ringIndex * 0.2,
        ringIndex * 0.65,
        0,
      ]}
    >
      {/* خط مدار */}
      <mesh>
        <torusGeometry
          args={[orbitRadius, 0.012, 8, 128]}
        />

        <meshBasicMaterial
          color="#94a3b8"
          transparent
          opacity={0.28}
        />
      </mesh>

      {/* ماهواره‌های اقدامات آتی */}
      {actions.map((action, index) => {
        const angle =
          (index / Math.max(actions.length, 1)) *
          Math.PI *
          2;

        const x =
          Math.cos(angle) * orbitRadius;

        const y =
          Math.sin(angle) * orbitRadius;

        const color = getActionColor(action);

        const isHovered =
          hoveredActionId === action.id;

        return (
          <mesh
            key={action.id}
            position={[x, y, 0]}
            scale={isHovered ? 1.45 : 1}
            onPointerEnter={(event) => {
              event.stopPropagation();

              setHoveredActionId(action.id);

              document.body.style.cursor =
                "pointer";
            }}
            onPointerLeave={() => {
              setHoveredActionId(null);

              document.body.style.cursor =
                "default";
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenActions();
            }}
          >
            <sphereGeometry args={[0.18, 18, 18]} />

            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={
                isHovered ? 1 : 0.35
              }
              roughness={0.35}
              metalness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ProjectPlanet({
  project,
  actions,
  position,
  onOpenActions,
  onOpenReports,
}: ProjectPlanetProps) {
  const [hovered, setHovered] =
    useState(false);

  const reportsCount =
    project.reports?.length || 0;

  const hasLateReports =
    project.reports?.some(
      (report: any) =>
        report.status === "late",
    ) || false;

  const planetRadius =
    getProjectPlanetRadius(
      reportsCount,
      actions.length,
    );

  const actionRings = useMemo(() => {
    const rings: NextActionItem[][] = [];

    for (
      let start = 0;
      start < actions.length;
      start += ACTIONS_PER_RING
    ) {
      rings.push(
        actions.slice(
          start,
          start + ACTIONS_PER_RING,
        ),
      );
    }

    return rings;
  }, [actions]);

  const planetColor =
    hasLateReports || reportsCount === 0
      ? "#d97706"
      : "#059669";

  return (
    <group position={position}>
      <Float
        speed={1.2}
        rotationIntensity={0.12}
        floatIntensity={0.45}
      >
        {/* مدارها و اقدامات */}
        {actionRings.map(
          (ringActions, ringIndex) => (
            <ActionOrbit
              key={`ring-${ringIndex}`}
              actions={ringActions}
              ringIndex={ringIndex}
              planetRadius={planetRadius}
              onOpenActions={() =>
                onOpenActions(project)
              }
            />
          ),
        )}

        {/* کره اصلی پروژه */}
        <mesh
          scale={hovered ? 1.08 : 1}
          onPointerEnter={(event) => {
            event.stopPropagation();
            setHovered(true);
            document.body.style.cursor =
              "pointer";
          }}
          onPointerLeave={() => {
            setHovered(false);
            document.body.style.cursor =
              "default";
          }}
          onClick={(event) => {
            event.stopPropagation();
            onOpenActions(project);
          }}
        >
          <sphereGeometry
            args={[planetRadius, 48, 48]}
          />

          <meshStandardMaterial
            color={planetColor}
            emissive={planetColor}
            emissiveIntensity={
              hovered ? 0.48 : 0.18
            }
            roughness={0.38}
            metalness={0.18}
          />
        </mesh>

        {/* عنوان فارسی و عملیات */}
        <Html
          center
          distanceFactor={10}
          position={[
            0,
            -planetRadius - 0.65,
            0,
          ]}
          style={{
            pointerEvents: "auto",
          }}
        >
          <div
            className="
              min-w-48
              max-w-64
              rounded-2xl
              border
              border-white/15
              bg-slate-950/85
              px-3
              py-2.5
              text-center
              text-white
              shadow-2xl
              backdrop-blur-md
              dir-rtl
              font-sans
            "
          >
            <p className="text-xs font-black leading-relaxed">
              {project.title}
            </p>

            <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-slate-300">
              <span>
                {reportsCount.toLocaleString(
                  "fa-IR",
                )}{" "}
                گزارش
              </span>

              <span>•</span>

              <span>
                {actions.length.toLocaleString(
                  "fa-IR",
                )}{" "}
                اقدام
              </span>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenActions(project);
                }}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
              >
                اقدامات
              </button>

              {reportsCount > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenReports(project);
                  }}
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
                >
                  گزارش‌ها
                </button>
              )}
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
}
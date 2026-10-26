---
version: alpha
colors:
  page: "#ffffff"
  surface: "#ffffff"
  ink: "#1d1d1f"
  muted: "#6e6e73"
  line: "#e8e8ed"
  accent: "#0071e3"
  accentHover: "#0062c4"
  accentSoft: "#edf5ff"
  teal: "#23756f"
typography:
  sans:
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
  mono:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
rounded:
  panel: "12px"
  button: "6px"
spacing:
  panelGap: "20px"
components:
  button:
    rounded: "6px"
---

# Robot Explorer

## Overview

A Chinese-language browser robotics workbench for 小黄黄. Product register, not a marketing landing page. The user-provided brief is the product authority; the empty repository has no preceding design or sibling workflow. The signature is an authentic yellow FANUC assembly floating above a soft near-white ground grid, with a persistent green elbow control-point annotation. Surrounding chrome stays quiet, making physical motion the focus. Avoid neon cyberpunk, dark gaming consoles, decorative charts, and invented robot telemetry.

## Colors

The runtime canonical source is `src/styles.css :root`; the exact color names above map to its same-name kebab-case CSS variables (accentHover → --accent-hover). This document records intent and reviews that source. Apple-inspired light mode, explicitly requested by 小黄黄: a white page, near-white scene, neutral deep-gray text and clear system-blue actions. Green indicates readiness/protection; amber and text indicate a workspace boundary. Never rely on color alone. Scene materials are physical object colors, not interface tokens.

## Typography

System sans with Chinese fallbacks provides offline reliability. Headings are restrained at 21–27px, interface controls 11–14px, secondary technical annotations 9–11px. Monospaced positions, angles, units, and model identifiers use `--font-mono` and tabular figures. Stable local fonts avoid late layout shifts. All owned interface copy and accessibility names are zh-CN; model names and XYZ conventions stay technical.

## Layout

Desktop: 80px header, flexible 3D viewport plus 322px right inspector, 20px gap. At 800px the scene stacks above a two-column inspector; below 480px controls and telemetry stack. The document owns scrolling. The viewport retains a stable minimum height while loading or recovering. The inspector is never trapped in a fixed-height scroller.

## Elevation & Depth

Panels have hairline gray borders and a nearly invisible shadow. Only scene controls, selected segments, keycaps and dialogs use meaningful elevation. Object shading and a grounded shadow provide depth; no decorative gradients.

## Shapes

12px panels, 6px action controls, compact rounded keycaps. Blue is reserved for active motion controls. The avatar uses a soft neutral to greet the project's owner without competing with the robot.

## Components

Buttons and mode/view segments are native buttons with pressed, hover, disabled and visible focus states. All d-pad keys are 44px or greater on touch layouts. The native range owns speed input. Native dialog owns focus trapping, Escape and focus restoration; shared dialog styling lives in styles.css. Persistent status is the shared feedback surface, with a live inline protection/boundary message. `useRobotInput.ts` owns held-key and pointer lifetimes. `Scene.tsx` owns load/retry/render/cleanup and view manipulation. `robot.ts` owns URDF transforms and constrained motion. Global scrollbar tokens are inherited automatically, with hover/active and forced-color fallbacks.

## Do's and Don'ts

- Keep Z-up world coordinates independent of camera angle.
- Identify the elbow as the first upper-arm endpoint (J3 origin), never promise free translation of a fixed-length link.
- Keep base position fixed. Default to elbow control; provide an explicit end-effector mode.
- Stop on release, blur, hidden document, input focus, dialogs and pause; never accumulate unreachable targets.
- Loading is measured by one URDF plus seven actual mesh files. Errors retain a retry action.
- Provide button alternatives to drag and wheel view actions.
- Respect reduced motion and keep functional robot motion directly tied to input.
- Never imply hardware connection, collision protection or manufacturer endorsement.

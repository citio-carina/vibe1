import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  RobotRig,
  MODEL_URL,
  directionForKeys,
  type ControlMode,
} from "./robot";

export type Telemetry = {
  position: number[];
  tool: number[];
  angles: number[];
  boundary: boolean;
  moving: boolean;
};
export type SceneApi = {
  reset: () => void;
  view: (type: string) => void;
  orbit: (angle: number) => void;
  zoom: (factor: number) => void;
};
type Props = {
  settings: MutableRefObject<{
    mode: ControlMode;
    speed: number;
    grid: boolean;
    axes: boolean;
    paused: boolean;
  }>;
  keys: MutableRefObject<Set<string>>;
  onTelemetry: (data: Telemetry) => void;
  onProgress: (progress: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
  api: MutableRefObject<SceneApi | null>;
  attempt: number;
};

export default function Scene({
  settings,
  keys,
  onTelemetry,
  onProgress,
  onReady,
  onError,
  api,
  attempt,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    label = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onError("无法启动 3D 场景，请启用浏览器硬件加速后重试。");
      return;
    }
    let disposed = false,
      frame = 0,
      needsRender = true,
      rig: RobotRig | null = null;
    const abort = new AbortController();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor("#f5f5f7");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      "aria-label",
      "FANUC 机械臂三维视图，可使用下方视角按钮或鼠标拖动观察",
    );
    renderer.domElement.setAttribute("role", "img");
    container.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#f5f5f7", 10, 24);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    controls.dampingFactor = 0.09;
    controls.minDistance = 2.3;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    const defaultView = () => {
      camera.position.set(3.1, -4.3, 2.6);
      controls.target.set(0.65, 0, 0.95);
      controls.update();
    };
    defaultView();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x687789, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 3.4);
    sun.position.set(2, -3, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#bfd4ee", 1.2);
    fill.position.set(-4, 3, 3);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: "#f5f5f7", roughness: 0.95 }),
    );
    floor.position.z = -0.025;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(18, 60, "#c5c7cd", "#e2e3e7");
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.018;
    scene.add(grid);
    const circlePoints = Array.from(
      { length: 129 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 128) * Math.PI * 2) * 2.15,
          Math.sin((i / 128) * Math.PI * 2) * 2.15,
          -0.01,
        ),
    );
    const circle = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(circlePoints),
      new THREE.LineDashedMaterial({
        color: "#c0c4cc",
        dashSize: 0.05,
        gapSize: 0.045,
      }),
    );
    circle.computeLineDistances();
    scene.add(circle);
    const axes = new THREE.AxesHelper(0.6);
    axes.position.set(-0.7, -0.65, 0);
    scene.add(axes);
    const point = new THREE.Group();
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.037, 20, 20),
      new THREE.MeshBasicMaterial({ color: "#1d817a", depthTest: false }),
    );
    dot.renderOrder = 10;
    point.add(dot);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.004, 8, 64),
      new THREE.MeshBasicMaterial({
        color: "#1d817a",
        depthTest: false,
        transparent: true,
        opacity: 0.7,
      }),
    );
    ring.renderOrder = 10;
    point.add(ring);
    point.visible = false;
    scene.add(point);
    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        needsRender = true;
      }
    });
    observer.observe(container);
    const contextLost = (e: Event) => {
      e.preventDefault();
      keys.current.clear();
      onError("3D 上下文已中断，请点击重试重新加载场景。");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    const fetchResource = async (url: string, binary = false) => {
      const result = await fetch(url, {
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
      });
      if (!result.ok) throw new Error(`模型文件加载失败（${result.status}）`);
      return binary ? result.arrayBuffer() : result.text();
    };
    async function load() {
      const pendingGeometries: THREE.BufferGeometry[] = [];
      try {
        const xml = (await fetchResource(MODEL_URL)) as string;
        if (disposed) return;
        const model = new RobotRig(xml);
        onProgress((1 / (model.visuals.length + 1)) * 100);
        let loaded = 1;
        await Promise.all(
          model.visuals.map(async (visual) => {
            const buffer = (await fetchResource(
              new URL(visual.file, new URL(MODEL_URL, window.location.href))
                .href,
              true,
            )) as ArrayBuffer;
            if (disposed) return;
            const geometry = new STLLoader().parse(buffer);
            geometry.computeVertexNormals();
            pendingGeometries.push(geometry);
            const material = new THREE.MeshStandardMaterial({
              color: visual.color,
              metalness: 0.22,
              roughness: 0.39,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.set(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
            mesh.rotation.set(
              visual.rpy[0],
              visual.rpy[1],
              visual.rpy[2],
              "ZYX",
            );
            visual.link.add(mesh);
            onProgress((++loaded / (model.visuals.length + 1)) * 100);
          }),
        );
        if (disposed) {
          model.root.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry.dispose();
              (obj.material as THREE.Material).dispose();
            }
          });
          return;
        }
        rig = model;
        scene.add(rig.root);
        point.visible = true;
        needsRender = true;
        renderer.shadowMap.needsUpdate = true;
        onReady();
      } catch (error) {
        if (!disposed) {
          abort.abort();
          pendingGeometries.forEach((g) => g.dispose());
          onError(
            error instanceof Error ? error.message : "模型加载失败，请重试。",
          );
        }
      }
    }
    void load();
    api.current = {
      reset: () => {
        keys.current.clear();
        rig?.setAngles([0, -0.45, -0.25, 0, -0.7, 0]);
        needsRender = true;
        renderer.shadowMap.needsUpdate = true;
      },
      view: (type) => {
        controls.target.set(0.65, 0, 0.95);
        if (type === "front") camera.position.set(0.65, -7, 1.2);
        else if (type === "top") camera.position.set(0.65, -0.001, 7);
        else defaultView();
        controls.update();
        needsRender = true;
      },
      orbit: (angle) => {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        needsRender = true;
      },
      zoom: (factor) => {
        const offset = camera.position.clone().sub(controls.target);
        offset
          .multiplyScalar(factor)
          .clampLength(controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        needsRender = true;
      },
    };
    let previous = performance.now(),
      lastPublish = 0,
      lastMode = settings.current.mode;
    function animate(now: number) {
      if (disposed) return;
      const dt = Math.min((now - previous) / 1000, 0.5);
      previous = now;
      const prefs = settings.current;
      if (lastMode !== prefs.mode) {
        needsRender = true;
        lastMode = prefs.mode;
      }
      let boundary = false;
      const direction = directionForKeys(keys.current);
      const moving = !prefs.paused && direction.lengthSq() > 0;
      if (rig) {
        if (moving) {
          const steps = Math.max(1, Math.ceil(dt / 0.025));
          for (let i = 0; i < steps; i++) {
            if (!rig.move(prefs.mode, direction, prefs.speed, dt / steps)) {
              boundary = true;
              break;
            }
          }
          needsRender = true;
          renderer.shadowMap.needsUpdate = true;
        }
        point.position.copy(rig.point(prefs.mode));
        ring.quaternion.copy(camera.quaternion);
        const p = point.position.clone().project(camera);
        if (label.current) {
          label.current.style.transform = `translate(${((p.x + 1) / 2) * container.clientWidth}px, ${((-p.y + 1) / 2) * container.clientHeight}px)`;
          label.current.style.visibility =
            p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1
              ? "hidden"
              : "visible";
        }
        if (now - lastPublish > 65) {
          onTelemetry({
            position: rig.point(prefs.mode).toArray(),
            tool: rig.point("tool").toArray(),
            angles: rig.angles.map((a) => (a * 180) / Math.PI),
            boundary,
            moving: moving && !boundary,
          });
          lastPublish = now;
        }
      }
      if (grid.visible !== prefs.grid || axes.visible !== prefs.axes)
        needsRender = true;
      grid.visible = prefs.grid;
      circle.visible = prefs.grid;
      axes.visible = prefs.axes;
      if (controls.update() || needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      api.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.LineSegments
        ) {
          object.geometry.dispose();
          const mats = Array.isArray(object.material)
            ? object.material
            : [object.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [attempt, api, keys, settings, onTelemetry, onProgress, onReady, onError]);

  return (
    <div className="three-host" ref={host}>
      <div ref={label} className="control-point-label">
        <span>
          {settings.current.mode === "elbow" ? "肘部控制点" : "末端控制点"}
        </span>
      </div>
    </div>
  );
}

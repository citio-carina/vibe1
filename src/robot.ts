import { XMLParser } from "fast-xml-parser";
import { Group, Vector3, Quaternion, Euler, Matrix3, MathUtils } from "three";

export type ControlMode = "elbow" | "tool";
export type Joint = {
  name: string;
  node: Group;
  origin: Quaternion;
  axis: Vector3;
  min: number;
  max: number;
  velocity: number;
};
export type Visual = {
  link: Group;
  file: string;
  color: string;
  xyz: number[];
  rpy: number[];
};
export const HOME = [0, -0.45, -0.25, 0, -0.7, 0];
export const MODEL_URL = "models/fanuc-r1000ia80f/robot.urdf";
const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const numbers = (value?: string) => (value ?? "0 0 0").split(/\s+/).map(Number);
type RawLink = {
  name: string;
  visual?: {
    origin?: { xyz?: string; rpy?: string };
    geometry: { mesh: { filename: string } };
    material?: { color?: { rgba: string } };
  };
};
type RawJoint = {
  name: string;
  type: string;
  parent: { link: string };
  child: { link: string };
  origin?: { xyz?: string; rpy?: string };
  axis?: { xyz: string };
  limit?: { lower: number; upper: number; velocity: number };
};

/** URDF is the single source of geometry transforms, joint axes and limits. */
export class RobotRig {
  root = new Group();
  links = new Map<string, Group>();
  joints: Joint[] = [];
  visuals: Visual[] = [];
  angles = [...HOME];

  constructor(xml: string) {
    const robot = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    }).parse(xml).robot;
    if (!robot?.link || !robot?.joint) throw new Error("模型结构不完整");
    for (const link of list<RawLink>(robot.link)) {
      const group = new Group();
      group.name = link.name;
      this.links.set(link.name, group);
      for (const visual of list(link.visual)) {
        const rgb = numbers(visual.material?.color?.rgba ?? "0.98 0.69 0.06 1");
        this.visuals.push({
          link: group,
          file: visual.geometry.mesh.filename,
          color: `rgb(${rgb
            .slice(0, 3)
            .map((v) => Math.round(v * 255))
            .join(",")})`,
          xyz: numbers(visual.origin?.xyz),
          rpy: numbers(visual.origin?.rpy),
        });
      }
    }
    const children = new Set<string>();
    for (const joint of list<RawJoint>(robot.joint)) {
      const node = new Group();
      node.name = joint.name;
      const p = numbers(joint.origin?.xyz);
      node.position.set(p[0], p[1], p[2]);
      const r = numbers(joint.origin?.rpy);
      node.quaternion.setFromEuler(new Euler(r[0], r[1], r[2], "ZYX"));
      this.links.get(joint.parent.link)!.add(node);
      node.add(this.links.get(joint.child.link)!);
      children.add(joint.child.link);
      if (joint.type === "revolute")
        this.joints.push({
          name: joint.name,
          node,
          origin: node.quaternion.clone(),
          axis: new Vector3(...numbers(joint.axis?.xyz)).normalize(),
          min: Number(joint.limit!.lower),
          max: Number(joint.limit!.upper),
          velocity: Number(joint.limit!.velocity),
        });
    }
    this.links.forEach((group, name) => {
      if (!children.has(name)) this.root.add(group);
    });
    this.setAngles(HOME);
  }

  setAngles(angles: number[]) {
    this.angles = this.joints.map((joint, i) =>
      MathUtils.clamp(angles[i], joint.min, joint.max),
    );
    this.joints.forEach((joint, i) =>
      joint.node.quaternion
        .copy(joint.origin)
        .multiply(
          new Quaternion().setFromAxisAngle(joint.axis, this.angles[i]),
        ),
    );
    this.root.updateMatrixWorld(true);
  }

  point(mode: ControlMode) {
    return this.links
      .get(mode === "elbow" ? "link_3" : "tool0")!
      .getWorldPosition(new Vector3());
  }

  /** Position-only damped least squares IK. No unbounded targets accumulate at limits. */
  move(
    mode: ControlMode,
    direction: Vector3,
    speed: number,
    dt: number,
  ): boolean {
    if (direction.lengthSq() === 0 || dt <= 0) return true;
    const duration = Math.min(dt, 0.05);
    const start = this.point(mode),
      before = [...this.angles];
    const delta = direction
      .clone()
      .normalize()
      .multiplyScalar(speed * duration);
    const target = start.clone().add(delta);
    if (mode === "elbow") {
      // A rigid upper arm traces a circle, not an arbitrary Cartesian plane.
      const shoulder = this.links
        .get("link_2")!
        .getWorldPosition(new Vector3());
      const angle = Math.atan2(target.x - shoulder.x, target.z - shoulder.z);
      const max = this.joints[1].velocity * duration;
      const next = [...before];
      next[1] += MathUtils.clamp(angle - before[1], -max, max);
      this.setAngles(next);
      if (
        this.point(mode).clone().sub(start).dot(delta) <=
        delta.lengthSq() * 0.0001
      ) {
        this.setAngles(before);
        return false;
      }
      return true;
    }
    const count = 5;
    for (let iteration = 0; iteration < 18; iteration++) {
      const point = this.point(mode),
        error = target.clone().sub(point);
      if (error.length() < 0.00001) break;
      const jacobian = this.joints.slice(0, count).map((j) => {
        const pivot = j.node.getWorldPosition(new Vector3());
        const axis = j.axis
          .clone()
          .applyQuaternion(j.node.getWorldQuaternion(new Quaternion()));
        return axis.cross(point.clone().sub(pivot));
      });
      const m = new Matrix3().set(0.001, 0, 0, 0, 0.001, 0, 0, 0, 0.001);
      for (const j of jacobian) {
        const a = j.toArray();
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++)
            m.elements[col * 3 + row] += a[row] * a[col];
      }
      const step = error.applyMatrix3(m.invert());
      const next = [...this.angles];
      jacobian.forEach((j, i) => {
        const max = this.joints[i].velocity * duration;
        next[i] = MathUtils.clamp(
          next[i] + MathUtils.clamp(j.dot(step), -0.025, 0.025),
          before[i] - max,
          before[i] + max,
        );
      });
      this.setAngles(next);
    }
    const end = this.point(mode);
    if (
      end.distanceTo(target) > Math.max(0.00008, delta.length() * 0.08) ||
      end.z < 0.12
    ) {
      this.setAngles(before);
      return false;
    }
    return true;
  }
}

export function directionForKeys(keys: Set<string>): Vector3 {
  return new Vector3(
    Number(keys.has("d")) - Number(keys.has("a")),
    0,
    Number(keys.has("w")) - Number(keys.has("s")),
  ).normalize();
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest(
        'input, textarea, select, [role="slider"], dialog[open]',
      ))
  );
}

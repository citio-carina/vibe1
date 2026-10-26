import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { RobotRig, HOME, directionForKeys } from "../src/robot";
const xml = readFileSync(
  new URL("../public/models/fanuc-r1000ia80f/robot.urdf", import.meta.url),
  "utf8",
);
const rig = () => new RobotRig(xml);
describe("URDF and robot kinematics", () => {
  it("loads all six authentic joint axes and limits from the URDF", () => {
    const r = rig();
    expect(r.joints).toHaveLength(6);
    expect(r.visuals).toHaveLength(7);
    expect(r.joints[1].max).toBe(2.7052);
    expect(r.joints[2].axis.toArray()).toEqual([0, -1, 0]);
  });
  it("matches known zero-pose world geometry", () => {
    const r = rig();
    r.setAngles([0, 0, 0, 0, 0, 0]);
    expect(r.point("elbow").toArray()).toEqual([0.32, 0, 1.32]);
    expect(r.point("tool").x).toBeCloseTo(1.51);
    expect(r.point("tool").z).toBeCloseTo(1.545);
  });
  it.each([
    ["w", 2, 1],
    ["s", 2, -1],
    ["a", 0, -1],
    ["d", 0, 1],
  ] as const)(
    "elbow %s moves in the requested world direction without moving the base",
    (key, index, sign) => {
      const r = rig(),
        before = r.point("elbow");
      for (let i = 0; i < 30; i++)
        r.move("elbow", directionForKeys(new Set([key])), 0.2, 1 / 60);
      expect(
        (r.point("elbow").getComponent(index) - before.getComponent(index)) *
          sign,
      ).toBeGreaterThan(0.01);
      expect(r.root.position.toArray()).toEqual([0, 0, 0]);
      expect(r.angles[2]).toBe(HOME[2]);
    },
  );
  it("conserves the rigid upper-arm length", () => {
    const r = rig();
    for (let i = 0; i < 240; i++)
      r.move("elbow", new Vector3(1, 0, 0), 0.5, 1 / 60);
    const shoulder = r.links.get("link_2")!.getWorldPosition(new Vector3());
    expect(r.point("elbow").distanceTo(shoulder)).toBeCloseTo(0.87, 10);
  });
  it.each([
    ["w", 0, 1],
    ["s", 0, -1],
    ["a", -1, 0],
    ["d", 1, 0],
  ])("tool IK follows %s and maintains world Y", (_, x, z) => {
    const r = rig(),
      before = r.point("tool");
    for (let i = 0; i < 60; i++)
      expect(
        r.move("tool", new Vector3(Number(x), 0, Number(z)), 0.2, 1 / 60),
      ).toBe(true);
    const delta = r.point("tool").sub(before);
    expect(delta.x).toBeCloseTo(Number(x) * 0.2, 3);
    expect(delta.z).toBeCloseTo(Number(z) * 0.2, 3);
    expect(delta.y).toBeCloseTo(0, 6);
  });
  it("normalizes diagonal input and cancels opposing keys", () => {
    expect(directionForKeys(new Set(["w", "d"])).length()).toBeCloseTo(1);
    expect(directionForKeys(new Set(["w", "s", "a", "d"])).length()).toBe(0);
  });
  it("gives the same motion at 30 and 120 fps", () => {
    const a = rig(),
      b = rig();
    for (let i = 0; i < 30; i++)
      a.move("tool", new Vector3(1, 0, 1), 0.2, 1 / 30);
    for (let i = 0; i < 120; i++)
      b.move("tool", new Vector3(1, 0, 1), 0.2, 1 / 120);
    expect(a.point("tool").distanceTo(b.point("tool"))).toBeLessThan(0.001);
  });
  it("rejects unreachable IK without a pose jump or target drift", () => {
    const r = rig();
    r.setAngles([0, 0, 0, 0, 0, 0]);
    let rejected = false;
    for (let i = 0; i < 1200; i++) {
      const before = r.point("tool");
      const ok = r.move("tool", new Vector3(1, 0, 0), 0.5, 1 / 60);
      if (!ok) {
        rejected = true;
        expect(r.point("tool").distanceTo(before)).toBeLessThan(1e-9);
        break;
      }
    }
    expect(rejected).toBe(true);
  });
  it("obeys joint and velocity limits over sustained input", () => {
    const r = rig();
    for (let i = 0; i < 1000; i++) {
      const before = [...r.angles];
      r.move("tool", new Vector3(0, 0, 1), 0.5, 1 / 60);
      r.joints.forEach((j, n) => {
        expect(r.angles[n]).toBeGreaterThanOrEqual(j.min);
        expect(r.angles[n]).toBeLessThanOrEqual(j.max);
        expect(Math.abs(r.angles[n] - before[n])).toBeLessThanOrEqual(
          j.velocity / 60 + 1e-9,
        );
      });
    }
  });
  it("returns a boundary at the top of the elbow arc", () => {
    const r = rig();
    r.setAngles([0, 0, 0, 0, 0, 0]);
    expect(r.move("elbow", new Vector3(0, 0, 1), 0.2, 1 / 60)).toBe(false);
    expect(r.angles[1]).toBe(0);
  });
});

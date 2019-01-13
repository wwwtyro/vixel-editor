"use strict";

const { vec3 } = require("gl-matrix");

const VoxelIndex = require("./voxel-index");

module.exports = class Stage {
  constructor(regl) {
    this.regl = regl;
    this.data = {};
    this.vIndex = new VoxelIndex();
    this.tIndex = regl.texture();
    this.tRGB = regl.texture();
    this.tRMET = regl.texture();
  }

  key(x, y, z) {
    return `${x} ${y} ${z}`;
  }

  set(x, y, z, red, green, blue, rough, metal, emit, transparent) {
    this.data[this.key(x, y, z)] = {
      x,
      y,
      z,
      red: Math.round(red * 255),
      green: Math.round(green * 255),
      blue: Math.round(blue * 255),
      rough,
      metal,
      emit,
      transparent
    };
  }

  unset(x, y, z) {
    if (Object.keys(this.data).length === 1) return;
    delete this.data[this.key(x, y, z)];
  }

  get(x, y, z) {
    return this.data[this.key(x, y, z)];
  }

  clear() {
    this.vIndex.clear();
    this.data = {};
  }

  updateBounds() {
    const b = {
      min: {
        x: Infinity,
        y: Infinity,
        z: Infinity
      },
      max: {
        x: -Infinity,
        y: -Infinity,
        z: -Infinity
      }
    };
    for (let [_, v] of Object.entries(this.data)) {
      b.min.x = Math.min(b.min.x, v.x);
      b.min.y = Math.min(b.min.y, v.y);
      b.min.z = Math.min(b.min.z, v.z);
      b.max.x = Math.max(b.max.x, v.x);
      b.max.y = Math.max(b.max.y, v.y);
      b.max.z = Math.max(b.max.z, v.z);
    }
    b.width = 1 + b.max.x - b.min.x;
    b.height = 1 + b.max.y - b.min.y;
    b.depth = 1 + b.max.z - b.min.z;
    this.bounds = b;
  }

  update() {
    this.updateBounds();
    let size = 1;
    while (
      size * size <
      this.bounds.width * this.bounds.height * this.bounds.depth
    ) {
      size *= 2;
    }
    const shiftX = -this.bounds.min.x;
    const shiftY = -this.bounds.min.y;
    const shiftZ = -this.bounds.min.z;
    const aIndex = new Uint8Array(size * size * 2);
    aIndex.fill(0);
    for (let [_, v] of Object.entries(this.data)) {
      const vi = this.vIndex.get(v);
      const ai =
        (shiftY + v.y) * this.bounds.width * this.bounds.depth +
        (shiftZ + v.z) * this.bounds.width +
        (shiftX + v.x);
      aIndex[ai * 2 + 0] = vi[0];
      aIndex[ai * 2 + 1] = vi[1];
    }
    this.tIndex({
      width: size,
      height: size,
      format: "luminance alpha",
      data: aIndex
    });
    this.tRGB({
      width: 256,
      height: 256,
      format: "rgb",
      data: this.vIndex.aRGB
    });
    this.tRMET({
      width: 256,
      height: 256,
      format: "rgba",
      type: "float",
      data: this.vIndex.aRMET
    });
  }

  serialize() {
    const out = {
      version: 0
    };
    out.xyz = [];
    out.rgb = [];
    out.rough = [];
    out.metal = [];
    out.emit = [];
    out.transparent = [];
    for (let [_, v] of Object.entries(this.data)) {
      out.xyz.push(v.x, v.y, v.z);
      out.rgb.push(v.red, v.green, v.blue);
      out.rough.push(+v.rough.toFixed(3));
      out.metal.push(+v.metal.toFixed(3));
      out.emit.push(+v.emit.toFixed(3));
      out.transparent.push(+v.transparent.toFixed(3));
    }
    return out;
  }

  deserialize(d) {
    this.clear();
    for (let i = 0; i < d.xyz.length / 3; i++) {
      this.set(
        d.xyz[i * 3 + 0],
        d.xyz[i * 3 + 1],
        d.xyz[i * 3 + 2],
        d.rgb[i * 3 + 0] / 255,
        d.rgb[i * 3 + 1] / 255,
        d.rgb[i * 3 + 2] / 255,
        d.rough[i],
        d.metal[i],
        d.emit[i],
        d.transparent[i]
      );
    }
  }

  rayAABB(r0, r, v) {
    const bMin = v.slice();
    const bMax = vec3.add([], v, [1, 1, 1]);
    const invr = r.map(e => 1 / e);
    const omax = vec3.mul([], vec3.sub([], bMin, r0), invr);
    const omin = vec3.mul([], vec3.sub([], bMax, r0), invr);
    const imax = vec3.max([], omax, omin);
    const imin = vec3.min([], omax, omin);
    const t1 = Math.min(imax[0], Math.min(imax[1], imax[2]));
    const t0 = Math.max(0, Math.max(imin[0], Math.max(imin[1], imin[2])));
    if (t1 > t0) {
      return t0;
    }
    return false;
  }

  intersect(r0, r) {
    const v = r0.map(Math.floor);
    const stp = r.map(Math.sign);
    const tDelta = r.map(e => 1.0 / Math.abs(e));
    const tMax = [
      r[0] < 0 ? r0[0] - Math.floor(r0[0]) : Math.ceil(r0[0]) - r0[0],
      r[1] < 0 ? r0[1] - Math.floor(r0[1]) : Math.ceil(r0[1]) - r0[1],
      r[2] < 0 ? r0[2] - Math.floor(r0[2]) : Math.ceil(r0[2]) - r0[2]
    ];
    tMax[0] /= Math.abs(r[0]);
    tMax[1] /= Math.abs(r[1]);
    tMax[2] /= Math.abs(r[2]);
    for (let i = 0; i < 8192; i++) {
      if (tMax[0] < tMax[1]) {
        if (tMax[0] < tMax[2]) {
          v[0] += stp[0];
          tMax[0] += tDelta[0];
        } else {
          v[2] += stp[2];
          tMax[2] += tDelta[2];
        }
      } else {
        if (tMax[1] <= tMax[2]) {
          v[1] += stp[1];
          tMax[1] += tDelta[1];
        } else {
          v[2] += stp[2];
          tMax[2] += tDelta[2];
        }
      }
      const gv = this.get(v[0], v[1], v[2]);
      if (gv) {
        return {
          voxel: v,
          t: this.rayAABB(r0, r, v)
        };
      }
    }
    return undefined;
  }
};

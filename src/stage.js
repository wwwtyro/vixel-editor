"use strict";

const { vec3 } = require("gl-matrix");

module.exports = function Stage(regl) {
  let data = {};
  let _bounds = calculateBounds();

  const textures = {
    rgbe: regl.texture(),
    fme: regl.texture(),
    size: 0
  };

  function key(x, y, z) {
    return `${x} ${y} ${z}`;
  }

  function set(x, y, z, r, g, b, f, m, e) {
    data[key(x, y, z)] = {
      x,
      y,
      z,
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      f,
      m,
      e
    };
  }

  function unset(x, y, z) {
    if (Object.keys(data).length === 1) return;
    delete data[key(x, y, z)];
  }

  function get(x, y, z) {
    return data[key(x, y, z)];
  }

  function clear() {
    data = {};
  }

  function serialize() {
    const out = {
      version: 0
    };
    out.position = [];
    out.albedo = [];
    out.roughness = [];
    out.metalness = [];
    out.emission = [];
    for (let [_, v] of Object.entries(data)) {
      out.position.push(v.x, v.y, v.z);
      out.albedo.push(v.r, v.g, v.b);
      out.roughness.push(+v.f.toFixed(3));
      out.metalness.push(+v.m.toFixed(3));
      out.emission.push(+v.e.toFixed(3));
    }
    return out;
  }

  function deserialize(d) {
    clear();
    for (let i = 0; i < d.position.length / 3; i++) {
      const x = d.position[i * 3 + 0];
      const y = d.position[i * 3 + 1];
      const z = d.position[i * 3 + 2];
      const r = d.albedo[i * 3 + 0];
      const g = d.albedo[i * 3 + 1];
      const b = d.albedo[i * 3 + 2];
      const f = d.roughness[i];
      const m = d.metalness[i];
      const e = d.emission[i];
      set(x, y, z, r / 255, g / 255, b / 255, f, m, e);
    }
  }

  function update() {
    const b = calculateBounds();
    _bounds = b;
    const w = 1 + b.max.x - b.min.x;
    const h = 1 + b.max.y - b.min.y;
    const d = 1 + b.max.z - b.min.z;
    let size = 1;
    while (size * size < w * d * h) {
      size *= 2;
    }
    const sx = -b.min.x;
    const sy = -b.min.y;
    const sz = -b.min.z;
    const rgbeArray = new Uint8Array(size * size * 4);
    rgbeArray.fill(0);
    const fmeArray = new Float32Array(size * size * 4);
    fmeArray.fill(0);
    for (let [_, v] of Object.entries(data)) {
      const i = (sy + v.y) * w * d + (sz + v.z) * w + (sx + v.x);
      rgbeArray[i * 4 + 0] = v.r;
      rgbeArray[i * 4 + 1] = v.g;
      rgbeArray[i * 4 + 2] = v.b;
      rgbeArray[i * 4 + 3] = 255;
      fmeArray[i * 4 + 0] = v.f;
      fmeArray[i * 4 + 1] = v.m;
      fmeArray[i * 4 + 2] = v.e;
    }
    textures.rgbe({
      width: size,
      height: size,
      data: rgbeArray
    });
    textures.fme({
      width: size,
      height: size,
      data: fmeArray,
      type: "float"
    });
    textures.size = size;
  }

  function bounds() {
    return _bounds;
  }

  function calculateBounds() {
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
    for (let [_, v] of Object.entries(data)) {
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
    return b;
  }

  function rayAABB(r0, r, v) {
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

  function intersect(r0, r) {
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
      const gv = get(v[0], v[1], v[2]);
      if (gv) {
        return {
          voxel: v,
          t: rayAABB(r0, r, v)
        };
      }
    }
    return undefined;
  }

  return {
    set,
    unset,
    get,
    clear,
    intersect,
    update,
    bounds,
    serialize,
    deserialize,
    textures
  };
};

"use strict";

const { mat4, vec3 } = require("gl-matrix");

module.exports = class TrackballCamera {
  constructor(domElement) {
    this._domElement = domElement;
    this._rotation = mat4.create();
    this.fov = Math.PI / 6;
    this.center = [0, 0, 0];
    this.radius = 10.0;
    this.near = 0.1;
    this.far = 1000;
  }

  rotate(dx, dy) {
    mat4.rotateY(this._rotation, this._rotation, -dx);
    mat4.rotateX(this._rotation, this._rotation, -dy);
  }

  eye() {
    const e = [0, 0, this.radius];
    vec3.transformMat4(e, e, this._rotation);
    vec3.add(e, e, this.center);
    return e;
  }

  view() {
    const up = [0, 1, 0];
    vec3.transformMat4(up, up, this._rotation);
    const e = this.eye();
    return mat4.lookAt([], e, this.center, up);
  }

  projection() {
    return mat4.perspective(
      [],
      this.fov,
      this._domElement.clientWidth / this._domElement.clientHeight,
      this.near,
      this.far
    );
  }

  invpv() {
    const v = this.view();
    const p = this.projection();
    const pv = mat4.multiply([], p, v);
    return mat4.invert([], pv);
  }

  serialize() {
    return {
      version: 0,
      rotation: this._rotation,
      fov: this.fov,
      center: this.center,
      radius: this.radius,
      near: this.near,
      far: this.far
    };
  }

  deserialize(data) {
    this._rotation = data.rotation;
    this.fov = data.fov;
    this.center = data.center;
    this.radius = data.radius;
    this.near = data.near;
    this.far = data.far;
  }
};

"use strict";

const { mat4, vec3, vec2 } = require("gl-matrix");
const dat = require("dat.gui");
const pick = require("camera-picking-ray");
const downloadCanvas = require("download-canvas").downloadCanvas;
const clip = require("copy-to-clipboard");
const jcb64 = require("jcb64");

const Renderer = require("./render");
const Stage = require("./stage");
const Camera = require("./camera");

const canvas = document.getElementById("render-canvas");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const renderer = Renderer(canvas);
const stage = Stage(renderer.context);
const camera = new Camera(canvas);

camera.rotate(0.00001, 0.00001);

const samplings = {
  "1/25": 1 / 25,
  "1/16": 1 / 4,
  "1/9": 1 / 3,
  "1/4": 1 / 2,
  "1 ": 1,
  "2 ": 2,
  "3 ": 3,
  "4 ": 4,
  "5 ": 5,
  "6 ": 6,
  "7 ": 7,
  "8 ": 8,
  "9 ": 9,
  "10 ": 10
};

const mouse = {
  left: false,
  right: false,
  x: null,
  y: null
};

function toggleHelp() {
  const h = document.getElementById("help");
  const hb = document.getElementById("help-button");
  if (hb.style.display === "none") {
    hb.style.display = "inline";
    h.style.display = "none";
  } else {
    hb.style.display = "none";
    h.style.display = "inline";
  }
}

toggleHelp();

document.getElementById("help").addEventListener("click", toggleHelp);
document.getElementById("help-button").addEventListener("click", toggleHelp);

window.addEventListener("contextmenu", e => {
  e.preventDefault();
  return false;
});

canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    mouse.left = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    const b = stage.bounds();
    camera.center = [
      b.width / 2 + b.min.x,
      b.height / 2 + b.min.y,
      b.depth / 2 + b.min.z
    ];
    camera.radius = vec3.length([b.width, b.height, b.depth]) * 1.5;
    const r = [];
    const r0 = [];
    pick(
      r0,
      r,
      [
        (canvas.width * e.offsetX) / canvas.clientWidth,
        (canvas.height * e.offsetY) / canvas.clientHeight
      ],
      [0, 0, canvas.width, canvas.height],
      camera.invpv()
    );
    const v = stage.intersect(r0, r);
    if (v === undefined && r[1] < 0 && r0[1] > b.min.y) {
      if (!e.shiftKey && !e.ctrlKey) {
        const p = vec3.add(
          [],
          r0,
          vec3.scale([], r, -(r0[1] - b.min.y) / r[1] - 0.001)
        );
        let n = p.map(Math.floor);
        stage.set(
          n[0],
          n[1],
          n[2],
          controls.color[0] / 255,
          controls.color[1] / 255,
          controls.color[2] / 255,
          controls.roughness,
          controls.metalness,
          controls.emission
        );
        stage.update();
        renderer.reset();
      }
    } else if (v !== undefined) {
      if (e.shiftKey) {
        stage.unset(v.voxel[0], v.voxel[1], v.voxel[2]);
        stage.update();
        renderer.reset();
      } else if (e.ctrlKey) {
        const vd = stage.get(v.voxel[0], v.voxel[1], v.voxel[2]);
        controls.roughness = vd.f;
        controls.metalness = vd.m;
        controls.emission = vd.e;
        controls.color = [vd.r, vd.g, vd.b];
        gui.updateDisplay();
      } else {
        const p = vec3.add([], r0, vec3.scale([], r, v.t - 0.001));
        let n = p.map(Math.floor);
        stage.set(
          n[0],
          n[1],
          n[2],
          controls.color[0] / 255,
          controls.color[1] / 255,
          controls.color[2] / 255,
          controls.roughness,
          controls.metalness,
          controls.emission
        );
        stage.update();
        renderer.reset();
      }
    }
  }
  if (e.button === 2) {
    mouse.right = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
});

window.addEventListener("mouseup", e => {
  if (e.button === 0) {
    mouse.left = false;
  }
  if (e.button === 2) {
    mouse.right = false;
  }
});

window.addEventListener("mousemove", e => {
  if (!mouse.right) return;
  const dx = e.clientX - mouse.x;
  const dy = e.clientY - mouse.y;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  camera.rotate(dx * 0.003, dy * 0.003);
  renderer.reset();
});

window.addEventListener("wheel", e => {
  camera.fov *= 1 + Math.sign(e.deltaY) * 0.1;
  camera.fov = Math.max(Math.PI / 32, Math.min(Math.PI / 1.1, camera.fov));
  renderer.reset();
});

const controls = new function() {
  this.color = [255, 255, 255];
  this.roughness = 0.0;
  this.metalness = 0.0;
  this.emission = 0.0;
  this.groundColor = [0, 0, 32];
  this.groundRoughness = 0.02;
  this.groundMetalness = 0.0;
  this.time = 6.06;
  this.azimuth = 0.0;
  this.width = 1280;
  this.height = 720;
  this.samplesPerFrame = "1/9";
  this.screenshot = function() {
    downloadCanvas("render-canvas", {
      name: "voxel",
      type: "png",
      quality: 1
    });
  };
  this.save = function() {
    const hash = `#${pack()}`;
    clip(location.href + hash);
    location.hash = hash;
  };
  this.clear = function() {
    stage.clear();
    stage.set(0, 0, 0, 0.5, 0.5, 0.5, 0, 0, 0);
    stage.update();
    renderer.reset();
  };
}();

const gui = new dat.GUI();

gui.fMaterial = gui.addFolder("Material");
gui.fGround = gui.addFolder("Ground");
gui.fSky = gui.addFolder("Sky");
gui.fRender = gui.addFolder("Rendering");
gui.fScene = gui.addFolder("Scene");

gui.fMaterial.open();
gui.fSky.open();
gui.fGround.open();
gui.fRender.open();
gui.fScene.open();

gui.fMaterial.addColor(controls, "color").name("Color");
gui.fMaterial
  .add(controls, "roughness")
  .name("Roughness")
  .min(0.0)
  .max(1.0)
  .step(0.01);
gui.fMaterial
  .add(controls, "metalness")
  .name("Metalness")
  .min(0.0)
  .max(1.0)
  .step(0.01);
gui.fMaterial
  .add(controls, "emission")
  .name("Emission")
  .min(0.0)
  .step(0.1);

gui.fGround
  .addColor(controls, "groundColor")
  .name("Color")
  .onChange(renderer.reset);
gui.fGround
  .add(controls, "groundRoughness")
  .name("Roughness")
  .min(0.0)
  .max(1.0)
  .step(0.01)
  .onChange(renderer.reset);
gui.fGround
  .add(controls, "groundMetalness")
  .name("Metalness")
  .min(0.0)
  .max(1.0)
  .step(0.01)
  .onChange(renderer.reset);

gui.fSky
  .add(controls, "time")
  .name("Time")
  .min(0.0)
  .max(24.0)
  .step(0.01)
  .onChange(function() {
    renderer.setSun(controls.time, controls.azimuth);
    renderer.reset();
  });
gui.fSky
  .add(controls, "azimuth")
  .name("Azimuth")
  .min(0.0)
  .max(2 * Math.PI)
  .step(0.01)
  .onChange(function() {
    renderer.setSun(controls.time, controls.azimuth);
    renderer.reset();
  });

gui.fRender
  .add(controls, "width")
  .name("Width")
  .min(1.0)
  .step(1)
  .onFinishChange(reflow);
gui.fRender
  .add(controls, "height")
  .name("Height")
  .min(1.0)
  .step(1)
  .onFinishChange(reflow);
gui.fRender
  .add(controls, "samplesPerFrame", Object.keys(samplings))
  .name("Samples/Frame")
  .onChange(configureSampling);
gui.fRender.add(controls, "screenshot").name("Take Screenshot");

gui.fScene.add(controls, "save").name("Copy URL");
gui.fScene.add(controls, "clear").name("Clear Scene");

const dg = document.getElementsByClassName("dg");
Array.prototype.forEach.call(dg, function(el, i) {
  el.style.userSelect = "none";
  el.style.webkitUserSelect = "none";
  el.style.webkitTouchCallout = "none";
  el.style.msUserSelect = "none";
  el.style.mozUserSelect = "none";
  el.style.oUserSelect = "none";
});

function reflow() {
  if (canvas.width !== controls.width || canvas.height !== controls.height) {
    canvas.width = controls.width;
    canvas.height = controls.height;
    renderer.reset();
  }
  const aspect0 = canvas.width / canvas.height;
  const aspect1 = window.innerWidth / window.innerHeight;
  if (aspect0 > aspect1) {
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${Math.floor(window.innerWidth / aspect0)}px`;
  } else {
    canvas.style.height = `${window.innerHeight}px`;
    canvas.style.width = `${Math.floor(aspect0 * window.innerHeight)}px`;
  }
  configureSampling();
}

function configureSampling() {
  const scale = samplings[controls.samplesPerFrame];
  if (scale < 1) {
    renderer.setSampling(
      Math.floor(canvas.width * scale),
      Math.floor(canvas.height * scale),
      1
    );
  } else {
    renderer.setSampling(canvas.width, canvas.height, scale);
  }
}

function pack() {
  const data = {
    model: stage.serialize(),
    camera: camera.serialize(),
    ground: {
      version: 0,
      color: controls.groundColor,
      roughness: controls.groundRoughness,
      metalness: controls.groundMetalness
    },
    sky: {
      version: 0,
      time: controls.time,
      azimuth: controls.azimuth
    }
  };
  return jcb64.pack(data);
}

function unpack(d) {
  const data = jcb64.unpack(d);
  stage.deserialize(data.model);
  camera.deserialize(data.camera);
  controls.time = data.sky.time;
  controls.azimuth = data.sky.azimuth;
  controls.groundColor = data.ground.color;
  controls.groundRoughness = data.ground.roughness;
  controls.groundMetalness = data.ground.metalness;
  gui.updateDisplay();
}

reflow();

window.addEventListener("resize", reflow);

if (location.hash) {
  unpack(location.hash.slice(1));
} else {
  let x = 0;
  let y = 0;
  let z = 0;
  stage.set(x, y, z, 1, 1, 1, 1, 0, 0);
  for (let i = 0; i < 10000; i++) {
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    const x1 = x + n[0];
    const z1 = z + n[1];
    while (stage.get(x1, y, z1)) y++;
    x = x1;
    z = z1;
    let rgb = [1, 1, 1];
    stage.set(x, y, z, ...rgb, 1, 0, Math.random() < 0.1 ? 0.1 : 0.0);
    while (stage.get(x, y - 1, z) === undefined && y > 0) {
      y--;
      stage.set(x, y, z, 1, 1, 1, 1, 0, 0);
    }
  }
}

renderer.setSun(controls.time, controls.azimuth);
renderer.reset();

stage.update();

function loop() {
  const b = stage.bounds();
  camera.center = vec3.scale([], [b.width, b.height, b.depth], 0.5);
  camera.radius = vec3.length([b.width, b.height, b.depth]) * 1.5;
  renderer.sample(stage, camera, controls);
  renderer.display();

  document.getElementById(
    "stats"
  ).innerText = `${renderer.sampleCount().toFixed(2)} samples`;

  requestAnimationFrame(loop);
}

loop();

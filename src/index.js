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
const stage = new Stage(renderer.context);
const camera = new Camera(canvas);

camera.rotate(1, 0.2);

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
    const b = stage.bounds;
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
          controls.emission,
          controls.transparent,
          controls.ri
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
        controls.roughness = vd.rough;
        controls.metalness = vd.metal;
        controls.emission = vd.emit;
        controls.color = [vd.red, vd.green, vd.blue];
        controls.transparent = vd.transparent;
        controls.ri = vd.ri;
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
          controls.emission,
          controls.transparent,
          controls.ri
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
  this.transparent = 0.0;
  this.ri = 1.0;
  this.groundColor = [80, 80, 80];
  this.groundRoughness = 1;
  this.groundMetalness = 0.0;
  this.time = 6.1;
  this.azimuth = 0.0;
  this.lightRadius = 8.0;
  this.lightIntensity = 1.0;
  this.width = 1280;
  this.height = 720;
  this.dofDist = 0.5;
  this.dofMag = 0.0;
  this.autoSample = true;
  this.samplesPerFrame = 1;
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
    stage.set(0, 0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0, 1);
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
  .add(controls, "transparent")
  .name("Transparency")
  .min(0.0)
  .max(1.0)
  .step(0.01);
gui.fMaterial
  .add(controls, "ri")
  .name("Refractive Index")
  .min(1.0)
  .max(3.0)
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
    renderer.reset();
  });
gui.fSky
  .add(controls, "azimuth")
  .name("Azimuth")
  .min(0.0)
  .max(2 * Math.PI)
  .step(0.01)
  .onChange(function() {
    renderer.reset();
  });
gui.fSky
  .add(controls, "lightRadius")
  .name("Sun Radius")
  .min(0.0)
  .onChange(function() {
    renderer.reset();
  });
gui.fSky
  .add(controls, "lightIntensity")
  .name("Sun Intensity")
  .min(0.0)
  .onChange(function() {
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
  .add(controls, "dofDist")
  .name("DOF Distance")
  .min(0.0)
  .max(1.0)
  .step(0.001)
  .onChange(renderer.reset);
gui.fRender
  .add(controls, "dofMag")
  .name("DOF Magnitude")
  .min(0.0)
  .step(0.01)
  .onChange(renderer.reset);
gui.fRender.add(controls, "autoSample");
gui.fRender
  .add(controls, "samplesPerFrame")
  .name("Samples/Frame")
  .min(1)
  .listen();
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
      azimuth: controls.azimuth,
      radius: controls.lightRadius,
      intensity: controls.lightIntensity
    },
    dof: {
      dist: controls.dofDist,
      mag: controls.dofMag
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
  controls.lightRadius = data.sky.radius;
  controls.lightIntensity = data.sky.intensity;
  controls.groundColor = data.ground.color;
  controls.groundRoughness = data.ground.roughness;
  controls.groundMetalness = data.ground.metalness;
  controls.dofDist = data.dof.dist;
  controls.dofMag = data.dof.mag;
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
  stage.set(x, y, z, 1, 1, 1, 1, 0, 0, 0, 1);
  let transparent = 1;
  let ri = 1.5;
  let rgb = [1, 1, 1];
  let rough = 0.1;
  for (let i = 0; i < 200; i++) {
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    const x1 = x + n[0];
    const z1 = z + n[1];
    while (stage.get(x1, y, z1)) y++;
    x = x1;
    z = z1;
    let emit = Math.random() < 0.1 && !transparent ? 2 : 0;
    if (Math.random() < 0.1) {
      if (transparent) {
        transparent = 0;
        ri = 1;
        rgb = [1, 1, 1];
        rough = 1;
      } else {
        emit = 0;
        transparent = 1.0;
        ri = Math.random() + 1;
        rough = Math.random() * 0.1;
        rgb = [Math.random(), Math.random(), Math.random()];
      }
    }
    stage.set(x, y, z, ...rgb, 1, 0, emit, transparent, ri);
    while (stage.get(x, y - 1, z) === undefined && y > 0) {
      y--;
      stage.set(x, y, z, ...rgb, 1, 0, 0, 0, 1);
    }
  }
}

renderer.reset();

stage.update();

let tLast = 0;

function loop() {
  if (controls.autoSample) {
    const dt = performance.now() - tLast;
    tLast = performance.now();

    if (dt > 1000 / 30) {
      controls.samplesPerFrame = Math.max(1, controls.samplesPerFrame - 1);
    } else if (dt < 1000 / 60) {
      if (renderer.sampleCount() > 1) controls.samplesPerFrame++;
    }
    // gui.updateDisplay();
  }
  const b = stage.bounds;
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

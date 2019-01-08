"use strict";

const { mat4, vec3, vec2 } = require("gl-matrix");
const glsl = require("glslify");
const createAtmosphereRenderer = require("regl-atmosphere-envmap");
const PingPong = require("./pingpong");

module.exports = function Renderer(canvas) {
  const regl = require("regl")({
    canvas: canvas,
    extensions: ["OES_texture_float"],
    attributes: {
      antialias: false,
      preserveDrawingBuffer: true
    }
  });

  const sun = {
    position: vec3.scale(
      [],
      vec3.normalize([], [1.11, -0.0, 0.25]),
      150000000000
    ),
    color: [1, 1, 1],
    radius: 695508000 * 3
  };

  const renderAtmosphere = createAtmosphereRenderer(regl);
  const skyMap = renderAtmosphere({
    sunDirection: vec3.normalize([], sun.position),
    resolution: 1024
  });

  const pingpong = PingPong(regl, {
    width: canvas.width,
    height: canvas.height,
    colorType: "float"
  });

  const ndcBox = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];

  const tRandSize = 1024;

  const t2Sphere = (function() {
    const data = new Float32Array(tRandSize * tRandSize * 3);
    for (let i = 0; i < tRandSize * tRandSize; i++) {
      let r = vec3.random([]);
      data[i * 3 + 0] = r[0];
      data[i * 3 + 1] = r[1];
      data[i * 3 + 2] = r[2];
    }
    return regl.texture({
      width: tRandSize,
      height: tRandSize,
      format: "rgb",
      type: "float",
      data: data,
      wrap: "repeat"
    });
  })();

  const t3Sphere = (function() {
    const data = new Float32Array(tRandSize * tRandSize * 3);
    for (let i = 0; i < tRandSize * tRandSize; i++) {
      let r = vec3.random([], Math.random());
      data[i * 3 + 0] = r[0];
      data[i * 3 + 1] = r[1];
      data[i * 3 + 2] = r[2];
    }
    return regl.texture({
      width: tRandSize,
      height: tRandSize,
      format: "rgb",
      type: "float",
      data: data,
      wrap: "repeat"
    });
  })();

  const tUniform2 = (function() {
    const data = new Float32Array(tRandSize * tRandSize * 2);
    for (let i = 0; i < tRandSize * tRandSize; i++) {
      data[i * 2 + 0] = Math.random();
      data[i * 2 + 1] = Math.random();
    }
    return regl.texture({
      width: tRandSize,
      height: tRandSize,
      format: "luminance alpha",
      type: "float",
      data: data,
      wrap: "repeat"
    });
  })();

  const tUniform1 = (function() {
    const data = new Float32Array(tRandSize * tRandSize * 1);
    for (let i = 0; i < tRandSize * tRandSize; i++) {
      data[i] = Math.random();
    }
    return regl.texture({
      width: tRandSize,
      height: tRandSize,
      format: "luminance",
      type: "float",
      data: data,
      wrap: "repeat"
    });
  })();

  let sampleCount = 0;

  const cmdSample = regl({
    vert: glsl.file("./glsl/sample.vert"),
    frag: glsl.file("./glsl/sample.frag"),
    attributes: {
      position: ndcBox
    },
    uniforms: {
      source: regl.prop("source"),
      invpv: regl.prop("invpv"),
      eye: regl.prop("eye"),
      res: regl.prop("res"),
      tSky: skyMap,
      tUniform1: tUniform1,
      tUniform2: tUniform2,
      t2Sphere: t2Sphere,
      t3Sphere: t3Sphere,
      tOffset: regl.prop("tOffset"),
      tRGBE: regl.prop("tRGBE"),
      tFME: regl.prop("tFME"),
      resStage: regl.prop("resStage"),
      invResRand: [1 / tRandSize, 1 / tRandSize],
      lightPosition: regl.prop("lightPosition"),
      lightColor: regl.prop("lightColor"),
      lightRadius: regl.prop("lightRadius"),
      groundColor: regl.prop("groundColor"),
      groundRoughness: regl.prop("groundRoughness"),
      groundMetalness: regl.prop("groundMetalness"),
      bounds: regl.prop("bounds")
    },
    depth: {
      enable: false,
      mask: false
    },
    viewport: regl.prop("viewport"),
    framebuffer: regl.prop("destination"),
    count: 6
  });

  const cmdDisplay = regl({
    vert: glsl.file("./glsl/display.vert"),
    frag: glsl.file("./glsl/display.frag"),
    attributes: {
      position: ndcBox
    },
    uniforms: {
      source: regl.prop("source"),
      tUniform1: tUniform1,
      tUniform1Res: [tUniform1.width, tUniform1.height]
    },
    depth: {
      enable: false,
      mask: false
    },
    viewport: regl.prop("viewport"),
    count: 6
  });

  function setSun(time, azimuth) {
    const theta = (2 * Math.PI * (time - 6)) / 24;
    const phi = azimuth;
    const r = 150000000000;
    sun.position = [
      r * Math.cos(phi) * Math.cos(theta),
      r * Math.sin(theta),
      r * Math.sin(phi) * Math.cos(theta)
    ];
    renderAtmosphere({
      sunDirection: vec3.normalize([], sun.position),
      cubeFBO: skyMap
    });
  }

  function sample(stage, camera, controls) {
    const b = stage.bounds();
    for (let i = 0; i < controls.samplesPerFrame; i++) {
      cmdSample({
        eye: camera.eye(),
        invpv: camera.invpv(),
        res: [canvas.width, canvas.height],
        tOffset: [Math.random(), Math.random()],
        viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height },
        tRGBE: stage.textures.rgbe,
        tFME: stage.textures.fme,
        resStage: stage.textures.size,
        bounds: [b.width, b.height, b.depth],
        lightPosition: sun.position,
        lightColor: sun.color,
        lightRadius: sun.radius,
        groundRoughness: controls.groundRoughness,
        groundColor: controls.groundColor.map(c => c / 255),
        groundMetalness: controls.groundMetalness,
        source: pingpong.ping(),
        destination: pingpong.pong()
      });
      pingpong.swap();
      sampleCount++;
    }
  }

  function display() {
    regl.clear({ depth: 1, color: [0, 0, 0, 0] });
    cmdDisplay({
      source: pingpong.ping(),
      viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height }
    });
  }

  function reset() {
    if (
      pingpong.ping().width !== canvas.width ||
      pingpong.ping().height !== canvas.height
    ) {
      pingpong.ping()({
        width: canvas.width,
        height: canvas.height,
        colorType: "float"
      });
      pingpong.pong()({
        width: canvas.width,
        height: canvas.height,
        colorType: "float"
      });
    }
    regl.clear({ color: [0, 0, 0, 0], framebuffer: pingpong.ping() });
    regl.clear({ color: [0, 0, 0, 0], framebuffer: pingpong.pong() });
    sampleCount = 0;
  }

  return {
    context: regl,
    sample: sample,
    display: display,
    reset: reset,
    sampleCount: function() {
      return sampleCount;
    },
    setSun: setSun
  };
};

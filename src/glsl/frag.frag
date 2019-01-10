precision highp float;

uniform sampler2D tUniform2;
uniform vec2 resFrag, resTarget, randOffset;
uniform float resRand;

void main() {
  vec2 p0 = floor(gl_FragCoord.xy)/resFrag;
  vec2 r = texture2D(tUniform2, randOffset + gl_FragCoord.xy/resRand).ra;
  vec2 pr = p0 + r/resFrag;
  vec2 fc = floor(pr * resTarget);
  gl_FragColor = vec4(fc + 0.5, 1, 1);
}

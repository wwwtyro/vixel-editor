precision highp float;

uniform sampler2D source, tFrag, tSample;
uniform vec2 res;
varying vec2 vPos;

void main() {
  vec2 fc = gl_FragCoord.xy/res;
  vec4 sample = texture2D(tSample, fc);
  vec2 frag = texture2D(tFrag, fc).xy;
  vec4 src = texture2D(source, fc);
  float d = 1.0 / distance(gl_FragCoord.xy, frag);
  if (frag == gl_FragCoord.xy) {
    gl_FragColor = src + sample;
  } else {
    gl_FragColor = src;
  }
}

precision highp float;

uniform sampler2D source, preview, tUniform1;
uniform vec2 tUniform1Res;
uniform float fraction;

varying vec2 vPos;

void main() {
  vec4 src = texture2D(source, vPos);
  vec4 prv = texture2D(preview, vPos);
  vec3 color = mix(prv.rgb, src.rgb/max(src.a, 1.0), fraction);
  color = pow(color, vec3(1.0/2.2));
  float r = texture2D(tUniform1, gl_FragCoord.xy/tUniform1Res).r;
  color += mix(-0.5/255.0, 0.5/255.0, r);
  gl_FragColor = vec4(color, 1);
}

precision highp float;

uniform sampler2D source, tUniform1;
uniform vec2 tUniform1Res;

varying vec2 vPos;

void main() {
  vec4 src = texture2D(source, vPos);
  vec3 color = src.rgb/src.a;
  color = pow(color, vec3(1.0/2.2));
  float r = texture2D(tUniform1, gl_FragCoord.xy/tUniform1Res).r;
  color += mix(-0.5/255.0, 0.5/255.0, r);
  gl_FragColor = vec4(color, 1);
}

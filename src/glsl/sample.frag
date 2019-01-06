precision highp float;
uniform sampler2D source, tRGBE, tFME, t2Sphere, t3Sphere, tUniform2, tUniform1;
uniform samplerCube tSky;
uniform mat4 invpv;
uniform vec3 eye, bounds, lightPosition, lightColor, groundColor;
uniform vec2 res, tOffset, invResRand;
uniform float resStage, lightRadius, groundRoughness, groundMetalness;

const float epsilon = 0.0001;
const int nBounces = 3;

float randUniform1(inout vec2 randOffset) {
  float r = texture2D(tUniform1, randOffset + tOffset + gl_FragCoord.xy * invResRand).r;
  randOffset += r;
  return r;
}

vec2 randUniform2(inout vec2 randOffset) {
  vec2 r = texture2D(tUniform1, randOffset + tOffset + gl_FragCoord.xy * invResRand).rg;
  randOffset += r;
  return r;
}


vec3 rand2Sphere(inout vec2 randOffset) {
  vec3 r = texture2D(t2Sphere, randOffset + tOffset + gl_FragCoord.xy * invResRand).xyz;
  randOffset += r.xy;
  return r;
}

vec3 rand3Sphere(inout vec2 randOffset) {
  vec3 r = texture2D(t3Sphere, randOffset + tOffset + gl_FragCoord.xy * invResRand).xyz;
  randOffset += r.xy;
  return r;
}

bool inBounds(vec3 p) {
  return all(greaterThanEqual(p, vec3(0.0))) && all(lessThan(p, bounds));
}

bool rayAABB(vec3 origin, vec3 direction, vec3 bMin, vec3 bMax, out float t0) {
  vec3 invDir = 1.0 / direction;
  vec3 omin = (bMin - origin) * invDir;
  vec3 omax = (bMax - origin) * invDir;
  vec3 imax = max(omax, omin);
  vec3 imin = min(omax, omin);
  float t1 = min(imax.x, min(imax.y, imax.z));
  t0 = max(imin.x, max(imin.y, imin.z));
  t0 = max(t0, 0.0);
  return t1 > t0;
}

vec3 rayAABBNorm(vec3 p, vec3 v) {
  vec3 d = p - (v + 0.5);
  vec3 dabs = abs(d);
  if (dabs.x > dabs.y) {
    if (dabs.x > dabs.z) {
      return vec3(sign(d.x), 0.0, 0.0);
    } else {
      return vec3(0, 0, sign(d.z));
    }
  } else {
    if (dabs.y > dabs.z) {
      return vec3(0.0, sign(d.y), 0.0);
    } else {
      return vec3(0.0, 0.0, sign(d.z));
    }
  }
}

vec2 samplePoint(vec3 v) {
  float invResStage = 1.0 / resStage;
  float i = v.y * bounds.x * bounds.z + v.z * bounds.x + v.x;
  i = i * invResStage;
  float y = floor(i);
  float x = fract(i) * resStage;
  x = (x + 0.5) * invResStage;
  y = (y + 0.5) * invResStage;
  return vec2(x, y);
}


bool hitVoxel(vec3 v) {
  if (!inBounds(v)) return false;
  vec2 s = samplePoint(v);
  return texture2D(tRGBE, s).a == 1.0;
}

struct VoxelData {
  vec3 rgb;
  float roughness;
  float metalness;
  float emission;
};

VoxelData voxelData(vec3 v) {
  VoxelData vd;
  if (v.y == -1.0) {
    vd.rgb = groundColor;
    vd.roughness = groundRoughness;
    vd.metalness = groundMetalness;
    vd.emission = 0.0;
    return vd;
  }
  vec2 s = samplePoint(v);
  vd.rgb = texture2D(tRGBE, s).rgb;
  vec3 fme = texture2D(tFME, s).rgb;
  vd.roughness = fme.r;
  vd.metalness = fme.g;
  vd.emission = fme.b * 10.0;
  return vd;
}

bool intersect(vec3 r0, vec3 r, out vec3 v) {
  float tBounds = 0.0;
  if (!rayAABB(r0, r, vec3(0.0), bounds, tBounds)) {
    if (r.y >= 0.0) {
      return false;
    }
    v = floor(r0 - r * r0.y/r.y + r * epsilon);
    return true;
  }
  r0 = r0 + r * tBounds;
  v = floor(r0);
  vec3 stp = sign(r);
  vec3 tDelta = 1.0 / abs(r);
  vec3 tMax = step(0.0, r) * (1.0 - fract(r0)) + (1.0 - step(0.0, r)) * fract(r0);
  tMax = tMax/abs(r);
  for (int i = 0; i < 8192; i++) {
    if (hitVoxel(v)) return true;
    if (tMax.x < tMax.y) {
      if (tMax.x < tMax.z) {
        v.x += stp.x;
        tMax.x += tDelta.x;
      } else {
        v.z += stp.z;
        tMax.z += tDelta.z;
      }
    } else {
      if (tMax.y <= tMax.z) {
        v.y += stp.y;
        tMax.y += tDelta.y;
      } else {
        v.z += stp.z;
        tMax.z += tDelta.z;
      }
    }
    if (!inBounds(v)) {
      if (r.y >= 0.0) {
        return false;
      }
      v = floor(r0 - r * r0.y/r.y + r * epsilon);
      return true;
    }
  }
  return false;
}

float raySphereIntersect(vec3 r0, vec3 rd, vec3 s0, float sr) {
    float a = dot(rd, rd);
    vec3 s0_r0 = r0 - s0;
    float b = 2.0 * dot(rd, s0_r0);
    float c = dot(s0_r0, s0_r0) - (sr * sr);
    if (b*b - 4.0*a*c < 0.0) {
        return -1.0;
    }
    return (-b - sqrt((b*b) - 4.0*a*c))/(2.0*a);
}

vec3 skyColor(vec3 r0, vec3 r) {
  if (r.y < 0.0) {
    return vec3(0.0);
  }
  if (raySphereIntersect(r0, r, lightPosition, lightRadius) > 0.0) {
    return lightColor;
  }
  return textureCube(tSky, r).rgb;
}

void main() {

  // Get the incoming value.
  vec2 invres = 1.0/res;
  vec4 src = texture2D(source, gl_FragCoord.xy * invres);

  vec2 randOffset = vec2(0.0);

  // Recover NDC
  vec2 jitter = randUniform2(randOffset) - 0.5;
  vec4 ndc = vec4(
    2.0 * (gl_FragCoord.xy + jitter) * invres - 1.0,
    2.0 * gl_FragCoord.z - 1.0,
    1.0
  );

  // Calculate clip
  vec4 clip = invpv * ndc;

  // Calculate 3D position
  vec3 p3d = clip.xyz / clip.w;

  vec3 r = normalize(p3d - eye);
  vec3 r0 = eye;

  vec3 mask = vec3(1.0);
  vec3 accm = vec3(0.0);

  for (int b = 0; b < nBounces; b++) {
    vec3 v = vec3(0.0);
    if (intersect(r0, r, v)) {
      VoxelData vd = voxelData(v);
      if (vd.emission > 0.0) {
        accm += mask * vd.emission * vd.rgb;
        break;
      }
      float tVoxel = 0.0;
      rayAABB(r0, r, v, v + 1.0, tVoxel);
      vec3 r1 = r0 + tVoxel * r;
      vec3 n = rayAABBNorm(r1, v);
      vec3 m = normalize(n + rand3Sphere(randOffset) * vd.roughness);
      vec3 diffuse = normalize(m + rand2Sphere(randOffset));
      vec3 ref = reflect(r, m);
      if (randUniform1(randOffset) <= vd.metalness) {
        // metallic
        r = ref;
        mask *= vd.rgb;
      } else {
        // nonmetallic
        const float F0 = 0.04;
        float F = F0 + (1.0 - F0) * pow(1.0 - dot(-r, n), 5.0);
        if (randUniform1(randOffset) <= F) {
          // reflect
          r = ref;
        } else {
          // diffuse
          mask *= vd.rgb;
          r = diffuse;
        }
      }
      if (dot(r, n) < 0.0) {
        accm = vec3(0.0);
        break;
      }
      r0 = r1 + r * epsilon;
      if (r == diffuse) {
        // Perform next event estimation when a diffuse bounce occurs.
        vec3 pLight = lightPosition + rand2Sphere(randOffset) * lightRadius;
        vec3 rLight = normalize(pLight - r0);
        vec3 _v;
        if (!intersect(r0, rLight, _v)) {
          accm += mask * skyColor(r0, rLight) * clamp(dot(rLight, r), 0.0, 1.0);
        }
      }
    } else {
      accm += mask * skyColor(r0, r).rgb;
      break;
    }
  }

  gl_FragColor = src + vec4(accm, 1);
}

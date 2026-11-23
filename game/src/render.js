// Palmar Bay — three.js renderer: sunset sky, city meshes, camera, minimap.
import * as THREE from 'three';
import { CFG, SUNSET } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SUNSET.fogColor, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    // Sunset gradient sky: big inverted sphere with vertex colours.
    const skyGeo = new THREE.SphereGeometry(700, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(SUNSET.skyTop) },
        mid: { value: new THREE.Color(SUNSET.skyMid) },
        low: { value: new THREE.Color(SUNSET.skyLow) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    // Sun disc + glow sprite.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: SUNSET.sunColor, fog: false })
    );
    sun.position.set(-420, 95, -260);
    sun.lookAt(0, 40, 0);
    this.scene.add(sun);
    // Lights.
    this.scene.add(new THREE.AmbientLight(SUNSET.ambient, 0.9));
    const hemi = new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xff9a4d, 1.6);
    dir.position.set(-180, 120, -80);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -260; dir.shadow.camera.right = 260;
    dir.shadow.camera.top = 260; dir.shadow.camera.bottom = -260;
    dir.shadow.camera.far = 600;
    this.scene.add(dir);
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
    window.addEventListener('resize', () => this.onResize());
  }
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  buildStatic(city) {
    const g = new THREE.Group();
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a3a44, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CFG.worldSize + 260, CFG.worldSize + 260), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.x = -60; ground.receiveShadow = true;
    g.add(ground);
    // Ocean (west).
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(260, CFG.worldSize + 260),
      new THREE.MeshStandardMaterial({ color: SUNSET.ocean, roughness: 0.25, metalness: 0.4 })
    );
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(-CFG.worldSize / 2 - 130 + 8, 0.4, 0);
    g.add(ocean);
    // Sand strip.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(26, CFG.worldSize),
      new THREE.MeshStandardMaterial({ color: SUNSET.sand, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2; sand.position.set(-CFG.worldSize / 2 - 6, 0.5, 0); sand.receiveShadow = true;
    g.add(sand);
    // Roads: dark strips + centre dashes.
    const roadMat = new THREE.MeshStandardMaterial({ color: SUNSET.road, roughness: 0.95 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd76b });
    const half = city.half;
    for (const r of city.roads) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CFG.worldSize, CFG.roadWidth), roadMat);
      strip.rotation.x = -Math.PI / 2;
      if (r.axis === 'x') { strip.rotation.z = Math.PI / 2; strip.position.set(r.at, 0.6, 0); }
      else strip.position.set(0, 0.6, r.at);
      strip.receiveShadow = true;
      g.add(strip);
      for (let t = -half; t < half; t += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (r.axis === 'x') { dash.rotation.z = Math.PI / 2; dash.position.set(r.at, 0.65, t); }
        else dash.position.set(t, 0.65, r.at);
        g.add(dash);
      }
    }
    // Buildings with lit windows (emissive texture made procedurally).
    for (const b of city.buildings) {
      const mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      if (b.lit) {
        const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
        const cols = Math.max(2, Math.floor(b.w / 6)), rows = Math.max(2, Math.floor(b.h / 7));
        for (let cx = 0; cx < cols; cx++) {
          for (let rz = 0; rz < rows; rz++) {
            if ((cx * 7 + rz * 3 + Math.floor(b.x)) % 3 !== 0) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), winMat);
            win.position.set(b.x - b.w / 2 + 3 + cx * 6, 4 + rz * 7, b.z + b.d / 2 + 0.06);
            g.add(win);
          }
        }
      }
      // Rooftop edge glow for tall towers.
      if (b.h > 34) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.5, b.d + 0.4),
          new THREE.MeshBasicMaterial({ color: 0xff5a7a }));
        edge.position.set(b.x, b.h + 0.2, b.z);
        g.add(edge);
      }
    }
    // Palms: trunk + fronds (cones).
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f5b, roughness: 1 });
    for (const p of city.palms) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
      trunk.position.set(p.x, 3.5, p.z); trunk.castShadow = true;
      g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.2, 7), leafMat);
      crown.position.set(p.x, 8.2, p.z);
      g.add(crown);
    }
    // Street lights (emissive bulbs).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.6 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const l of city.lights) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), poleMat);
      pole.position.set(l.x, 3, l.z);
      g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(l.x, 6.2, l.z);
      g.add(bulb);
    }
    // Lighthouse (finale target): striped tower + rotating beam.
    const lh = city.lighthouse;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff2e0, roughness: 0.8 }));
    tower.position.set(lh.x, 13, lh.z); tower.castShadow = true;
    g.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xd21f3c, roughness: 0.8 }));
    band.position.set(lh.x, 16, lh.z);
    g.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    lamp.position.set(lh.x, 27, lh.z);
    g.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.z = Math.PI / 2; beam.position.set(lh.x + 30, 27, lh.z);
    beam.name = 'lighthouse-beam';
    g.add(beam);
    this.scene.add(g);
    this.beam = beam;
  }
  makeCarMesh(color, isCop) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
    body.position.y = 0.65; body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.15, metalness: 0.7 }));
    cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
    group.add(cabin);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz);
      group.add(w);
    }
    if (isCop) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      bar.position.set(0, 1.75, -0.2);
      bar.name = 'lightbar';
      group.add(bar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.y = 0.85;
      group.add(stripe);
    }
    return group;
  }
  makePedMesh(shirt) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
    body.position.y = 1.1; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 }));
    head.position.y = 2.1;
    group.add(head);
    return group;
  }
  makePersonMesh(shirt, pants) {
    const g = this.makePedMesh(shirt);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35),
      new THREE.MeshStandardMaterial({ color: pants || 0x223344, roughness: 0.9 }));
    legs.position.y = 0.35;
    g.add(legs);
    return g;
  }
  followCamera(px, pz, heading, inCar, speed, dt, time, wide) {
    const back = wide ? 22 : inCar ? 11 + speed * 0.08 : 8;
    const height = wide ? 10 : inCar ? 4.6 : 4.2;
    const tx = px - Math.sin(heading) * back;
    const tz = pz - Math.cos(heading) * back;
    const k = 1 - Math.pow(0.0001, dt); // smooth damp
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(px + Math.sin(heading) * 6, 1.6, pz + Math.cos(heading) * 6);
    if (this.beam) this.beam.rotation.y = time * 0.6;
  }
  render() { this.renderer.render(this.scene, this.camera); }
  shot() { return this.renderer.domElement.toDataURL('image/jpeg', 0.85); }
}

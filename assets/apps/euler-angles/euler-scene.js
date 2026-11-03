/**
 * Universal 3D WebGL Visualizer for Euler Angles & Gimbal Lock
 * Features:
 * - High-luminance, vibrant color palette for axes (X=Red, Y=Green, Z=Blue), gimbals, and 3D models
 * - 3 selectable rigid body models in the center: Drone, Box, or Jet Fighter
 * - Physical 3-axis concentric gimbal rings dynamically configured for all 12 Euler sequences
 * - Intrinsic (A1(ϕ) → A2'(θ) → A3''(ψ)) and Equivalent Extrinsic (A3(ψ) → A2(θ) → A1(ϕ)) step playback
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SEQUENCES, elementaryRotationMatrix, matMul3, matVec3, unitAxisVector } from './euler-math.js';

const AXIS_COLORS = {
  x: 0xff0000, // Pure Red
  y: 0x00cc00, // Pure Green
  z: 0x0055ff  // Pure Blue
};

const AXIS_HEX = {
  x: '#ff0000',
  y: '#00b300',
  z: '#0055ff'
};

// High-luminance pure RGB ring colors for Outer (ϕ), Middle (θ), and Inner (ψ) gimbals
const GIMBAL_RING_COLORS = {
  outer:  { x: 0xff0000, y: 0x00cc00, z: 0x0055ff },
  middle: { x: 0xff3333, y: 0x00dd44, z: 0x1a75ff },
  inner:  { x: 0xff1a1a, y: 0x22e64b, z: 0x3385ff }
};

export class EulerScene3D {
  constructor(containerEl) {
    this.container = containerEl;
    this.width = containerEl.clientWidth || 960;
    this.height = containerEl.clientHeight || 650;

    this.scene = new THREE.Scene();
    this.isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const aspect = this.width / this.height;
    this.orthoFrustum = 5.7;

    this.perspCamera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
    this.perspCamera.up.set(0, 0, 1);
    this.perspCamera.position.set(4.8, -4.5, 3.3);

    this.orthoCamera = new THREE.OrthographicCamera(
      (-this.orthoFrustum * aspect) / 2,
      (this.orthoFrustum * aspect) / 2,
      this.orthoFrustum / 2,
      -this.orthoFrustum / 2,
      -50,
      100
    );
    this.orthoCamera.up.set(0, 0, 1);
    this.orthoCamera.position.set(4.8, -4.5, 3.3);

    // Default to Orthographic Projection
    this.isOrtho = true;
    this.camera = this.orthoCamera;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      stencil: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 14.0;
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 2.8;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('end', () => {
      if (this.onCameraChange) this.onCameraChange();
    });

    this.layers = {
      gimbals: true,
      worldFrame: true,
      interFrames: false,
      bodyFrame: true,
      activeAxes: true,
      sphereArcs: true
    };

    this.gimbalStyle = 'ring'; // 'ring' | 'sheet' (Saturn-style flat annular ring)
    this.labelScale = 1.0; // Multiplier for 3D axis label sprites (adjustable via Font +/- buttons)
    this.currentModelType = 'drone'; // 'drone' | 'box' | 'jet'
    this.mouseMode = 'smart'; // 'smart' | 'object' | 'camera'
    this.lastState = null;
    this.currentR = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    this.activeAxesWorld = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];
    this.onInteraction = null;
    this.onHoverChange = null;
    this.onCameraChange = null;
    this.hoveredTarget = null;
    this.dragState = null;
    this.raycaster = new THREE.Raycaster();
    this.gimbalPickMeshes = [];
    this.vcSize = 186;
    this.vcMarginRight = 10;
    this.vcMarginTop = 8;
    this.vcHoveredMesh = null;
    this._camAnim = null;

    this._initLightsAndEnvironment();
    this._initGroups();
    this._initViewCube();
    this._applyThemeColors();
    this._initMouseInteraction();

    this._themeObserver = new MutationObserver(() => {
      const darkNow = document.documentElement.getAttribute('data-theme') === 'dark';
      if (darkNow !== this.isDark) {
        this.isDark = darkNow;
        this._applyThemeColors();
        if (this.lastState) this.updateScene(this.lastState);
      }
    });
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._clock = new THREE.Clock();
    this._rotorMeshes = [];
    this._animate = () => {
      this._rafId = requestAnimationFrame(this._animate);
      const dt = this._clock.getDelta();
      if (this.currentModelType === 'drone' && this._rotorMeshes.length > 0) {
        for (let i = 0; i < this._rotorMeshes.length; i++) {
          const dir = i % 2 === 0 ? 1 : -1;
          this._rotorMeshes[i].rotation.z += dir * dt * 9.5;
        }
      }

      if (this._camAnim) {
        const now = performance.now();
        const t = Math.min(1, (now - this._camAnim.startTime) / this._camAnim.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        const dir = new THREE.Vector3().lerpVectors(this._camAnim.startDir, this._camAnim.targetDir, ease).normalize();
        const dist = this._camAnim.dist;
        this.camera.position.copy(dir.multiplyScalar(dist));
        this.camera.up.set(0, 0, 1);
        this.controls.target.set(0, 0, 0);
        if (t >= 1) this._camAnim = null;
      }

      this.controls.update();

      // 1. Render main 3D scene (clearing color, depth, and stencil buffer for silhouette contours)
      this.renderer.setViewport(0, 0, this.width, this.height);
      this.renderer.setScissor(0, 0, this.width, this.height);
      this.renderer.setScissorTest(false);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      // 2. Render Onshape / SolidWorks 3D ViewCube in top-right sub-viewport
      this._renderViewCube();
    };
    this._animate();
  }

  /**
   * Bright, shadow-free studio lighting so colors stay vivid and never look dark
   */
  _initLightsAndEnvironment() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 1.35);
    this.hemiLight.position.set(0, 0, 10);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    this.dirLight1.position.set(6, -6, 9);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0xffffff, 0.65);
    this.dirLight2.position.set(-6, 6, -5);
    this.scene.add(this.dirLight2);

    this.gridGroup = new THREE.Group();
    this.gridHelper = new THREE.GridHelper(6.4, 12, 0x94a3b8, 0xcbd5e1);
    this.gridHelper.rotation.x = Math.PI / 2;
    this.gridHelper.position.z = -2.35;
    this.gridGroup.add(this.gridHelper);
    this.scene.add(this.gridGroup);
  }

  _brightMat(hexColor, opacity = 1.0, emissiveFactor = 0.26) {
    return new THREE.MeshStandardMaterial({
      color: hexColor,
      emissive: hexColor,
      emissiveIntensity: emissiveFactor,
      roughness: 0.32,
      metalness: 0.05,
      transparent: opacity < 1.0,
      opacity
    });
  }

  _applyThemeColors() {
    if (this.isDark) {
      this.scene.background = new THREE.Color(0x1e293b);
      if (this.gridHelper && this.gridHelper.material) {
        this.gridHelper.material.opacity = 0.25;
        this.gridHelper.material.transparent = true;
      }
    } else {
      this.scene.background = new THREE.Color(0xf8fafc);
      if (this.gridHelper && this.gridHelper.material) {
        this.gridHelper.material.opacity = 0.45;
        this.gridHelper.material.transparent = true;
      }
    }
  }

  _initGroups() {
    this.gimbalRoot = new THREE.Group();
    this.worldFrameGroup = new THREE.Group();
    this.interFramesGroup = new THREE.Group();
    this.bodyFrameGroup = new THREE.Group();
    this.activeAxesGroup = new THREE.Group();
    this.sphereArcsGroup = new THREE.Group();
    this.rigidBodyGroup = new THREE.Group();

    this.scene.add(this.gimbalRoot);
    this.scene.add(this.worldFrameGroup);
    this.scene.add(this.interFramesGroup);
    this.scene.add(this.bodyFrameGroup);
    this.scene.add(this.activeAxesGroup);
    this.scene.add(this.sphereArcsGroup);
    this.scene.add(this.rigidBodyGroup);

    this._buildWorldFrame();
    this._buildUnitSphereWireframe();
    this._buildRigidBodyModel(this.currentModelType);
  }

  _makeTextSprite(text, colorHex = '#0284c7', scale = 0.38, bgAlpha = 0.95) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 320, 160);
    ctx.fillStyle = this.isDark ? `rgba(15, 23, 42, ${bgAlpha})` : `rgba(255, 255, 255, ${bgAlpha})`;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 9;
    const rx = 18, ry = 16, rw = 284, rh = 128, rad = 32;
    ctx.beginPath();
    ctx.moveTo(rx + rad, ry);
    ctx.lineTo(rx + rw - rad, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
    ctx.lineTo(rx + rw, ry + rh - rad);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
    ctx.lineTo(rx + rad, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
    ctx.lineTo(rx, ry + rad);
    ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = colorHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 84);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const baseSX = scale * 2.15;
    const baseSY = scale * 1.075;
    const mult = this.labelScale || 1.0;
    sprite.scale.set(baseSX * mult, baseSY * mult, 1);
    sprite.userData = { isLabelSprite: true, baseSX, baseSY };
    sprite.renderOrder = 999;
    return sprite;
  }

  _createTriadGroup({ length = 1.6, radius = 0.022, opacity = 1.0, dashed = false, labels = ['x̂', 'ŷ', 'ẑ'], labelScale = 0.34 }) {
    const group = new THREE.Group();
    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: AXIS_COLORS.x, hex: AXIS_HEX.x, label: labels[0] },
      { dir: new THREE.Vector3(0, 1, 0), color: AXIS_COLORS.y, hex: AXIS_HEX.y, label: labels[1] },
      { dir: new THREE.Vector3(0, 0, 1), color: AXIS_COLORS.z, hex: AXIS_HEX.z, label: labels[2] }
    ];

    for (const ax of axes) {
      const mat = this._brightMat(ax.color, opacity, 0.32);

      if (dashed) {
        const dashCount = 7;
        const step = (length - 0.18) / dashCount;
        for (let d = 0; d < dashCount; d++) {
          const segLen = step * 0.58;
          const geom = new THREE.CylinderGeometry(radius, radius, segLen, 12);
          const mesh = new THREE.Mesh(geom, mat);
          const pos = (d + 0.3) * step;
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.dir);
          mesh.quaternion.copy(q);
          mesh.position.copy(ax.dir).multiplyScalar(pos);
          group.add(mesh);
        }
      } else {
        const shaftLen = length - 0.16;
        const shaftGeom = new THREE.CylinderGeometry(radius, radius, shaftLen, 16);
        const shaft = new THREE.Mesh(shaftGeom, mat);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.dir);
        shaft.quaternion.copy(q);
        shaft.position.copy(ax.dir).multiplyScalar(shaftLen / 2);
        group.add(shaft);
      }

      const coneGeom = new THREE.ConeGeometry(radius * 2.8, 0.18, 18);
      const cone = new THREE.Mesh(coneGeom, mat);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.dir);
      cone.quaternion.copy(q);
      cone.position.copy(ax.dir).multiplyScalar(length - 0.08);
      group.add(cone);

      if (ax.label) {
        const sprite = this._makeTextSprite(ax.label, ax.hex, labelScale, opacity * 0.92);
        sprite.position.copy(ax.dir).multiplyScalar(length + 0.22);
        group.add(sprite);
      }
    }

    return group;
  }

  _buildWorldFrame() {
    this._clearGroup(this.worldFrameGroup);
    const triad = this._createTriadGroup({
      length: 2.25,
      radius: 0.02,
      opacity: 0.9,
      dashed: false,
      labels: ['x̂', 'ŷ', 'ẑ'],
      labelScale: 0.34
    });
    this.worldFrameGroup.add(triad);
  }

  _buildUnitSphereWireframe() {
    this._clearGroup(this.sphereArcsGroup);
    this.sphereStaticGroup = new THREE.Group();
    this.sphereDynamicGroup = new THREE.Group();
    this.sphereArcsGroup.add(this.sphereStaticGroup);
    this.sphereArcsGroup.add(this.sphereDynamicGroup);

    const sphereRadius = 1.15;
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, 32, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.04,
      depthWrite: false
    });
    this.sphereStaticGroup.add(new THREE.Mesh(sphereGeom, sphereMat));

    const circlePts = 96;
    const planes = [{ normal: 'z' }, { normal: 'x' }, { normal: 'y' }];
    for (const p of planes) {
      const pts = [];
      for (let i = 0; i <= circlePts; i++) {
        const a = (i / circlePts) * Math.PI * 2;
        if (p.normal === 'z') pts.push(new THREE.Vector3(Math.cos(a) * sphereRadius, Math.sin(a) * sphereRadius, 0));
        else if (p.normal === 'x') pts.push(new THREE.Vector3(0, Math.cos(a) * sphereRadius, Math.sin(a) * sphereRadius));
        else pts.push(new THREE.Vector3(Math.cos(a) * sphereRadius, 0, Math.sin(a) * sphereRadius));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(
        geom,
        new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.28 })
      );
      this.sphereStaticGroup.add(line);
    }
  }

  /**
   * Helper to add crisp neutral gray edge outlines to 3D object meshes
   */
  _addNeutralEdges(mesh, edgeColor = 0x64748b, opacity = 0.55) {
    const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 22);
    const edgesMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: opacity < 1.0,
      opacity
    });
    const line = new THREE.LineSegments(edgesGeom, edgesMat);
    mesh.add(line);
  }

  /**
   * 3D Game / CAD View-Dependent Stencil Silhouette Contour
   * Draws a screen-space silhouette outline strictly around the outer contour of the active/hovered group.
   */
  _createSilhouetteMaterial(hexColor = 0xfbbf24, thicknessNdc = 0.011) {
    const c = new THREE.Color(hexColor);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
        uThickness: { value: thicknessNdc }
      },
      vertexShader: `
        uniform float uThickness;
        void main() {
          vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec3 radialDir = length(position) > 0.001 ? normalize(position) : vec3(0.0, 0.0, 1.0);
          vec3 worldDir = normalize(normal + radialDir * 0.55);
          vec4 clipNormal = projectionMatrix * modelViewMatrix * vec4(worldDir, 0.0);
          vec2 screenOffset = length(clipNormal.xy) > 0.0001 ? normalize(clipNormal.xy) : vec2(1.0, 0.0);
          clipPos.xy += screenOffset * uThickness * clipPos.w;
          gl_Position = clipPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp
    });
  }

  _applyStencilSilhouette(rootGroup, isActive, outlineColorHex = 0xfbbf24, thicknessNdc = 0.012) {
    if (!rootGroup) return;

    // 1. Remove any previous silhouette clones
    const toRemove = [];
    rootGroup.traverse((child) => {
      if (child.userData && child.userData.isSilhouetteClone) {
        toRemove.push(child);
      }
    });
    for (const rem of toRemove) {
      if (rem.parent) rem.parent.remove(rem);
      if (rem.material) rem.material.dispose();
    }

    // 2. Configure stencil writing on solid meshes & attach screen-space silhouette hull when active
    const targetMeshes = [];
    rootGroup.traverse((child) => {
      if (
        child.isMesh &&
        !child.userData.isSilhouetteClone &&
        child.material &&
        child.material.opacity > 0.05
      ) {
        targetMeshes.push(child);
      }
    });

    for (const mesh of targetMeshes) {
      if (!isActive) {
        mesh.renderOrder = 1;
        mesh.material.stencilWrite = false;
      } else {
        mesh.renderOrder = 40;
        mesh.material.stencilWrite = true;
        mesh.material.stencilRef = 1;
        mesh.material.stencilFunc = THREE.AlwaysStencilFunc;
        mesh.material.stencilFail = THREE.KeepStencilOp;
        mesh.material.stencilZFail = THREE.KeepStencilOp;
        mesh.material.stencilZPass = THREE.ReplaceStencilOp;

        const silMesh = new THREE.Mesh(
          mesh.geometry,
          this._createSilhouetteMaterial(outlineColorHex, thicknessNdc)
        );
        silMesh.position.copy(mesh.position);
        silMesh.quaternion.copy(mesh.quaternion);
        silMesh.scale.copy(mesh.scale);
        silMesh.renderOrder = 45;
        silMesh.userData = { isSilhouetteClone: true };
        if (mesh.parent) {
          mesh.parent.add(silMesh);
        }
      }
    }
  }

  /**
   * Build the 3 selectable 3D models: 'drone' | 'box' | 'jet'
   * Strictly using pale, neutral pearl/silver/slate-gray tones (no red, green, or blue)
   * so they never visually compete with the colored coordinate axes or gimbal rings.
   */
  _buildRigidBodyModel(modelType) {
    this.currentModelType = modelType;
    this._clearGroup(this.rigidBodyGroup);
    this._rotorMeshes = [];

    const bodyMeshGroup = new THREE.Group();

    // Neutral monochrome palette (Pearl White -> Pale Silver -> Soft Slate Gray)
    const pearlLightMat = this._brightMat(0xf8fafc, 1.0, 0.22);
    const paleSilverMat = this._brightMat(0xe2e8f0, 1.0, 0.20);
    const midGrayMat = this._brightMat(0xcbd5e1, 1.0, 0.18);
    const slateGrayMat = this._brightMat(0x94a3b8, 1.0, 0.16);
    const darkNeutralMat = this._brightMat(0x64748b, 1.0, 0.14);

    if (modelType === 'drone') {
      // Pale & Neutral Gray Quadcopter Drone
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.12), pearlLightMat);
      this._addNeutralEdges(core, 0x64748b, 0.5);
      bodyMeshGroup.add(core);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), midGrayMat);
      dome.scale.set(1.35, 0.9, 0.68);
      dome.position.set(0.04, 0, 0.065);
      bodyMeshGroup.add(dome);

      // Neutral slate-gray forward nose pointer along +X
      const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 18), darkNeutralMat);
      noseCone.rotation.z = -Math.PI / 2;
      noseCone.position.set(0.34, 0, 0.01);
      bodyMeshGroup.add(noseCone);

      const armAngles = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, -(3 * Math.PI) / 4];
      const armLen = 0.72;
      for (let i = 0; i < 4; i++) {
        const ang = armAngles[i];
        const isFront = i < 2;
        const armGeom = new THREE.CylinderGeometry(0.026, 0.026, armLen, 12);
        const arm = new THREE.Mesh(armGeom, isFront ? slateGrayMat : midGrayMat);
        arm.rotation.z = ang - Math.PI / 2;
        arm.position.set((Math.cos(ang) * armLen) / 2, (Math.sin(ang) * armLen) / 2, 0);
        bodyMeshGroup.add(arm);

        const tipX = Math.cos(ang) * armLen;
        const tipY = Math.sin(ang) * armLen;
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.08, 16), paleSilverMat);
        motor.rotation.x = Math.PI / 2;
        motor.position.set(tipX, tipY, 0.03);
        bodyMeshGroup.add(motor);

        const rotorGroup = new THREE.Group();
        rotorGroup.position.set(tipX, tipY, 0.075);

        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.01, 24),
          new THREE.MeshBasicMaterial({
            color: isFront ? 0x94a3b8 : 0xcbd5e1,
            transparent: true,
            opacity: 0.36
          })
        );
        disc.rotation.x = Math.PI / 2;
        rotorGroup.add(disc);

        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.50, 0.044, 0.014),
          isFront ? darkNeutralMat : slateGrayMat
        );
        rotorGroup.add(blade);

        bodyMeshGroup.add(rotorGroup);
        this._rotorMeshes.push(rotorGroup);
      }
    } else if (modelType === 'box') {
      // Pale Architectural Gray Rectangular Prism with neutral shaded bevels
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 0.30), pearlLightMat);
      this._addNeutralEdges(block, 0x64748b, 0.65);
      bodyMeshGroup.add(block);

      // +X Front Plate (Medium Slate Gray + Forward Tapered Nose Wedge)
      const xFace = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.20), darkNeutralMat);
      xFace.position.set(0.435, 0, 0);
      bodyMeshGroup.add(xFace);

      const frontPointer = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), darkNeutralMat);
      frontPointer.rotation.z = -Math.PI / 2;
      frontPointer.rotation.x = Math.PI / 4;
      frontPointer.position.set(0.52, 0, 0);
      bodyMeshGroup.add(frontPointer);

      // +Y Side Panel (Soft Mid Gray)
      const yFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.20), slateGrayMat);
      yFace.position.set(0, 0.285, 0);
      bodyMeshGroup.add(yFace);

      // +Z Top Deck Panel (Pale Silver Gray)
      const zFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.40, 0.03), midGrayMat);
      zFace.position.set(0, 0, 0.155);
      this._addNeutralEdges(zFace, 0x64748b, 0.45);
      bodyMeshGroup.add(zFace);
    } else if (modelType === 'jet') {
      // Pale Silver-Gray & Slate Monochrome Jet Fighter
      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.135, 0.96, 20), paleSilverMat);
      fuselage.rotation.z = -Math.PI / 2;
      bodyMeshGroup.add(fuselage);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.44, 20), darkNeutralMat);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(0.70, 0, 0);
      bodyMeshGroup.add(nose);

      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), slateGrayMat);
      canopy.scale.set(2.4, 0.88, 0.92);
      canopy.position.set(0.22, 0, 0.07);
      bodyMeshGroup.add(canopy);

      const wingShape = new THREE.Shape();
      wingShape.moveTo(0.26, 0);
      wingShape.lineTo(-0.38, 0.74);
      wingShape.lineTo(-0.46, 0.74);
      wingShape.lineTo(-0.42, 0);
      wingShape.lineTo(-0.46, -0.74);
      wingShape.lineTo(-0.38, -0.74);
      wingShape.closePath();

      const wingGeom = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.026,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.006
      });
      wingGeom.translate(0, 0, -0.013);
      const wing = new THREE.Mesh(wingGeom, pearlLightMat);
      this._addNeutralEdges(wing, 0x64748b, 0.5);
      bodyMeshGroup.add(wing);

      // Neutral gray wingtip pods
      const tipRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.036, 0.036), darkNeutralMat);
      tipRight.position.set(-0.41, 0.74, 0);
      bodyMeshGroup.add(tipRight);

      const tipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.036, 0.036), darkNeutralMat);
      tipLeft.position.set(-0.41, -0.74, 0);
      bodyMeshGroup.add(tipLeft);

      const tailShape = new THREE.Shape();
      tailShape.moveTo(-0.12, 0);
      tailShape.lineTo(-0.44, 0.34);
      tailShape.lineTo(-0.50, 0.34);
      tailShape.lineTo(-0.46, 0);
      tailShape.closePath();
      const tailGeom = new THREE.ExtrudeGeometry(tailShape, { depth: 0.024, bevelEnabled: false });
      tailGeom.translate(0, 0, -0.012);
      const tailFin = new THREE.Mesh(tailGeom, midGrayMat);
      this._addNeutralEdges(tailFin, 0x64748b, 0.55);
      tailFin.rotation.x = Math.PI / 2;
      bodyMeshGroup.add(tailFin);
    }

    // Invisible bounding sphere for effortless mouse picking on the 3D object
    const hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 16, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
    );
    hitSphere.userData = { hitType: 'object' };
    bodyMeshGroup.add(hitSphere);

    bodyMeshGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData = { hitType: 'object' };
      }
    });

    this.rigidBodyGroup.add(bodyMeshGroup);
  }

  _createGimbalRingMesh({ ringIndex, radius, tubeRadius, color, outerAxis, outerMountRadius, innerAxis, innerMountRadius }) {
    const group = new THREE.Group();
    const isHighlighted =
      (this.dragState && this.dragState.type === 'gimbal' && this.dragState.ringIndex === ringIndex) ||
      (this.hoveredTarget && this.hoveredTarget.hitType === 'gimbal' && this.hoveredTarget.ringIndex === ringIndex);
    const mat = this._brightMat(color, 1.0, isHighlighted ? 0.55 : 0.30);

    const vOuter = new THREE.Vector3(...unitAxisVector(outerAxis));
    const vInner = innerAxis ? new THREE.Vector3(...unitAxisVector(innerAxis)) : null;

    let normal = new THREE.Vector3();
    if (vInner && vOuter.distanceTo(vInner) > 0.01) {
      normal.crossVectors(vOuter, vInner).normalize();
    }
    if (normal.lengthSq() < 0.1) {
      if (Math.abs(vOuter.z) < 0.9) normal.set(0, 0, 1).cross(vOuter).normalize();
      else normal.set(1, 0, 0);
    }

    const qTorus = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    const bandHalf = 0.19;
    const rIn = radius - bandHalf;
    const rOut = radius + bandHalf;

    if (this.gimbalStyle === 'sheet') {
      // Saturn-Style Flat Annular Planar Ring (RingGeometry with open center hole + concentric bands)
      const baseAnnulusGeom = new THREE.RingGeometry(rIn, rOut, 96);
      const baseAnnulusMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isHighlighted ? 0.42 : 0.24,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const baseAnnulus = new THREE.Mesh(baseAnnulusGeom, baseAnnulusMat);
      baseAnnulus.quaternion.copy(qTorus);
      baseAnnulus.userData = { hitType: 'gimbal', ringIndex };
      group.add(baseAnnulus);

      // Saturn Cassini-style concentric high-contrast sub-bands
      const band1Geom = new THREE.RingGeometry(radius - 0.135, radius - 0.025, 96);
      const band2Geom = new THREE.RingGeometry(radius + 0.025, radius + 0.135, 96);
      const subBandMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isHighlighted ? 0.68 : 0.45,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const band1 = new THREE.Mesh(band1Geom, subBandMat);
      band1.quaternion.copy(qTorus);
      band1.userData = { hitType: 'gimbal', ringIndex };
      group.add(band1);

      const band2 = new THREE.Mesh(band2Geom, subBandMat);
      band2.quaternion.copy(qTorus);
      band2.userData = { hitType: 'gimbal', ringIndex };
      group.add(band2);

      // Crisp inner and outer 3D rim edges on the Saturn ring
      const outerRimGeom = new THREE.TorusGeometry(rOut, isHighlighted ? tubeRadius * 0.55 : tubeRadius * 0.42, 16, 84);
      const outerRim = new THREE.Mesh(outerRimGeom, mat);
      outerRim.quaternion.copy(qTorus);
      outerRim.userData = { hitType: 'gimbal', ringIndex };
      group.add(outerRim);

      const innerRimGeom = new THREE.TorusGeometry(rIn, isHighlighted ? tubeRadius * 0.48 : tubeRadius * 0.36, 16, 84);
      const innerRim = new THREE.Mesh(innerRimGeom, mat);
      innerRim.quaternion.copy(qTorus);
      innerRim.userData = { hitType: 'gimbal', ringIndex };
      group.add(innerRim);
    } else {
      // Standard 3D Tubular Ring representation
      const torusGeom = new THREE.TorusGeometry(radius, isHighlighted ? tubeRadius * 1.18 : tubeRadius, 22, 80);
      const torus = new THREE.Mesh(torusGeom, mat);
      torus.quaternion.copy(qTorus);
      torus.userData = { hitType: 'gimbal', ringIndex };
      group.add(torus);
    }

    // Generous invisible hit-torus so grabbing a gimbal ring with the mouse is effortless
    const hitTorusGeom = new THREE.TorusGeometry(
      radius,
      this.gimbalStyle === 'sheet' ? bandHalf : tubeRadius * 2.7,
      14,
      48
    );
    const hitTorusMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
    const hitTorus = new THREE.Mesh(hitTorusGeom, hitTorusMat);
    hitTorus.quaternion.copy(qTorus);
    hitTorus.userData = { hitType: 'gimbal', ringIndex };
    group.add(hitTorus);

    if (outerMountRadius > radius) {
      const startR = this.gimbalStyle === 'sheet' ? rOut : radius;
      const endR =
        this.gimbalStyle === 'sheet'
          ? ringIndex === 0
            ? outerMountRadius + 0.06
            : outerMountRadius - bandHalf
          : outerMountRadius;
      const pinLen = Math.max(0.06, endR - startR + 0.03);
      for (const sgn of [-1, 1]) {
        const pinGeom = new THREE.CylinderGeometry(tubeRadius * 0.85, tubeRadius * 0.85, pinLen, 14);
        const pin = new THREE.Mesh(pinGeom, mat);
        const qPin = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vOuter);
        pin.quaternion.copy(qPin);
        pin.position.copy(vOuter).multiplyScalar(sgn * (startR + pinLen / 2 - 0.01));
        pin.userData = { hitType: 'gimbal', ringIndex };
        group.add(pin);
      }
    }

    if (vInner && innerMountRadius && radius > innerMountRadius) {
      const collarR = this.gimbalStyle === 'sheet' ? rIn : radius - 0.02;
      const bearingMat = this._brightMat(0xe2e8f0, 1.0, 0.25);
      for (const sgn of [-1, 1]) {
        const collarGeom = new THREE.CylinderGeometry(tubeRadius * 1.35, tubeRadius * 1.35, 0.065, 16);
        const collar = new THREE.Mesh(collarGeom, bearingMat);
        const qCollar = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vInner);
        collar.quaternion.copy(qCollar);
        collar.position.copy(vInner).multiplyScalar(sgn * collarR);
        group.add(collar);
      }
    }

    return group;
  }

  _mat3ToThreeMat4(R) {
    const m = new THREE.Matrix4();
    m.set(
      R[0][0], R[0][1], R[0][2], 0,
      R[1][0], R[1][1], R[1][2], 0,
      R[2][0], R[2][1], R[2][2], 0,
      0, 0, 0, 1
    );
    return m;
  }

  _threeMat4ToMat3(m4) {
    const e = m4.elements;
    // THREE.Matrix4 is column-major
    return [
      [e[0], e[4], e[8]],
      [e[1], e[5], e[9]],
      [e[2], e[6], e[10]]
    ];
  }

  /**
   * Build the Onshape / SolidWorks style interactive 3D ViewCube + Axis Triad widget
   */
  _makeViewCubeFaceTexture(label, accentHex, highlighted = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Chamfered face background
    ctx.fillStyle = highlighted ? '#e0f2fe' : '#f1f5f9';
    ctx.fillRect(0, 0, 256, 256);

    // Outer border
    ctx.strokeStyle = highlighted ? '#0284c7' : '#94a3b8';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 246);

    // Subtle bottom accent bar indicating axis family
    ctx.fillStyle = accentHex;
    ctx.fillRect(26, 214, 204, 14);

    // Crisp CAD label
    ctx.fillStyle = highlighted ? '#0369a1' : '#1e293b';
    ctx.font = 'bold 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 124);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  _initViewCube() {
    this.viewCubeScene = new THREE.Scene();
    this.viewCubeCamera = new THREE.OrthographicCamera(-1.62, 1.62, 1.62, -1.62, 0.1, 20);
    this.viewCubeCamera.up.set(0, 0, 1);

    const amb = new THREE.AmbientLight(0xffffff, 1.25);
    this.viewCubeScene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.65);
    dir.position.set(4, -4, 6);
    this.viewCubeScene.add(dir);

    this.viewCubePickables = [];
    const cubeGroup = new THREE.Group();

    // Inner chamfered bevel core
    const coreGeom = new THREE.BoxGeometry(1.18, 1.18, 1.18);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.4,
      metalness: 0.08
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this._addNeutralEdges(coreMesh, 0x64748b, 0.65);
    cubeGroup.add(coreMesh);

    // 6 Explicit Face Plates oriented right-side up in Z-Up world
    const faceSpecs = [
      {
        label: 'FRONT',
        title: 'Front View (+X)',
        dir: [1, 0, 0],
        pos: [0.60, 0, 0],
        normal: [1, 0, 0],
        up: [0, 0, 1],
        accent: '#ff0000'
      },
      {
        label: 'BACK',
        title: 'Back View (-X)',
        dir: [-1, 0, 0],
        pos: [-0.60, 0, 0],
        normal: [-1, 0, 0],
        up: [0, 0, 1],
        accent: '#ff0000'
      },
      {
        label: 'RIGHT',
        title: 'Right View (+Y)',
        dir: [0, 1, 0],
        pos: [0, 0.60, 0],
        normal: [0, 1, 0],
        up: [0, 0, 1],
        accent: '#00cc00'
      },
      {
        label: 'LEFT',
        title: 'Left View (-Y)',
        dir: [0, -1, 0],
        pos: [0, -0.60, 0],
        normal: [0, -1, 0],
        up: [0, 0, 1],
        accent: '#00cc00'
      },
      {
        label: 'TOP',
        title: 'Top View (+Z)',
        dir: [0.001, -0.001, 1],
        pos: [0, 0, 0.60],
        normal: [0, 0, 1],
        up: [-1, 0, 0],
        accent: '#0055ff'
      },
      {
        label: 'BOTTOM',
        title: 'Bottom View (-Z)',
        dir: [0.001, -0.001, -1],
        pos: [0, 0, -0.60],
        normal: [0, 0, -1],
        up: [1, 0, 0],
        accent: '#0055ff'
      }
    ];

    for (const f of faceSpecs) {
      const texNormal = this._makeViewCubeFaceTexture(f.label, f.accent, false);
      const texHover = this._makeViewCubeFaceTexture(f.label, f.accent, true);
      const mat = new THREE.MeshBasicMaterial({ map: texNormal });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), mat);

      const nVec = new THREE.Vector3(...f.normal);
      const uVec = new THREE.Vector3(...f.up);
      const rVec = new THREE.Vector3().crossVectors(uVec, nVec).normalize();
      const rotMat = new THREE.Matrix4().makeBasis(rVec, uVec, nVec);
      plane.quaternion.setFromRotationMatrix(rotMat);
      plane.position.set(...f.pos);

      plane.userData = {
        vcType: 'face',
        title: f.title,
        dir: f.dir,
        texNormal,
        texHover
      };
      cubeGroup.add(plane);
      this.viewCubePickables.push(plane);
    }

    // 8 Clickable Isometric Corner Hotspots
    const cornerSigns = [-1, 1];
    for (const sx of cornerSigns) {
      for (const sy of cornerSigns) {
        for (const sz of cornerSigns) {
          const cMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), cMat);
          cMesh.position.set(sx * 0.52, sy * 0.52, sz * 0.52);
          cMesh.userData = {
            vcType: 'corner',
            title: `Isometric Corner (${sx > 0 ? '+X' : '-X'}, ${sy > 0 ? '+Y' : '-Y'}, ${sz > 0 ? '+Z' : '-Z'})`,
            dir: [sx, sy, sz],
            baseColor: 0x94a3b8,
            hoverColor: 0x0ea5e9
          };
          cubeGroup.add(cMesh);
          this.viewCubePickables.push(cMesh);
        }
      }
    }

    // 3D Coordinate Axis Triad anchored at (-0.68, -0.68, -0.68)
    const triadOrigin = new THREE.Vector3(-0.66, -0.66, -0.66);
    const triadAxes = [
      { dir: new THREE.Vector3(1, 0, 0), color: AXIS_COLORS.x, hex: AXIS_HEX.x, lbl: 'X' },
      { dir: new THREE.Vector3(0, 1, 0), color: AXIS_COLORS.y, hex: AXIS_HEX.y, lbl: 'Y' },
      { dir: new THREE.Vector3(0, 0, 1), color: AXIS_COLORS.z, hex: AXIS_HEX.z, lbl: 'Z' }
    ];
    const axisLen = 0.78;
    for (const ax of triadAxes) {
      const mat = new THREE.MeshBasicMaterial({ color: ax.color });
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, axisLen, 12), mat);
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.dir);
      cyl.position.copy(triadOrigin).addScaledVector(ax.dir, axisLen / 2);
      cubeGroup.add(cyl);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 14), mat);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.dir);
      cone.position.copy(triadOrigin).addScaledVector(ax.dir, axisLen + 0.05);
      cubeGroup.add(cone);

      const sp = this._makeTextSprite(ax.lbl, ax.hex, 0.26, 0.95);
      sp.position.copy(triadOrigin).addScaledVector(ax.dir, axisLen + 0.28);
      cubeGroup.add(sp);
    }

    // Subtle circular orbit ring around the ViewCube base
    const ringGeom = new THREE.RingGeometry(0.95, 1.06, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.38
    });
    const baseRing = new THREE.Mesh(ringGeom, ringMat);
    baseRing.position.z = -0.64;
    cubeGroup.add(baseRing);

    this.viewCubeScene.add(cubeGroup);
  }

  _renderViewCube() {
    if (!this.viewCubeScene || !this.viewCubeCamera) return;
    const camDir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.viewCubeCamera.position.copy(camDir.multiplyScalar(5.0));
    this.viewCubeCamera.up.copy(this.camera.up);
    this.viewCubeCamera.lookAt(0, 0, 0);

    const vcX = Math.max(0, this.width - this.vcSize - this.vcMarginRight);
    const vcY = Math.max(0, this.height - this.vcSize - this.vcMarginTop);

    this.renderer.setViewport(vcX, vcY, this.vcSize, this.vcSize);
    this.renderer.setScissor(vcX, vcY, this.vcSize, this.vcSize);
    this.renderer.setScissorTest(true);
    this.renderer.clearDepth();
    this.renderer.render(this.viewCubeScene, this.viewCubeCamera);
    this.renderer.setScissorTest(false);
  }

  _pickViewCubeTarget(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const vcLeft = this.width - this.vcSize - this.vcMarginRight;
    const vcTop = this.vcMarginTop;

    if (
      localX < vcLeft ||
      localX > vcLeft + this.vcSize ||
      localY < vcTop ||
      localY > vcTop + this.vcSize
    ) {
      return null;
    }

    const ndcX = ((localX - vcLeft) / this.vcSize) * 2 - 1;
    const ndcY = -((localY - vcTop) / this.vcSize) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.viewCubeCamera);

    const hits = this.raycaster.intersectObjects(this.viewCubePickables, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  _setViewCubeHover(mesh) {
    if (this.vcHoveredMesh === mesh) return;
    if (this.vcHoveredMesh) {
      const ud = this.vcHoveredMesh.userData;
      if (ud.vcType === 'face') {
        this.vcHoveredMesh.material.map = ud.texNormal;
        this.vcHoveredMesh.material.needsUpdate = true;
      } else if (ud.vcType === 'corner') {
        this.vcHoveredMesh.material.color.setHex(ud.baseColor);
      }
    }
    this.vcHoveredMesh = mesh;
    if (mesh) {
      const ud = mesh.userData;
      if (ud.vcType === 'face') {
        mesh.material.map = ud.texHover;
        mesh.material.needsUpdate = true;
      } else if (ud.vcType === 'corner') {
        mesh.material.color.setHex(ud.hoverColor);
      }
    }
  }

  _animateCameraTo(dirArray) {
    const dist = this.camera.position.distanceTo(this.controls.target) || 6.4;
    const startDir = this.camera.position.clone().sub(this.controls.target).normalize();
    const targetDir = new THREE.Vector3(...dirArray).normalize();
    this._camAnim = {
      startTime: performance.now(),
      duration: 260,
      startDir,
      targetDir,
      dist
    };
  }

  /**
   * Project a 3D world point to 2D canvas pixel coordinates
   */
  _worldToScreenPx(vec3World) {
    const v = vec3World.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height
    };
  }

  /**
   * Raycast mouse pointer against Gimbal Rings and Center 3D Object
   */
  _pickInteractiveTarget(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const candidates = [];
    if (this.layers.gimbals && this.gimbalRoot.visible) {
      candidates.push(this.gimbalRoot);
    }
    candidates.push(this.rigidBodyGroup);

    const hits = this.raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      const ud = hit.object.userData;
      if (ud && !ud.isSilhouetteClone && (ud.hitType === 'gimbal' || ud.hitType === 'object')) {
        return {
          hitType: ud.hitType,
          ringIndex: ud.ringIndex,
          pointWorld: hit.point.clone()
        };
      }
    }
    return null;
  }

  /**
   * Initialize direct mouse manipulation for 3D Orientation & Gimbal Rings
   */
  _initMouseInteraction() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      // 1. Check if clicking on the Onshape/SolidWorks 3D ViewCube
      const vcHit = this._pickViewCubeTarget(e.clientX, e.clientY);
      if (vcHit) {
        this._animateCameraTo(vcHit.userData.dir);
        return;
      }

      if (this.mouseMode === 'camera') {
        return; // OrbitControls handles it
      }

      if (this.mouseMode === 'object') {
        this.controls.enabled = false;
        this.dragState = {
          type: 'object',
          lastX: e.clientX,
          lastY: e.clientY
        };
        dom.style.cursor = 'grabbing';
        dom.setPointerCapture(e.pointerId);
        if (this.onHoverChange) this.onHoverChange({ hitType: 'object', dragging: true });
        if (this.lastState) this.updateScene(this.lastState);
        return;
      }

      // Smart mode: check if clicking on a Gimbal Ring or the Center 3D Object
      const picked = this._pickInteractiveTarget(e.clientX, e.clientY);
      if (!picked) {
        return; // Background drag -> OrbitControls orbits camera
      }

      this.controls.enabled = false;
      dom.style.cursor = 'grabbing';
      dom.setPointerCapture(e.pointerId);

      if (picked.hitType === 'gimbal') {
        this.dragState = {
          type: 'gimbal',
          ringIndex: picked.ringIndex,
          hitPointWorld: picked.pointWorld,
          lastX: e.clientX,
          lastY: e.clientY
        };
      } else {
        this.dragState = {
          type: 'object',
          lastX: e.clientX,
          lastY: e.clientY
        };
      }

      if (this.onHoverChange) {
        this.onHoverChange({ ...picked, dragging: true });
      }
      if (this.lastState) this.updateScene(this.lastState);
    });

    dom.addEventListener('pointermove', (e) => {
      if (this.dragState) {
        const dx = e.clientX - this.dragState.lastX;
        const dy = e.clientY - this.dragState.lastY;
        this.dragState.lastX = e.clientX;
        this.dragState.lastY = e.clientY;

        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return;

        if (this.dragState.type === 'gimbal') {
          const idx = this.dragState.ringIndex;
          const axisWorld = (this.activeAxesWorld[idx] || new THREE.Vector3(0, 0, 1)).clone().normalize();
          const pHit = this.dragState.hitPointWorld;

          // Instantaneous velocity vector of the grabbed ring point for +dAngle around axisWorld
          const tangentWorld = new THREE.Vector3().crossVectors(axisWorld, pHit);
          let deltaDeg = 0;

          if (tangentWorld.lengthSq() > 1e-4) {
            tangentWorld.normalize();
            const p0 = this._worldToScreenPx(pHit);
            const p1 = this._worldToScreenPx(pHit.clone().addScaledVector(tangentWorld, 0.25));
            const sdx = p1.x - p0.x;
            const sdy = p1.y - p0.y;
            const sLen = Math.hypot(sdx, sdy);

            if (sLen > 1.5) {
              const tx = sdx / sLen;
              const ty = sdy / sLen;
              const projPx = dx * tx + dy * ty;
              deltaDeg = projPx * 0.65;
            } else {
              deltaDeg = dx * 0.65;
            }
          } else {
            deltaDeg = dx * 0.65;
          }

          // Rotate the virtual grab point along with the ring so continuous circular dragging works seamlessly
          const dRad = (deltaDeg * Math.PI) / 180;
          this.dragState.hitPointWorld.applyAxisAngle(axisWorld, dRad);

          if (this.onInteraction) {
            this.onInteraction({
              type: 'gimbal',
              ringIndex: idx,
              deltaDeg
            });
          }
        } else if (this.dragState.type === 'object') {
          // 3D screen-space trackball rotation applied to current rigid-body orientation R
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();

          const rotAxis = new THREE.Vector3()
            .addScaledVector(camUp, dx)
            .addScaledVector(camRight, dy);

          if (rotAxis.lengthSq() > 1e-6) {
            rotAxis.normalize();
            const rotAngleRad = Math.hypot(dx, dy) * 0.0082;
            const dQ = new THREE.Quaternion().setFromAxisAngle(rotAxis, rotAngleRad);

            const m4Current = this._mat3ToThreeMat4(this.currentR);
            const qCurrent = new THREE.Quaternion().setFromRotationMatrix(m4Current);
            const qNew = dQ.multiply(qCurrent).normalize();

            const m4New = new THREE.Matrix4().makeRotationFromQuaternion(qNew);
            const R_new = this._threeMat4ToMat3(m4New);

            if (this.onInteraction) {
              this.onInteraction({
                type: 'object',
                R_new
              });
            }
          }
        }
        return;
      }

      // Not currently dragging: first check ViewCube hover
      const vcHit = this._pickViewCubeTarget(e.clientX, e.clientY);
      this._setViewCubeHover(vcHit);
      if (vcHit) {
        dom.style.cursor = 'pointer';
        if (this.onHoverChange) {
          this.onHoverChange({ hitType: 'viewcube', title: vcHit.userData.title, dragging: false });
        }
        return;
      }

      if (this.mouseMode === 'camera') {
        dom.style.cursor = 'default';
        return;
      }
      if (this.mouseMode === 'object') {
        dom.style.cursor = 'grab';
        return;
      }

      const picked = this._pickInteractiveTarget(e.clientX, e.clientY);
      const prevHover = this.hoveredTarget;
      this.hoveredTarget = picked;
      dom.style.cursor = picked ? 'grab' : 'default';

      const prevKey = prevHover ? `${prevHover.hitType}-${prevHover.ringIndex}` : 'none';
      const nextKey = picked ? `${picked.hitType}-${picked.ringIndex}` : 'none';
      if (prevKey !== nextKey) {
        if (this.onHoverChange) this.onHoverChange(picked ? { ...picked, dragging: false } : null);
        if (this.lastState) this.updateScene(this.lastState);
      }
    });

    const endDrag = (e) => {
      if (!this.dragState) return;
      this.dragState = null;
      this.controls.enabled = this.mouseMode !== 'object';
      if (e && e.pointerId !== undefined && dom.hasPointerCapture(e.pointerId)) {
        dom.releasePointerCapture(e.pointerId);
      }
      dom.style.cursor = this.mouseMode === 'object' || this.hoveredTarget ? 'grab' : 'default';
      if (this.onHoverChange) {
        this.onHoverChange(this.hoveredTarget ? { ...this.hoveredTarget, dragging: false } : null);
      }
      if (this.lastState) this.updateScene(this.lastState);
    };

    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);
    dom.addEventListener('pointerleave', (e) => {
      if (!this.dragState && this.hoveredTarget) {
        this.hoveredTarget = null;
        dom.style.cursor = this.mouseMode === 'object' ? 'grab' : 'default';
        if (this.onHoverChange) this.onHoverChange(null);
        if (this.lastState) this.updateScene(this.lastState);
      }
    });
  }

  setMouseMode(mode) {
    this.mouseMode = mode; // 'smart' | 'object' | 'camera'
    this.controls.enabled = mode !== 'object';
    this.renderer.domElement.style.cursor = mode === 'object' ? 'grab' : 'default';
  }

  /**
   * Update the 3D scene for sequence seqId, anglesRad = [ϕ, θ, ψ],
   * stepProgress ∈ [0, 3], and stepMode = 'intrinsic' | 'extrinsic'
   */
  updateScene(state) {
    this.lastState = state;
    const { seqId, anglesRad, stepProgress = 3.0, stepMode = 'intrinsic' } = state;
    const seq = SEQUENCES[seqId];
    const [a1, a2, a3] = seq.axes;

    const s1 = Math.max(0, Math.min(1, stepProgress));
    const s2 = Math.max(0, Math.min(1, stepProgress - 1));
    const s3 = Math.max(0, Math.min(1, stepProgress - 2));

    let phiActive, thetaActive, psiActive;
    let F1_mat, F2_mat, F3_mat;

    if (stepMode === 'intrinsic') {
      // Intrinsic progression: 1st ϕ about a1, 2nd θ about a2', 3rd ψ about a3''
      phiActive = anglesRad[0] * s1;
      thetaActive = anglesRad[1] * s2;
      psiActive = anglesRad[2] * s3;

      const R1 = elementaryRotationMatrix(a1, phiActive);
      const R2 = elementaryRotationMatrix(a2, thetaActive);
      const R3 = elementaryRotationMatrix(a3, psiActive);
      F1_mat = R1;
      F2_mat = matMul3(R1, R2);
      F3_mat = matMul3(F2_mat, R3);
    } else {
      // Equivalent Extrinsic (Fixed-Frame) progression:
      // 1st rotate by ψ about fixed a3, 2nd by θ about fixed a2, 3rd by ϕ about fixed a1
      // Notice at stepProgress = 3.0: F3_mat = R_{a1}(ϕ) * R_{a2}(θ) * R_{a3}(ψ), 100% identical!
      psiActive = anglesRad[2] * s1;
      thetaActive = anglesRad[1] * s2;
      phiActive = anglesRad[0] * s3;

      const R3 = elementaryRotationMatrix(a3, psiActive);
      const R2 = elementaryRotationMatrix(a2, thetaActive);
      const R1 = elementaryRotationMatrix(a1, phiActive);
      F1_mat = R3;
      F2_mat = matMul3(R2, R3);
      F3_mat = matMul3(R1, F2_mat);
    }

    const R_m1 = elementaryRotationMatrix(a1, phiActive);
    const R_m12 = matMul3(R_m1, elementaryRotationMatrix(a2, thetaActive));
    const R_m123 = matMul3(R_m12, elementaryRotationMatrix(a3, psiActive));

    const e1Vec = unitAxisVector(a1);
    const e2Vec = matVec3(R_m1, unitAxisVector(a2));
    const e3Vec = matVec3(R_m12, unitAxisVector(a3));

    this.currentR = F3_mat;
    this.activeAxesWorld = [
      new THREE.Vector3(...e1Vec),
      new THREE.Vector3(...e2Vec),
      new THREE.Vector3(...e3Vec)
    ];

    // 1. Update Rigid Body orientation & view-dependent silhouette contour when selected/hovered
    this.rigidBodyGroup.matrixAutoUpdate = false;
    this.rigidBodyGroup.matrix.copy(this._mat3ToThreeMat4(F3_mat));
    this.rigidBodyGroup.updateMatrixWorld(true);

    const isObjectSelected =
      (this.dragState && this.dragState.type === 'object') ||
      (!this.dragState && this.hoveredTarget && this.hoveredTarget.hitType === 'object');
    const objOutlineColor = this.dragState && this.dragState.type === 'object' ? 0xf59e0b : 0x0ea5e9;
    this._applyStencilSilhouette(this.rigidBodyGroup, isObjectSelected, objOutlineColor, 0.013);

    // 2. Update 3-axis Concentric Gimbal Rings (or Planar Sheets) with wide radial separation
    this._clearGroup(this.gimbalRoot);
    this.gimbalRoot.visible = this.layers.gimbals;
    if (this.layers.gimbals) {
      const rOuter = 2.24;
      const rMiddle = 1.72;
      const rInner = 1.20;
      const tube = 0.038;

      const ring1Mesh = this._createGimbalRingMesh({
        ringIndex: 0,
        radius: rOuter,
        tubeRadius: tube,
        color: GIMBAL_RING_COLORS.outer[a1],
        outerAxis: a1,
        outerMountRadius: 2.46,
        innerAxis: a2,
        innerMountRadius: rMiddle
      });
      ring1Mesh.matrixAutoUpdate = false;
      ring1Mesh.matrix.copy(this._mat3ToThreeMat4(R_m1));
      ring1Mesh.updateMatrixWorld(true);

      const ring2Mesh = this._createGimbalRingMesh({
        ringIndex: 1,
        radius: rMiddle,
        tubeRadius: tube,
        color: GIMBAL_RING_COLORS.middle[a2],
        outerAxis: a2,
        outerMountRadius: rOuter,
        innerAxis: a3,
        innerMountRadius: rInner
      });
      ring2Mesh.matrixAutoUpdate = false;
      ring2Mesh.matrix.copy(this._mat3ToThreeMat4(R_m12));
      ring2Mesh.updateMatrixWorld(true);

      const ring3Mesh = this._createGimbalRingMesh({
        ringIndex: 2,
        radius: rInner,
        tubeRadius: tube,
        color: GIMBAL_RING_COLORS.inner[a3],
        outerAxis: a3,
        outerMountRadius: rMiddle,
        innerAxis: a2,
        innerMountRadius: null
      });
      ring3Mesh.matrixAutoUpdate = false;
      ring3Mesh.matrix.copy(this._mat3ToThreeMat4(R_m123));
      ring3Mesh.updateMatrixWorld(true);

      const ringsArr = [ring1Mesh, ring2Mesh, ring3Mesh];
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const isRingSelected =
          (this.dragState && this.dragState.type === 'gimbal' && this.dragState.ringIndex === rIdx) ||
          (!this.dragState &&
            this.hoveredTarget &&
            this.hoveredTarget.hitType === 'gimbal' &&
            this.hoveredTarget.ringIndex === rIdx);
        if (isRingSelected) {
          this._applyStencilSilhouette(ringsArr[rIdx], true, 0xfbbf24, 0.012);
        }
        this.gimbalRoot.add(ringsArr[rIdx]);
      }
      this.gimbalRoot.updateMatrixWorld(true);
    }

    // 3. World Frame
    this.worldFrameGroup.visible = this.layers.worldFrame;

    // 4. Intermediate Frames F1' and F2''
    this._clearGroup(this.interFramesGroup);
    this.interFramesGroup.visible = this.layers.interFrames;
    if (this.layers.interFrames) {
      const f1Triad = this._createTriadGroup({
        length: 1.55,
        radius: 0.015,
        opacity: 0.65,
        dashed: true,
        labels: ["x̂'", "ŷ'", "ẑ'"],
        labelScale: 0.28
      });
      f1Triad.matrixAutoUpdate = false;
      f1Triad.matrix.copy(this._mat3ToThreeMat4(F1_mat));

      const f2Triad = this._createTriadGroup({
        length: 1.4,
        radius: 0.015,
        opacity: 0.78,
        dashed: true,
        labels: ["x̂''", "ŷ''", "ẑ''"],
        labelScale: 0.28
      });
      f2Triad.matrixAutoUpdate = false;
      f2Triad.matrix.copy(this._mat3ToThreeMat4(F2_mat));

      this.interFramesGroup.add(f1Triad);
      this.interFramesGroup.add(f2Triad);
    }

    // 5. Body Frame F3
    this._clearGroup(this.bodyFrameGroup);
    this.bodyFrameGroup.visible = this.layers.bodyFrame;
    if (this.layers.bodyFrame) {
      const f3Triad = this._createTriadGroup({
        length: 1.5,
        radius: 0.025,
        opacity: 1.0,
        dashed: false,
        labels: ["x̂'''", "ŷ'''", "ẑ'''"],
        labelScale: 0.34
      });
      f3Triad.matrixAutoUpdate = false;
      f3Triad.matrix.copy(this._mat3ToThreeMat4(F3_mat));
      this.bodyFrameGroup.add(f3Triad);
    }

    // 6. Active Rotation Axes {ê₁, ê₂', ê₃''} and Gimbal Lock Collinearity Beam
    this._clearGroup(this.activeAxesGroup);
    this.activeAxesGroup.visible = this.layers.activeAxes;
    const e1 = unitAxisVector(a1);
    const e2 = matVec3(R_m1, unitAxisVector(a2));
    const e3 = matVec3(R_m12, unitAxisVector(a3));

    const dot13 = Math.max(-1, Math.min(1, e1[0] * e3[0] + e1[1] * e3[1] + e1[2] * e3[2]));
    const sin13 = Math.sqrt(Math.max(0, 1 - dot13 * dot13));
    const isNearGimbalLock = sin13 < 0.15;

    if (this.layers.activeAxes) {
      const axisSpecs = [
        { vec: e1, axisChar: a1 },
        { vec: e2, axisChar: a2 },
        { vec: e3, axisChar: a3 }
      ];

      for (const spec of axisSpecs) {
        const v = new THREE.Vector3(...spec.vec).normalize();
        const pts = [v.clone().multiplyScalar(-2.25), v.clone().multiplyScalar(2.25)];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: AXIS_COLORS[spec.axisChar],
          transparent: true,
          opacity: 0.8
        });
        this.activeAxesGroup.add(new THREE.Line(geom, lineMat));
      }

      if (isNearGimbalLock) {
        const vLock = new THREE.Vector3(...e1).normalize();
        const beamGeom = new THREE.CylinderGeometry(0.055, 0.055, 4.6, 20);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.5
        });
        const beam = new THREE.Mesh(beamGeom, beamMat);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vLock);
        this.activeAxesGroup.add(beam);

        const lockSprite = this._makeTextSprite(
          dot13 > 0 ? "GIMBAL LOCK (ê₁ = +ê₃'')" : "GIMBAL LOCK (ê₁ = -ê₃'')",
          '#d97706',
          0.42,
          0.95
        );
        lockSprite.position.copy(vLock).multiplyScalar(2.45);
        this.activeAxesGroup.add(lockSprite);
      }
    }

    // 7. Spherical Arcs on Unit Sphere
    this.sphereArcsGroup.visible = this.layers.sphereArcs;
    if (this.sphereDynamicGroup) {
      this._clearGroup(this.sphereDynamicGroup);
      if (this.layers.sphereArcs) {
        const arcRadii = [1.16, 1.12, 1.08];
        const mAngles = [phiActive, thetaActive, psiActive];
        const mAxes = [a1, a2, a3];
        const rotTransforms = [
          [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
          ],
          R_m1,
          R_m12
        ];

        for (let stepIdx = 0; stepIdx < 3; stepIdx++) {
          const ang = mAngles[stepIdx];
          if (Math.abs(ang) < 0.02) continue;
          const axChar = mAxes[stepIdx];
          const rArc = arcRadii[stepIdx];
          const parentR = rotTransforms[stepIdx];

          const refLocal = axChar === 'z' ? [1, 0, 0] : axChar === 'y' ? [0, 0, 1] : [0, 1, 0];
          const segs = 36;
          const pts = [];
          for (let s = 0; s <= segs; s++) {
            const a = (s / segs) * ang;
            const R_local = elementaryRotationMatrix(axChar, a);
            const pLocal = matVec3(R_local, refLocal);
            const pWorld = matVec3(parentR, pLocal);
            pts.push(new THREE.Vector3(pWorld[0] * rArc, pWorld[1] * rArc, pWorld[2] * rArc));
          }
          const arcGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const arcLine = new THREE.Line(
            arcGeom,
            new THREE.LineBasicMaterial({ color: AXIS_COLORS[axChar], linewidth: 2 })
          );
          this.sphereDynamicGroup.add(arcLine);
        }
      }
    }
  }

  setLayerVisibility(layerKey, visible) {
    this.layers[layerKey] = visible;
    if (this.lastState) this.updateScene(this.lastState);
  }

  setGimbalStyle(style) {
    this.gimbalStyle = style; // 'ring' | 'sheet'
    if (this.lastState) this.updateScene(this.lastState);
  }

  setLabelScale(scale) {
    this.labelScale = Math.max(0.5, Math.min(2.6, scale));
    this.scene.traverse((obj) => {
      if (obj.isSprite && obj.userData && obj.userData.isLabelSprite) {
        obj.scale.set(
          obj.userData.baseSX * this.labelScale,
          obj.userData.baseSY * this.labelScale,
          1
        );
      }
    });
  }

  getCameraState() {
    return {
      pos: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
      orthoZoom: this.orthoCamera.zoom
    };
  }

  setCameraState(camState) {
    if (!camState) return;
    if (Array.isArray(camState.pos) && camState.pos.length === 3) {
      this.perspCamera.position.set(camState.pos[0], camState.pos[1], camState.pos[2]);
      this.orthoCamera.position.set(camState.pos[0], camState.pos[1], camState.pos[2]);
    }
    if (Array.isArray(camState.target) && camState.target.length === 3) {
      this.controls.target.set(camState.target[0], camState.target[1], camState.target[2]);
    }
    if (typeof camState.orthoZoom === 'number' && camState.orthoZoom > 0.1) {
      this.orthoCamera.zoom = camState.orthoZoom;
      this.orthoCamera.updateProjectionMatrix();
    }
    this.controls.update();
  }

  setProjectionMode(isOrtho) {
    if (this.isOrtho === isOrtho) return;
    const prevCam = this.camera;
    const nextCam = isOrtho ? this.orthoCamera : this.perspCamera;

    nextCam.position.copy(prevCam.position);
    nextCam.up.copy(prevCam.up);
    nextCam.quaternion.copy(prevCam.quaternion);

    this.isOrtho = isOrtho;
    this.camera = nextCam;
    this.controls.object = this.camera;
    this.controls.update();
    this.resize();
  }

  setModelType(modelType) {
    this._buildRigidBodyModel(modelType);
    if (this.lastState) this.updateScene(this.lastState);
  }

  setCameraPreset(preset) {
    if (preset === 'iso') {
      this._animateCameraTo([1, -0.95, 0.7]);
    } else if (preset === 'top') {
      this._animateCameraTo([0.001, -0.001, 1]);
    } else if (preset === 'front') {
      this._animateCameraTo([1, 0, 0]);
    } else if (preset === 'side') {
      this._animateCameraTo([0, 1, 0]);
    }
  }

  resize() {
    if (!this.container) return;
    this.width = this.container.clientWidth || 960;
    this.height = this.container.clientHeight || 650;
    const aspect = this.width / this.height;

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    this.orthoCamera.left = (-this.orthoFrustum * aspect) / 2;
    this.orthoCamera.right = (this.orthoFrustum * aspect) / 2;
    this.orthoCamera.top = this.orthoFrustum / 2;
    this.orthoCamera.bottom = -this.orthoFrustum / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  _clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
  }
}

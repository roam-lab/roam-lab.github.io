/**
 * Universal 3D Euler Angles, Rotation Sequences & Gimbal Lock Application Controller
 */

import {
  SYMBOLS,
  SEQUENCES,
  DEG2RAD,
  RAD2DEG,
  wrapDeg,
  computeEulerForward,
  generateSymbolicMatrix,
  solveEulerInverse,
  rotationMatrixToAxisAngleAndQuaternion
} from './euler-math.js';
import { EulerScene3D } from './euler-scene.js';

class EulerAnglesApp {
  constructor() {
    this.state = {
      seqId: 'ZYZ',
      anglesDeg: [40, 55, 30], // [ϕ, θ, ψ]
      stepProgress: 3.0,
      stepMode: 'intrinsic', // 'intrinsic' | 'extrinsic' (for step-by-step animation playback)
      matrixViewMode: 'combined', // 'combined' | 'numeric' | 'compact' | 'full'
      nullDeltaDeg: 0
    };

    this.nullBaseAnglesDeg = [...this.state.anglesDeg];
    this.animatingStep = false;
    this.animatingNull = false;

    const canvasContainer = document.getElementById('euler-canvas-container');
    if (!canvasContainer) return;

    this.storageKey = 'roam_euler_angles_session_v1';
    this.scene3D = new EulerScene3D(canvasContainer);
    this._bind3DMouseCallbacks();
    this._bindUI();
    this._loadSessionState();
    this.renderAll();
  }

  _saveSessionState() {
    if (this._restoringSession) return;
    try {
      const canvasWrap = document.getElementById('ea-canvas-wrap');
      const payload = {
        seqId: this.state.seqId,
        anglesDeg: this.state.anglesDeg,
        stepProgress: this.state.stepProgress,
        stepMode: this.state.stepMode,
        matrixViewMode: this.state.matrixViewMode,
        modelType: this.scene3D.currentModelType,
        mouseMode: this.scene3D.mouseMode,
        isOrtho: this.scene3D.isOrtho,
        gimbalStyle: this.scene3D.gimbalStyle,
        layers: { ...this.scene3D.layers },
        labelScale: this.scene3D.labelScale,
        viewportHeight: canvasWrap ? canvasWrap.clientHeight : 650,
        cameraState: this.scene3D.getCameraState()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (e) {
      // Ignore storage quota / private browsing errors
    }
  }

  _loadSessionState() {
    this._restoringSession = true;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        this._restoringSession = false;
        return;
      }
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') {
        this._restoringSession = false;
        return;
      }

      if (saved.seqId && SEQUENCES[saved.seqId]) {
        this.state.seqId = saved.seqId;
      }
      if (Array.isArray(saved.anglesDeg) && saved.anglesDeg.length === 3) {
        this.state.anglesDeg = saved.anglesDeg.map((v) => (Number.isFinite(v) ? wrapDeg(v) : 0));
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
      }
      if (typeof saved.stepProgress === 'number' && Number.isFinite(saved.stepProgress)) {
        this.state.stepProgress = Math.max(0, Math.min(3, saved.stepProgress));
      }
      if (saved.stepMode === 'intrinsic' || saved.stepMode === 'extrinsic') {
        this.state.stepMode = saved.stepMode;
        document.querySelectorAll('[data-step-mode]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-step-mode') === this.state.stepMode)
        );
      }
      if (['combined', 'numeric', 'compact', 'full'].includes(saved.matrixViewMode)) {
        this.state.matrixViewMode = saved.matrixViewMode;
        document.querySelectorAll('[data-mat-view]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-mat-view') === this.state.matrixViewMode)
        );
      }
      if (['drone', 'box', 'jet'].includes(saved.modelType)) {
        this.scene3D.setModelType(saved.modelType);
        document.querySelectorAll('[data-model-type]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-model-type') === saved.modelType)
        );
      }
      if (['smart', 'object', 'camera'].includes(saved.mouseMode)) {
        this.scene3D.setMouseMode(saved.mouseMode);
        document.querySelectorAll('[data-mouse-mode]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-mouse-mode') === saved.mouseMode)
        );
      }
      if (typeof saved.isOrtho === 'boolean') {
        this.scene3D.setProjectionMode(saved.isOrtho);
        const projModeBtn = document.getElementById('ea-proj-mode-btn');
        const projModeLabel = document.getElementById('ea-proj-mode-label');
        if (projModeBtn) projModeBtn.classList.toggle('active', saved.isOrtho);
        if (projModeLabel) projModeLabel.textContent = saved.isOrtho ? 'Ortho' : 'Persp';
      }
      if (saved.gimbalStyle === 'ring' || saved.gimbalStyle === 'sheet') {
        this.scene3D.setGimbalStyle(saved.gimbalStyle);
        const gimbalStyleBtn = document.getElementById('ea-gimbal-style-btn');
        const gimbalStyleLabel = document.getElementById('ea-gimbal-style-label');
        if (gimbalStyleBtn) gimbalStyleBtn.classList.toggle('active', saved.gimbalStyle === 'sheet');
        if (gimbalStyleLabel) {
          gimbalStyleLabel.textContent = saved.gimbalStyle === 'ring' ? 'Style: Ring' : 'Style: Sheet';
        }
      }
      if (saved.layers && typeof saved.layers === 'object') {
        for (const [key, val] of Object.entries(saved.layers)) {
          if (typeof val === 'boolean' && key in this.scene3D.layers) {
            this.scene3D.layers[key] = val;
          }
        }
        document.querySelectorAll('[data-layer-btn]').forEach((btn) => {
          const key = btn.getAttribute('data-layer-btn');
          btn.classList.toggle('active', !!this.scene3D.layers[key]);
        });
      }
      if (typeof saved.labelScale === 'number' && Number.isFinite(saved.labelScale)) {
        this.scene3D.setLabelScale(saved.labelScale);
      }
      if (typeof saved.viewportHeight === 'number' && saved.viewportHeight >= 380 && saved.viewportHeight <= 1020) {
        const canvasWrap = document.getElementById('ea-canvas-wrap');
        if (canvasWrap) {
          canvasWrap.style.height = `${saved.viewportHeight}px`;
          this.scene3D.resize();
        }
      }
      if (saved.cameraState) {
        this.scene3D.setCameraState(saved.cameraState);
      }
    } catch (e) {
      // Ignore parse errors
    }
    this._restoringSession = false;
  }

  _bind3DMouseCallbacks() {
    this.scene3D.onInteraction = (evt) => {
      this._stopAnimations();
      this.state.stepProgress = 3.0;
      this.state.nullDeltaDeg = 0;

      if (evt.type === 'gimbal') {
        const idx = evt.ringIndex;
        const nextVal = wrapDeg(this.state.anglesDeg[idx] + evt.deltaDeg);
        this.state.anglesDeg[idx] = Math.round(nextVal * 10) / 10;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      } else if (evt.type === 'object') {
        const inv = solveEulerInverse(evt.R_new, this.state.seqId);
        const prev = this.state.anglesDeg;

        if (inv.manipulability < 0.015) {
          // Near Gimbal Lock: keep ψ continuous and solve ϕ from the coupled angle
          const psiKeep = prev[2];
          const phiCoupled =
            inv.singularType === 'sum'
              ? wrapDeg(inv.coupledAngleDeg - psiKeep)
              : wrapDeg(inv.coupledAngleDeg + psiKeep);
          this.state.anglesDeg = [
            Math.round(phiCoupled * 10) / 10,
            Math.round(inv.sol1Deg[1] * 10) / 10,
            Math.round(psiKeep * 10) / 10
          ];
        } else {
          // Pick whichever closed-form Euler branch (sol1 vs sol2) is closest to current (ϕ, θ, ψ)
          const d1 = Math.hypot(
            wrapDeg(inv.sol1Deg[0] - prev[0]),
            wrapDeg(inv.sol1Deg[1] - prev[1]),
            wrapDeg(inv.sol1Deg[2] - prev[2])
          );
          const d2 = Math.hypot(
            wrapDeg(inv.sol2Deg[0] - prev[0]),
            wrapDeg(inv.sol2Deg[1] - prev[1]),
            wrapDeg(inv.sol2Deg[2] - prev[2])
          );
          const best = d1 <= d2 ? inv.sol1Deg : inv.sol2Deg;
          this.state.anglesDeg = best.map((v) => Math.round(v * 10) / 10);
        }

        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      }
    };

    this.scene3D.onHoverChange = (info) => {
      const noteEl = document.getElementById('ea-hud-note');
      if (!noteEl) return;
      const seq = SEQUENCES[this.state.seqId];
      const [a1, a2, a3] = seq.axes;
      const ringLabels = [
        `Outer Gimbal Ring (1st Angle ϕ about ${a1}̂)`,
        `Middle Gimbal Ring (2nd Angle θ about ${a2}̂')`,
        `Inner Gimbal Ring (3rd Angle ψ about ${a3}̂'')`
      ];

      if (!info) {
        if (this.scene3D.mouseMode === 'object') {
          noteEl.textContent = `Mouse Mode: Drag anywhere to rotate 3D object & solve ${seq.name} angles (ϕ, θ, ψ)`;
        } else if (this.scene3D.mouseMode === 'camera') {
          noteEl.textContent = `Mouse Mode: Left-drag to orbit 3D camera · Scroll to zoom · Right-drag to pan`;
        } else {
          noteEl.textContent = `Drag Object to rotate 3D orientation (solves ϕ, θ, ψ) · Drag Gimbal Rings for single angles · Click ViewCube for standard views`;
        }
        return;
      }

      if (info.hitType === 'viewcube') {
        noteEl.textContent = `ViewCube: Click to align camera to ${info.title}`;
        return;
      }

      const verb = info.dragging ? 'Rotating' : 'Click & drag';
      if (info.hitType === 'gimbal') {
        noteEl.textContent = `${verb} ${ringLabels[info.ringIndex]}`;
      } else if (info.hitType === 'object') {
        noteEl.textContent = `${verb} 3D Object → Live ${seq.name} Euler Angles (ϕ, θ, ψ)`;
      }
    };
  }

  /**
   * Build radial tick marks, perimeter 30° snap targets, and bind drag (Ctrl=30° snap), wheel, and double-click on the 3 Rotary Knobs
   */
  _initRotaryKnobs() {
    const snapAngles = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];

    for (let idx = 0; idx < 3; idx++) {
      const ticksGroup = document.getElementById(`ea-knob-ticks-${idx}`);
      if (ticksGroup) {
        let ticksHtml = '';
        for (let deg = 0; deg < 360; deg += 15) {
          const isCardinal = deg % 90 === 0;
          const isMajor = deg % 30 === 0;
          const rad = ((deg - 90) * Math.PI) / 180;
          const rOuter = 69.5;
          const rInner = isCardinal ? 62.0 : isMajor ? 64.2 : 66.5;
          const x1 = (105 + rInner * Math.cos(rad)).toFixed(2);
          const y1 = (105 + rInner * Math.sin(rad)).toFixed(2);
          const x2 = (105 + rOuter * Math.cos(rad)).toFixed(2);
          const y2 = (105 + rOuter * Math.sin(rad)).toFixed(2);
          const sw = isCardinal ? 2.0 : isMajor ? 1.4 : 0.9;
          const op = isCardinal ? 0.9 : isMajor ? 0.65 : 0.35;
          ticksHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${sw}" opacity="${op}" />`;
        }
        ticksGroup.innerHTML = ticksHtml;
      }

      const snapsGroup = document.getElementById(`ea-knob-snaps-${idx}`);
      if (snapsGroup) {
        let snapsHtml = '';
        const rSnap = 84.5;
        for (const deg of snapAngles) {
          const rad = ((deg - 90) * Math.PI) / 180;
          const sx = 105 + rSnap * Math.cos(rad);
          const sy = 105 + rSnap * Math.sin(rad);
          const label = deg === 0 ? '0°' : deg === 180 ? '±180°' : `${deg > 0 ? '+' : ''}${deg}°`;
          const pillW = deg === 180 ? 34 : 28;
          snapsHtml += `
            <g class="ea-knob-snap-node" data-snap-angle="${deg}">
              <rect class="ea-knob-snap-pill" x="${(sx - pillW / 2).toFixed(1)}" y="${(sy - 7.5).toFixed(1)}" width="${pillW}" height="15" />
              <text class="ea-knob-snap-text" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}">${label}</text>
            </g>`;
        }
        snapsGroup.innerHTML = snapsHtml;

        snapsGroup.querySelectorAll('.ea-knob-snap-node').forEach((node) => {
          node.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const snapVal = parseFloat(node.getAttribute('data-snap-angle'));
            this._stopAnimations();
            this.state.anglesDeg[idx] = snapVal;
            this.state.stepProgress = 3.0;
            this.state.nullDeltaDeg = 0;
            this.nullBaseAnglesDeg = [...this.state.anglesDeg];
            this.renderAll();
          });
        });
      }

      const svgEl = document.getElementById(`ea-knob-svg-${idx}`);
      if (!svgEl) continue;

      let draggingKnob = false;

      const updateAngleFromPointer = (e) => {
        const rect = svgEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        if (Math.hypot(dx, dy) < 5) return;

        // 12 o'clock (dx=0, dy<0) is 0°, clockwise is positive (+90° at 3 o'clock), counter-clockwise is negative (-90° at 9 o'clock)
        let angleDeg = Math.atan2(dx, -dy) * RAD2DEG;
        if (e.ctrlKey || e.metaKey) {
          angleDeg = Math.round(angleDeg / 30) * 30;
        } else {
          const step = e.shiftKey ? 0.1 : 0.5;
          angleDeg = Math.round(angleDeg / step) * step;
        }

        this._stopAnimations();
        this.state.anglesDeg[idx] = angleDeg === -180 ? 180 : wrapDeg(angleDeg);
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      };

      svgEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.ea-knob-snap-node')) return;
        e.preventDefault();
        draggingKnob = true;
        svgEl.setPointerCapture(e.pointerId);
        updateAngleFromPointer(e);
      });

      svgEl.addEventListener('pointermove', (e) => {
        if (!draggingKnob) return;
        updateAngleFromPointer(e);
      });

      const stopKnobDrag = (e) => {
        if (!draggingKnob) return;
        draggingKnob = false;
        if (e && e.pointerId !== undefined && svgEl.hasPointerCapture(e.pointerId)) {
          svgEl.releasePointerCapture(e.pointerId);
        }
      };

      svgEl.addEventListener('pointerup', stopKnobDrag);
      svgEl.addEventListener('pointercancel', stopKnobDrag);

      // Mouse wheel over the knob increments/decrements the angle
      svgEl.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const dir = e.deltaY < 0 ? 1 : -1;
          this._stopAnimations();
          if (e.ctrlKey || e.metaKey) {
            const snapped = Math.round(this.state.anglesDeg[idx] / 30) * 30 + dir * 30;
            this.state.anglesDeg[idx] = wrapDeg(snapped);
          } else {
            const step = e.shiftKey ? 0.5 : 1.0;
            this.state.anglesDeg[idx] = wrapDeg(
              Math.round((this.state.anglesDeg[idx] + dir * step) * 10) / 10
            );
          }
          this.state.stepProgress = 3.0;
          this.state.nullDeltaDeg = 0;
          this.nullBaseAnglesDeg = [...this.state.anglesDeg];
          this.renderAll();
        },
        { passive: false }
      );

      // Double-click knob to zero that angle
      svgEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.ea-knob-snap-node')) return;
        this._stopAnimations();
        this.state.anglesDeg[idx] = 0;
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    }
  }

  _updateRotaryKnobVisual(idx, degVal, axChar) {
    const colorMap = {
      x: '#ff0000',
      y: '#00cc00',
      z: '#0055ff'
    };
    const strokeColor = colorMap[axChar] || '#0ea5e9';

    const rotor = document.getElementById(`ea-knob-rotor-${idx}`);
    if (rotor) {
      rotor.setAttribute('transform', `rotate(${degVal.toFixed(2)} 105 105)`);
    }

    const lineEl = document.getElementById(`ea-knob-line-${idx}`);
    if (lineEl) lineEl.style.stroke = strokeColor;

    const dotEl = document.getElementById(`ea-knob-dot-${idx}`);
    if (dotEl) dotEl.style.fill = strokeColor;

    const textEl = document.getElementById(`ea-knob-text-${idx}`);
    if (textEl) {
      textEl.textContent = `${degVal > 0 ? '+' : ''}${degVal.toFixed(1)}°`;
    }

    const arcEl = document.getElementById(`ea-knob-arc-${idx}`);
    if (arcEl) {
      arcEl.style.stroke = strokeColor;
      const r = 56;
      const absDeg = Math.min(179.9, Math.abs(degVal));
      if (absDeg < 0.3) {
        arcEl.setAttribute('d', '');
      } else {
        const startX = 105;
        const startY = 105 - r;
        const endRad = ((degVal - 90) * Math.PI) / 180;
        const endX = 105 + r * Math.cos(endRad);
        const endY = 105 + r * Math.sin(endRad);
        const largeArc = absDeg > 180 ? 1 : 0;
        const sweepFlag = degVal >= 0 ? 1 : 0;
        arcEl.setAttribute(
          'd',
          `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${endX.toFixed(2)} ${endY.toFixed(2)}`
        );
      }
    }

    // Highlight active perimeter snap node if current angle matches
    const snapsGroup = document.getElementById(`ea-knob-snaps-${idx}`);
    if (snapsGroup) {
      snapsGroup.querySelectorAll('.ea-knob-snap-node').forEach((node) => {
        const snapDeg = parseFloat(node.getAttribute('data-snap-angle'));
        const isMatch =
          Math.abs(wrapDeg(degVal - snapDeg)) < 0.25 ||
          (snapDeg === 180 && Math.abs(Math.abs(degVal) - 180) < 0.25);
        node.classList.toggle('active', isMatch);
      });
    }
  }

  _bindUI() {
    // 1. Sequence buttons (6 Proper Euler + 6 Tait-Bryan)
    document.querySelectorAll('.ea-seq-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seqId = btn.getAttribute('data-seq');
        if (SEQUENCES[seqId]) {
          this._stopAnimations();
          this.state.seqId = seqId;
          this.state.stepProgress = 3.0;
          this.state.nullDeltaDeg = 0;
          this.nullBaseAnglesDeg = [...this.state.anglesDeg];
          this.renderAll();
        }
      });
    });

    this.scene3D.onCameraChange = () => {
      this._saveSessionState();
    };

    // 2. Center 3D Model buttons (Drone | Box | Jet Fighter)
    document.querySelectorAll('[data-model-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const model = btn.getAttribute('data-model-type');
        this.scene3D.setModelType(model);
        document.querySelectorAll('[data-model-type]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-model-type') === model)
        );
        this._saveSessionState();
      });
    });

    // 2b. Mouse Drag Mode buttons (Smart | Rotate Object | Orbit Camera)
    document.querySelectorAll('[data-mouse-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mouse-mode');
        this.scene3D.setMouseMode(mode);
        document.querySelectorAll('[data-mouse-mode]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-mouse-mode') === mode)
        );
        if (this.scene3D.onHoverChange) this.scene3D.onHoverChange(null);
        this._saveSessionState();
      });
    });

    // 3. 3D Axis Label Font Size -/+ buttons & Isometric Home button next to 3D ViewCube
    const fontDecBtn = document.getElementById('ea-font-dec-btn');
    const fontIncBtn = document.getElementById('ea-font-inc-btn');
    if (fontDecBtn) {
      fontDecBtn.addEventListener('click', () => {
        this.scene3D.setLabelScale((this.scene3D.labelScale || 1.0) - 0.15);
        this._saveSessionState();
      });
    }
    if (fontIncBtn) {
      fontIncBtn.addEventListener('click', () => {
        this.scene3D.setLabelScale((this.scene3D.labelScale || 1.0) + 0.15);
        this._saveSessionState();
      });
    }

    document.querySelectorAll('[data-cam-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.scene3D.setCameraPreset(btn.getAttribute('data-cam-preset'));
        setTimeout(() => this._saveSessionState(), 360);
      });
    });

    // 4. Right-Side Onshape/SolidWorks CAD Display Dock buttons
    document.querySelectorAll('[data-layer-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-layer-btn');
        const nextVis = !this.scene3D.layers[key];
        this.scene3D.setLayerVisibility(key, nextVis);
        btn.classList.toggle('active', nextVis);
        this._saveSessionState();
      });
    });

    // 4b. Orthographic vs Perspective Projection Toggle
    const projModeBtn = document.getElementById('ea-proj-mode-btn');
    const projModeLabel = document.getElementById('ea-proj-mode-label');
    if (projModeBtn) {
      projModeBtn.addEventListener('click', () => {
        const nextOrtho = !this.scene3D.isOrtho;
        this.scene3D.setProjectionMode(nextOrtho);
        projModeBtn.classList.toggle('active', nextOrtho);
        if (projModeLabel) {
          projModeLabel.textContent = nextOrtho ? 'Ortho' : 'Persp';
        }
        this._saveSessionState();
      });
    }

    // 4c. Gimbal Style Toggle (Ring vs Saturn-Style Planar Ring)
    const gimbalStyleBtn = document.getElementById('ea-gimbal-style-btn');
    const gimbalStyleLabel = document.getElementById('ea-gimbal-style-label');
    if (gimbalStyleBtn) {
      gimbalStyleBtn.addEventListener('click', () => {
        const nextStyle = this.scene3D.gimbalStyle === 'ring' ? 'sheet' : 'ring';
        this.scene3D.setGimbalStyle(nextStyle);
        gimbalStyleBtn.classList.toggle('active', nextStyle === 'sheet');
        if (gimbalStyleLabel) {
          gimbalStyleLabel.textContent = nextStyle === 'ring' ? 'Style: Ring' : 'Style: Sheet';
        }
        this._saveSessionState();
      });
    }

    // 5. Slick Bottom 3D Viewport Height Resizer + Expand Toggle
    const canvasWrap = document.getElementById('ea-canvas-wrap');
    const resizer = document.getElementById('ea-viewport-resizer');
    const expandBtn = document.getElementById('ea-viewport-expand-btn');

    if (resizer && canvasWrap) {
      let resizing = false;
      let startY = 0;
      let startH = 650;

      resizer.addEventListener('pointerdown', (e) => {
        if (e.target.closest('#ea-viewport-expand-btn')) return;
        e.preventDefault();
        resizing = true;
        startY = e.clientY;
        startH = canvasWrap.clientHeight;
        resizer.classList.add('dragging');
        resizer.setPointerCapture(e.pointerId);
      });

      resizer.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const newH = Math.max(380, Math.min(1000, startH + (e.clientY - startY)));
        canvasWrap.style.height = `${newH}px`;
        this.scene3D.resize();
      });

      const endResize = (e) => {
        if (!resizing) return;
        resizing = false;
        resizer.classList.remove('dragging');
        if (e && e.pointerId !== undefined && resizer.hasPointerCapture(e.pointerId)) {
          resizer.releasePointerCapture(e.pointerId);
        }
        this._saveSessionState();
      };

      resizer.addEventListener('pointerup', endResize);
      resizer.addEventListener('pointercancel', endResize);
    }

    if (expandBtn && canvasWrap) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const curH = canvasWrap.clientHeight;
        const targetH = curH < 760 ? 860 : 650;
        canvasWrap.style.height = `${targetH}px`;
        this.scene3D.resize();
        this._saveSessionState();
      });
    }

    // Initialize the 3 interactive Rotary Knobs
    this._initRotaryKnobs();

    // 6. Step-by-step scrubber & playback mode (Intrinsic vs Equivalent Extrinsic)
    const stepSlider = document.getElementById('ea-step-slider');
    if (stepSlider) {
      stepSlider.addEventListener('input', (e) => {
        this._stopAnimations();
        this.state.stepProgress = parseFloat(e.target.value);
        this.renderAll();
      });
    }

    document.querySelectorAll('[data-step-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._stopAnimations();
        this.state.stepProgress = parseFloat(btn.getAttribute('data-step-jump'));
        this.renderAll();
      });
    });

    document.querySelectorAll('[data-step-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.stepMode = btn.getAttribute('data-step-mode');
        document.querySelectorAll('[data-step-mode]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-step-mode') === this.state.stepMode)
        );
        this.renderAll();
      });
    });

    const playStepBtn = document.getElementById('ea-play-steps-btn');
    if (playStepBtn) {
      playStepBtn.addEventListener('click', () => this._toggleStepAnimation());
    }

    // 7. Angle sliders (ϕ, θ, ψ), numeric inputs, and quick snap buttons
    for (let idx = 0; idx < 3; idx++) {
      const slider = document.getElementById(`ea-slider-${idx}`);
      const numInput = document.getElementById(`ea-num-${idx}`);

      if (slider) {
        slider.addEventListener('input', (e) => {
          this._stopAnimations();
          this.state.anglesDeg[idx] = parseFloat(e.target.value);
          this.state.stepProgress = 3.0;
          this.state.nullDeltaDeg = 0;
          this.nullBaseAnglesDeg = [...this.state.anglesDeg];
          this.renderAll();
        });
      }

      if (numInput) {
        numInput.addEventListener('change', (e) => {
          this._stopAnimations();
          const val = parseFloat(e.target.value);
          if (!Number.isNaN(val)) {
            this.state.anglesDeg[idx] = wrapDeg(val);
            this.state.stepProgress = 3.0;
            this.state.nullDeltaDeg = 0;
            this.nullBaseAnglesDeg = [...this.state.anglesDeg];
            this.renderAll();
          }
        });
      }
    }

    document.querySelectorAll('[data-snap-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._stopAnimations();
        const idx = parseInt(btn.getAttribute('data-snap-idx'), 10);
        const val = parseFloat(btn.getAttribute('data-snap-val'));
        this.state.anglesDeg[idx] = val;
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    });

    const resetBtn = document.getElementById('ea-reset-angles-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._stopAnimations();
        this.state.anglesDeg = [0, 0, 0];
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [0, 0, 0];
        this.renderAll();
      });
    }

    const randomBtn = document.getElementById('ea-random-angles-btn');
    if (randomBtn) {
      randomBtn.addEventListener('click', () => {
        this._stopAnimations();
        const rnd = () => Math.round((Math.random() * 320 - 160) / 5) * 5;
        this.state.anglesDeg = [rnd(), rnd(), rnd()];
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    }

    // 8. Gimbal Lock Pole Trigger buttons & Null-Space Coupled Slider
    const lockPole1Btn = document.getElementById('ea-trigger-lock-1');
    const lockPole2Btn = document.getElementById('ea-trigger-lock-2');

    if (lockPole1Btn) {
      lockPole1Btn.addEventListener('click', () => {
        this._stopAnimations();
        const seq = SEQUENCES[this.state.seqId];
        this.state.anglesDeg[1] = seq.type === 'proper' ? 0 : 90;
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    }

    if (lockPole2Btn) {
      lockPole2Btn.addEventListener('click', () => {
        this._stopAnimations();
        const seq = SEQUENCES[this.state.seqId];
        this.state.anglesDeg[1] = seq.type === 'proper' ? 180 : -90;
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    }

    const nullSlider = document.getElementById('ea-nullspace-slider');
    if (nullSlider) {
      nullSlider.addEventListener('input', (e) => {
        if (this.animatingNull) this._stopAnimations();
        const delta = parseFloat(e.target.value);
        this._applyNullSpaceDelta(delta);
      });
    }

    const spinNullBtn = document.getElementById('ea-spin-nullspace-btn');
    if (spinNullBtn) {
      spinNullBtn.addEventListener('click', () => this._toggleNullSpaceAnimation());
    }

    // 9. Dual Solutions Swap Button
    const swapSolBtn = document.getElementById('ea-swap-solution-btn');
    if (swapSolBtn) {
      swapSolBtn.addEventListener('click', () => {
        if (!this.lastInverse) return;
        this._stopAnimations();
        const cur = this.state.anglesDeg;
        const s1 = this.lastInverse.sol1Deg;
        const s2 = this.lastInverse.sol2Deg;
        const dist1 = Math.hypot(
          wrapDeg(cur[0] - s1[0]),
          wrapDeg(cur[1] - s1[1]),
          wrapDeg(cur[2] - s1[2])
        );
        const target = dist1 < 2.0 ? s2 : s1;
        this.state.anglesDeg = target.map((v) => Math.round(v * 100) / 100);
        this.state.stepProgress = 3.0;
        this.state.nullDeltaDeg = 0;
        this.nullBaseAnglesDeg = [...this.state.anglesDeg];
        this.renderAll();
      });
    }

    // 10. Matrix View Mode buttons
    document.querySelectorAll('[data-mat-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.matrixViewMode = btn.getAttribute('data-mat-view');
        document.querySelectorAll('[data-mat-view]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-mat-view') === this.state.matrixViewMode)
        );
        this.renderAll();
      });
    });
  }

  _applyNullSpaceDelta(deltaDeg) {
    this.state.nullDeltaDeg = deltaDeg;
    const sign3 = this.lastInverse && this.lastInverse.singularType === 'diff' ? +1 : -1;
    this.state.anglesDeg[0] = wrapDeg(this.nullBaseAnglesDeg[0] + deltaDeg);
    this.state.anglesDeg[2] = wrapDeg(this.nullBaseAnglesDeg[2] + sign3 * deltaDeg);
    this.renderAll();
  }

  _stopAnimations() {
    if (this._stepAnimFrame) cancelAnimationFrame(this._stepAnimFrame);
    if (this._nullAnimFrame) cancelAnimationFrame(this._nullAnimFrame);
    this.animatingStep = false;
    this.animatingNull = false;
    const playStepBtn = document.getElementById('ea-play-steps-btn');
    if (playStepBtn) playStepBtn.innerHTML = '<i class="fa-solid fa-play"></i> Animate Steps';
    const spinNullBtn = document.getElementById('ea-spin-nullspace-btn');
    if (spinNullBtn) spinNullBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Spin Null-Space';
  }

  _toggleStepAnimation() {
    if (this.animatingStep) {
      this._stopAnimations();
      return;
    }
    this._stopAnimations();
    this.animatingStep = true;
    this.state.stepProgress = 0;
    const playStepBtn = document.getElementById('ea-play-steps-btn');
    if (playStepBtn) playStepBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

    let lastTs = performance.now();
    const tick = (now) => {
      if (!this.animatingStep) return;
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      this.state.stepProgress += dt * 0.72;
      if (this.state.stepProgress >= 3.0) {
        this.state.stepProgress = 3.0;
        this._stopAnimations();
        this.renderAll();
        return;
      }
      this.renderAll();
      this._stepAnimFrame = requestAnimationFrame(tick);
    };
    this._stepAnimFrame = requestAnimationFrame(tick);
  }

  _toggleNullSpaceAnimation() {
    if (this.animatingNull) {
      this._stopAnimations();
      return;
    }
    this._stopAnimations();
    const seq = SEQUENCES[this.state.seqId];
    if (!this.lastForward || this.lastForward.manipulability > 0.08) {
      if (seq.type === 'proper') {
        this.state.anglesDeg[1] = Math.abs(this.state.anglesDeg[1]) > 90 ? 180 : 0;
      } else {
        this.state.anglesDeg[1] = this.state.anglesDeg[1] < 0 ? -90 : 90;
      }
      this.nullBaseAnglesDeg = [...this.state.anglesDeg];
      this.renderAll();
    } else {
      this.nullBaseAnglesDeg = [...this.state.anglesDeg];
      this.state.nullDeltaDeg = 0;
    }

    this.animatingNull = true;
    const spinNullBtn = document.getElementById('ea-spin-nullspace-btn');
    if (spinNullBtn) spinNullBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Spin';

    let lastTs = performance.now();
    const tick = (now) => {
      if (!this.animatingNull) return;
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      let nextDelta = this.state.nullDeltaDeg + dt * 55;
      if (nextDelta > 180) nextDelta -= 360;
      this._applyNullSpaceDelta(nextDelta);
      this._nullAnimFrame = requestAnimationFrame(tick);
    };
    this._nullAnimFrame = requestAnimationFrame(tick);
  }

  renderAll() {
    const { seqId, anglesDeg, stepProgress, stepMode, matrixViewMode, nullDeltaDeg } = this.state;
    const seq = SEQUENCES[seqId];
    const [a1, a2, a3] = seq.axes;
    const A1 = a1.toUpperCase();
    const A2 = a2.toUpperCase();
    const A3 = a3.toUpperCase();
    const anglesRad = anglesDeg.map((d) => d * DEG2RAD);

    const fwd = computeEulerForward(seqId, anglesRad);
    const inv = solveEulerInverse(fwd.R, seqId);
    const symMat = generateSymbolicMatrix(seqId);
    const extraRep = rotationMatrixToAxisAngleAndQuaternion(fwd.R);

    this.lastForward = fwd;
    this.lastInverse = inv;

    // Update 3D WebGL Scene
    this.scene3D.updateScene({
      seqId,
      anglesRad,
      stepProgress,
      stepMode
    });

    // Update active sequence button
    document.querySelectorAll('.ea-seq-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-seq') === seqId);
    });

    // Update Header & Equivalence Banner
    const matEqStr = `R = R_${a1}(ϕ) · R_${a2}(θ) · R_${a3}(ψ)`;
    const headerMatEq = document.getElementById('ea-header-mat-eq');
    if (headerMatEq) headerMatEq.textContent = matEqStr;

    const eqIntrinsic = document.getElementById('ea-equiv-intrinsic');
    const eqIntrinsicDesc = document.getElementById('ea-equiv-intrinsic-desc');
    const eqExtrinsic = document.getElementById('ea-equiv-extrinsic');
    const eqExtrinsicDesc = document.getElementById('ea-equiv-extrinsic-desc');

    if (eqIntrinsic) eqIntrinsic.textContent = `${A1}-${A2}'-${A3}'' Intrinsic:  ${seq.intrinsicDesc}`;
    if (eqIntrinsicDesc) {
      eqIntrinsicDesc.textContent = `Current-frame rotations: 1st by ϕ about ${a1}̂, 2nd by θ about current ${a2}̂', 3rd by ψ about current ${a3}̂''.`;
    }
    if (eqExtrinsic) eqExtrinsic.textContent = `${A3}-${A2}-${A1} Extrinsic:  Fixed ${seq.extrinsicDesc}`;
    if (eqExtrinsicDesc) {
      if (seq.type === 'tait-bryan') {
        eqExtrinsicDesc.textContent = `Switching both the axis order (${A1}-${A2}-${A3} ↔ ${A3}-${A2}-${A1}) and the frame reference (Intrinsic ↔ Fixed) yields the exact same rotation R!`;
      } else {
        eqExtrinsicDesc.textContent = `Reversing the angle order (ϕ, θ, ψ) ↔ (ψ, θ, ϕ) about the fixed ${A1}-${A2}-${A3} axes yields the exact same rotation R!`;
      }
    }

    // Update 3D HUD
    const hudEq = document.getElementById('ea-hud-eq');
    if (hudEq) hudEq.textContent = `${seq.name} (${seq.type === 'proper' ? 'Proper Euler' : 'Tait-Bryan'}): ${matEqStr}`;

    const statusBadge = document.getElementById('ea-hud-status');
    if (statusBadge) {
      if (fwd.manipulability < 0.015) {
        statusBadge.className = 'ea-status-badge ea-status-badge--lock';
        statusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> GIMBAL LOCK (2 DoF — ê₁ ∥ ê₃'')`;
      } else if (fwd.manipulability < 0.20) {
        statusBadge.className = 'ea-status-badge ea-status-badge--warn';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Near Singularity (${(fwd.manipulability * 100).toFixed(0)}% DoF)`;
      } else {
        statusBadge.className = 'ea-status-badge ea-status-badge--ok';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> 3 DoF Full Rank (${(fwd.manipulability * 100).toFixed(0)}%)`;
      }
    }

    // Update Step Scrubber labels & buttons
    const btnStepInt = document.getElementById('ea-step-mode-intrinsic');
    const btnStepExt = document.getElementById('ea-step-mode-extrinsic');
    if (btnStepInt) btnStepInt.textContent = `Intrinsic: ${seq.intrinsicDesc}`;
    if (btnStepExt) btnStepExt.textContent = `Extrinsic: Fixed ${seq.extrinsicDesc}`;

    const stepSlider = document.getElementById('ea-step-slider');
    if (stepSlider) stepSlider.value = stepProgress;
    const stepCaption = document.getElementById('ea-step-caption');
    if (stepCaption) {
      if (stepProgress === 0) {
        stepCaption.textContent = `Step 0.00: Identity Reference Frame F₀ = {x̂, ŷ, ẑ}`;
      } else if (stepMode === 'intrinsic') {
        if (stepProgress <= 1.0) {
          stepCaption.textContent = `Intrinsic Step 1 (${Math.round(stepProgress * 100)}%): Rotating about ${a1}̂ by ϕ = ${(anglesDeg[0] * stepProgress).toFixed(1)}°`;
        } else if (stepProgress <= 2.0) {
          const p2 = stepProgress - 1.0;
          stepCaption.textContent = `Intrinsic Step 2 (${Math.round(p2 * 100)}%): Rotating about current ${a2}̂' by θ = ${(anglesDeg[1] * p2).toFixed(1)}°`;
        } else if (stepProgress < 3.0) {
          const p3 = stepProgress - 2.0;
          stepCaption.textContent = `Intrinsic Step 3 (${Math.round(p3 * 100)}%): Rotating about current ${a3}̂'' by ψ = ${(anglesDeg[2] * p3).toFixed(1)}°`;
        } else {
          stepCaption.textContent = `Step 3.00 (Complete): Resultant Orientation F₃ (ϕ=${anglesDeg[0].toFixed(1)}°, θ=${anglesDeg[1].toFixed(1)}°, ψ=${anglesDeg[2].toFixed(1)}°)`;
        }
      } else {
        // Extrinsic playback order: ψ about fixed a3 -> θ about fixed a2 -> ϕ about fixed a1
        if (stepProgress <= 1.0) {
          stepCaption.textContent = `Extrinsic Step 1 (${Math.round(stepProgress * 100)}%): Rotating about fixed ${a3}̂ by ψ = ${(anglesDeg[2] * stepProgress).toFixed(1)}°`;
        } else if (stepProgress <= 2.0) {
          const p2 = stepProgress - 1.0;
          stepCaption.textContent = `Extrinsic Step 2 (${Math.round(p2 * 100)}%): Rotating about fixed ${a2}̂ by θ = ${(anglesDeg[1] * p2).toFixed(1)}°`;
        } else if (stepProgress < 3.0) {
          const p3 = stepProgress - 2.0;
          stepCaption.textContent = `Extrinsic Step 3 (${Math.round(p3 * 100)}%): Rotating about fixed ${a1}̂ by ϕ = ${(anglesDeg[0] * p3).toFixed(1)}°`;
        } else {
          stepCaption.textContent = `Step 3.00 (Complete): Identical Resultant Orientation F₃ via Fixed-Frame ${seq.extrinsicDesc}`;
        }
      }
    }

    // Update 3 Precision Rotary Knobs & Numeric Inputs (ϕ, θ, ψ)
    const axisLabels = [`${a1}̂ (Fixed ${a3}̂ last)`, `${a2}̂' (Fixed ${a2}̂ 2nd)`, `${a3}̂'' (Fixed ${a3}̂ 1st)`];
    const shortAxisLabels = [`about ${a1}̂`, `about ${a2}̂'`, `about ${a3}̂''`];

    for (let idx = 0; idx < 3; idx++) {
      const axChar = seq.axes[idx];
      const degVal = anglesDeg[idx];
      const radVal = anglesRad[idx];

      const tagSpan = document.getElementById(`ea-axis-tag-${idx}`);
      if (tagSpan) {
        tagSpan.textContent = shortAxisLabels[idx];
        tagSpan.title = axisLabels[idx];
        tagSpan.className = `ea-axis-tag ea-axis-tag--${axChar}`;
      }

      this._updateRotaryKnobVisual(idx, degVal, axChar);

      const numInput = document.getElementById(`ea-num-${idx}`);
      if (numInput && document.activeElement !== numInput) {
        numInput.value = degVal.toFixed(1);
      }

      const radSpan = document.getElementById(`ea-rad-${idx}`);
      if (radSpan) {
        radSpan.textContent = `${radVal.toFixed(2)} rad`;
      }
    }

    // Update Section 3: Elementary & Composite 3x3 Matrices
    this._renderMatricesSection(fwd, inv, symMat, seq, matrixViewMode);

    // Update Section 4: Gimbal Lock & Singularity Analysis
    this._renderGimbalLockSection(fwd, inv, seq, nullDeltaDeg);

    // Update Section 5: Dual Solutions & atan2 Formulas
    this._renderInverseSection(fwd, inv, anglesDeg);

    // Persist current session state in localStorage
    this._saveSessionState();
  }

  _renderLatex(texStr, displayMode = true) {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return window.katex.renderToString(texStr, {
          displayMode,
          throwOnError: false,
          strict: false
        });
      } catch (err) {
        return `<code>${texStr}</code>`;
      }
    }
    if (!this._loadingKatex) {
      this._loadingKatex = true;
      import('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs')
        .then((mod) => {
          window.katex = mod.default || mod;
          this.renderAll();
        })
        .catch(() => {});
    }
    return `<code>${texStr}</code>`;
  }

  _renderMatricesSection(fwd, inv, symMat, seq) {
    const [a1, a2, a3] = seq.axes;
    const [d0, d1, d2] = this.state.anglesDeg.map((d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}^\\circ`);
    const fmtNum = (v, digits = 4) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;

    const matToBmatrix = (M, cellFn) => {
      const rows = M.map((row, r) => row.map((val, c) => cellFn(val, r, c)).join(' & ')).join(' \\\\[4pt] ');
      return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
    };

    const elemContainer = document.getElementById('ea-elem-matrices-container');
    if (elemContainer) {
      const elemSymMatrices = symMat.elemLatexFull;
      const symB1 = matToBmatrix(elemSymMatrices[0], (v) => v);
      const symB2 = matToBmatrix(elemSymMatrices[1], (v) => v);
      const symB3 = matToBmatrix(elemSymMatrices[2], (v) => v);

      const symProdLatex = `\\mathbf{R}(\\phi, \\theta, \\psi) = \\underbrace{${symB1}}_{\\mathbf{R}_{${a1}}(\\phi)} \\, \\underbrace{${symB2}}_{\\mathbf{R}_{${a2}'}(\\theta)} \\, \\underbrace{${symB3}}_{\\mathbf{R}_{${a3}''}(\\psi)}`;

      const numB1 = matToBmatrix(fwd.R1, (v) => fmtNum(v, 3));
      const numB2 = matToBmatrix(fwd.R2, (v) => fmtNum(v, 3));
      const numB3 = matToBmatrix(fwd.R3, (v) => fmtNum(v, 3));

      const numProdLatex = `\\mathbf{R}(${d0},\\, ${d1},\\, ${d2}) = \\underbrace{${numB1}}_{\\mathbf{R}_{${a1}}(\\phi = ${d0})} \\, \\underbrace{${numB2}}_{\\mathbf{R}_{${a2}'}(\\theta = ${d1})} \\, \\underbrace{${numB3}}_{\\mathbf{R}_{${a3}''}(\\psi = ${d2})}`;

      elemContainer.innerHTML = `
        <div class="ea-latex-eq-block">${this._renderLatex(symProdLatex, true)}</div>
        <div class="ea-latex-eq-block">${this._renderLatex(numProdLatex, true)}</div>
      `;
    }

    const gridEl = document.getElementById('ea-composite-matrix-grid');
    if (gridEl) {
      const [pi, pj] = inv.pivotCoords;
      const symGrid = symMat.latexFull;

      const symCompBmat = matToBmatrix(symGrid, (val, r, c) => {
        if (r === pi && c === pj) {
          return `\\color{#0284c7}{\\mathbf{${val}^{\\,\\star}}}`;
        }
        return val;
      });

      const numCompBmat = matToBmatrix(fwd.R, (val, r, c) => {
        const s = fmtNum(val, 4);
        if (r === pi && c === pj) {
          return `\\color{#0284c7}{\\mathbf{${s}^{\\,\\star}}}`;
        }
        return s;
      });

      const symCompLatex = `\\mathbf{R}(\\phi, \\theta, \\psi) = ${symCompBmat}`;
      const numCompLatex = `\\mathbf{R} = [r_{ij}] = ${numCompBmat}`;

      gridEl.classList.add('ea-latex-panel--2col');
      gridEl.innerHTML = `
        <div class="ea-latex-eq-block">${this._renderLatex(symCompLatex, true)}</div>
        <div class="ea-latex-eq-block">${this._renderLatex(numCompLatex, true)}</div>
      `;
    }

    const so3Info = document.getElementById('ea-so3-verification');
    if (so3Info) {
      const pivotTex = `\\det(\\mathbf{R}) = +1.0000 \\quad | \\quad \\mathbf{R}^\\top\\mathbf{R} = \\mathbf{I}_3 \\quad | \\quad \\text{Pivot: } r_{${inv.pivotCoords[0] + 1}${inv.pivotCoords[1] + 1}}^{\\,\\star} = ${fmtNum(inv.pivotValue, 4)}`;
      so3Info.innerHTML = this._renderLatex(pivotTex, false);
    }
  }

  _renderGimbalLockSection(fwd, inv, seq, nullDeltaDeg) {
    const dofPct = (fwd.manipulability * 100).toFixed(1);
    const dofValEl = document.getElementById('ea-dof-val');
    if (dofValEl) {
      const detFunc = seq.type === 'proper' ? `|sin(θ)|` : `|cos(θ)|`;
      dofValEl.textContent = `${detFunc} = ${fwd.manipulability.toFixed(3)} (${dofPct}%)`;
    }

    const colAngleEl = document.getElementById('ea-collinear-angle');
    if (colAngleEl) {
      colAngleEl.textContent = `∠(ê₁, ê₃'') = ${fwd.axisAngle13Deg.toFixed(1)}°`;
    }

    const dofFill = document.getElementById('ea-dof-bar-fill');
    if (dofFill) {
      dofFill.style.width = `${Math.max(2, fwd.manipulability * 100)}%`;
      dofFill.style.backgroundColor =
        fwd.manipulability < 0.03 ? '#ff4d4f' : fwd.manipulability < 0.22 ? '#f59e0b' : '#22c55e';
    }

    const lockPole1Btn = document.getElementById('ea-trigger-lock-1');
    const lockPole2Btn = document.getElementById('ea-trigger-lock-2');
    if (lockPole1Btn && lockPole2Btn) {
      if (seq.type === 'proper') {
        lockPole1Btn.textContent = `⚡ Jump to Gimbal Lock (θ = 0°)`;
        lockPole2Btn.textContent = `⚡ Jump to Gimbal Lock (θ = 180°)`;
      } else {
        lockPole1Btn.textContent = `⚡ Jump to Gimbal Lock (θ = +90°)`;
        lockPole2Btn.textContent = `⚡ Jump to Gimbal Lock (θ = -90°)`;
      }
    }

    const nullFormulaEl = document.getElementById('ea-nullspace-formula');
    if (nullFormulaEl) {
      nullFormulaEl.textContent = inv.coupledFormulaText;
    }

    const nullSlider = document.getElementById('ea-nullspace-slider');
    if (nullSlider) {
      nullSlider.value = nullDeltaDeg;
    }
  }

  _renderInverseSection(fwd, inv, anglesDeg) {
    const f = inv.formulas;
    const sol1Title = document.getElementById('ea-sol1-title');
    const sol2Title = document.getElementById('ea-sol2-title');
    const sol1Formulas = document.getElementById('ea-sol1-formulas');
    const sol2Formulas = document.getElementById('ea-sol2-formulas');
    const sol1Box = document.getElementById('ea-sol1-box');
    const sol2Box = document.getElementById('ea-sol2-box');
    const singBox = document.getElementById('ea-singular-formulas-box');

    if (sol1Title) {
      sol1Title.innerHTML = `Solution Set 1: &nbsp;${this._renderLatex(f.branch1TitleLatex, false)}`;
    }
    if (sol2Title) {
      sol2Title.innerHTML = `Solution Set 2: &nbsp;${this._renderLatex(f.branch2TitleLatex, false)}`;
    }

    if (sol1Formulas) {
      const sol1Tex = [
        '\\begin{aligned}',
        `${f.branch1Latex[1]} &&\\implies \\boldsymbol{\\phi}_1 &= \\mathbf{${inv.sol1Deg[0].toFixed(2)}^\\circ} \\\\[5pt]`,
        `${f.branch1Latex[0]} &&\\implies \\boldsymbol{\\theta}_1 &= \\mathbf{${inv.sol1Deg[1].toFixed(2)}^\\circ} \\\\[5pt]`,
        `${f.branch1Latex[2]} &&\\implies \\boldsymbol{\\psi}_1 &= \\mathbf{${inv.sol1Deg[2].toFixed(2)}^\\circ}`,
        '\\end{aligned}'
      ].join('\n');
      sol1Formulas.innerHTML = this._renderLatex(sol1Tex, true);
    }

    if (sol2Formulas) {
      const sol2Tex = [
        '\\begin{aligned}',
        `${f.branch2Latex[1]} &&\\implies \\boldsymbol{\\phi}_2 &= \\mathbf{${inv.sol2Deg[0].toFixed(2)}^\\circ} \\\\[5pt]`,
        `${f.branch2Latex[0]} &&\\implies \\boldsymbol{\\theta}_2 &= \\mathbf{${inv.sol2Deg[1].toFixed(2)}^\\circ} \\\\[5pt]`,
        `${f.branch2Latex[2]} &&\\implies \\boldsymbol{\\psi}_2 &= \\mathbf{${inv.sol2Deg[2].toFixed(2)}^\\circ}`,
        '\\end{aligned}'
      ].join('\n');
      sol2Formulas.innerHTML = this._renderLatex(sol2Tex, true);
    }

    const d1 = Math.hypot(
      wrapDeg(anglesDeg[0] - inv.sol1Deg[0]),
      wrapDeg(anglesDeg[1] - inv.sol1Deg[1]),
      wrapDeg(anglesDeg[2] - inv.sol1Deg[2])
    );
    const d2 = Math.hypot(
      wrapDeg(anglesDeg[0] - inv.sol2Deg[0]),
      wrapDeg(anglesDeg[1] - inv.sol2Deg[1]),
      wrapDeg(anglesDeg[2] - inv.sol2Deg[2])
    );
    if (sol1Box && sol2Box) {
      sol1Box.classList.toggle('active-branch', d1 <= d2);
      sol2Box.classList.toggle('active-branch', d2 < d1);
    }

    if (singBox) {
      const singTex = [
        '\\begin{aligned}',
        `${f.singularPlusLatex} \\\\[5pt]`,
        `${f.singularMinusLatex}`,
        '\\end{aligned}'
      ].join('\n');
      singBox.innerHTML = `
        <div style="font-weight:700;font-size:0.9rem;">
          Gimbal Lock Singularities: &nbsp;${this._renderLatex(f.singularTitleLatex, false)}
        </div>
        <div class="ea-latex-aligned-box">
          ${this._renderLatex(singTex, true)}
        </div>
        <div style="font-size:0.84rem;color:var(--ea-accent-text);font-weight:600;">
          Current Coupled Angle Sum/Difference: &nbsp;${this._renderLatex(inv.coupledFormulaLatex, false)}
          &nbsp;<span style="color:var(--ea-text-muted);font-weight:500;">(Infinitely many ${this._renderLatex('(\\phi,\\,\\psi)', false)} pairs satisfy this at Gimbal Lock)</span>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new EulerAnglesApp();
});

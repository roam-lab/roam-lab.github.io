/**
 * Universal 3D Rotations & Euler Angles Mathematical Engine
 * Uses the single canonical angle triplet {ϕ, θ, ψ} for all 6 Proper Euler + 6 Tait-Bryan sequences:
 *   R = R_{a1}(ϕ) · R_{a2}(θ) · R_{a3}(ψ)
 *
 * Dual Intrinsic / Extrinsic Equivalence:
 *   Intrinsic (Current Frame): Rotate by ϕ about a1, then θ about a2', then ψ about a3''
 *   Extrinsic (Fixed Frame):   Rotate by ψ about fixed a3, then θ about fixed a2, then ϕ about fixed a1
 *   Both produce the exact same rotation matrix R = R_{a1}(ϕ) R_{a2}(θ) R_{a3}(ψ).
 */

export const SYMBOLS = ['ϕ', 'θ', 'ψ'];

export const SEQUENCES = {
  // 6 Proper Euler Sequences (first and third axes are identical: a1 = a3)
  ZYZ: {
    id: 'ZYZ',
    type: 'proper',
    axes: ['z', 'y', 'z'],
    indices: [3, 2, 3],
    name: 'Z-Y-Z',
    intrinsicDesc: "Z(ϕ) → Y'(θ) → Z''(ψ)",
    extrinsicDesc: 'Z(ψ) → Y(θ) → Z(ϕ)',
    note: 'Proper Euler Z-Y-Z: Current-frame Z(ϕ) → Y\'(θ) → Z\'\'(ψ) is identical to Fixed-frame Z(ψ) → Y(θ) → Z(ϕ).'
  },
  ZXZ: {
    id: 'ZXZ',
    type: 'proper',
    axes: ['z', 'x', 'z'],
    indices: [3, 1, 3],
    name: 'Z-X-Z',
    intrinsicDesc: "Z(ϕ) → X'(θ) → Z''(ψ)",
    extrinsicDesc: 'Z(ψ) → X(θ) → Z(ϕ)',
    note: 'Proper Euler Z-X-Z: Current-frame Z(ϕ) → X\'(θ) → Z\'\'(ψ) is identical to Fixed-frame Z(ψ) → X(θ) → Z(ϕ).'
  },
  YXY: {
    id: 'YXY',
    type: 'proper',
    axes: ['y', 'x', 'y'],
    indices: [2, 1, 2],
    name: 'Y-X-Y',
    intrinsicDesc: "Y(ϕ) → X'(θ) → Y''(ψ)",
    extrinsicDesc: 'Y(ψ) → X(θ) → Y(ϕ)',
    note: 'Proper Euler Y-X-Y: Current-frame Y(ϕ) → X\'(θ) → Y\'\'(ψ) is identical to Fixed-frame Y(ψ) → X(θ) → Y(ϕ).'
  },
  YZY: {
    id: 'YZY',
    type: 'proper',
    axes: ['y', 'z', 'y'],
    indices: [2, 3, 2],
    name: 'Y-Z-Y',
    intrinsicDesc: "Y(ϕ) → Z'(θ) → Y''(ψ)",
    extrinsicDesc: 'Y(ψ) → Z(θ) → Y(ϕ)',
    note: 'Proper Euler Y-Z-Y: Current-frame Y(ϕ) → Z\'(θ) → Y\'\'(ψ) is identical to Fixed-frame Y(ψ) → Z(θ) → Y(ϕ).'
  },
  XZX: {
    id: 'XZX',
    type: 'proper',
    axes: ['x', 'z', 'x'],
    indices: [1, 3, 1],
    name: 'X-Z-X',
    intrinsicDesc: "X(ϕ) → Z'(θ) → X''(ψ)",
    extrinsicDesc: 'X(ψ) → Z(θ) → X(ϕ)',
    note: 'Proper Euler X-Z-X: Current-frame X(ϕ) → Z\'(θ) → X\'\'(ψ) is identical to Fixed-frame X(ψ) → Z(θ) → X(ϕ).'
  },
  XYX: {
    id: 'XYX',
    type: 'proper',
    axes: ['x', 'y', 'x'],
    indices: [1, 2, 1],
    name: 'X-Y-X',
    intrinsicDesc: "X(ϕ) → Y'(θ) → X''(ψ)",
    extrinsicDesc: 'X(ψ) → Y(θ) → X(ϕ)',
    note: 'Proper Euler X-Y-X: Current-frame X(ϕ) → Y\'(θ) → X\'\'(ψ) is identical to Fixed-frame X(ψ) → Y(θ) → X(ϕ).'
  },

  // 6 Tait-Bryan / Cardan Sequences (all three axes are distinct)
  ZYX: {
    id: 'ZYX',
    type: 'tait-bryan',
    axes: ['z', 'y', 'x'],
    indices: [3, 2, 1],
    name: 'Z-Y-X',
    intrinsicDesc: "Z(ϕ) → Y'(θ) → X''(ψ)",
    extrinsicDesc: 'X(ψ) → Y(θ) → Z(ϕ)',
    note: 'Tait-Bryan Z-Y-X (RPY): Intrinsic Z(ϕ) → Y\'(θ) → X\'\'(ψ) is identical to Extrinsic X-Y-Z with reversed angles (ψ, θ, ϕ).'
  },
  XYZ: {
    id: 'XYZ',
    type: 'tait-bryan',
    axes: ['x', 'y', 'z'],
    indices: [1, 2, 3],
    name: 'X-Y-Z',
    intrinsicDesc: "X(ϕ) → Y'(θ) → Z''(ψ)",
    extrinsicDesc: 'Z(ψ) → Y(θ) → X(ϕ)',
    note: 'Tait-Bryan X-Y-Z: Intrinsic X(ϕ) → Y\'(θ) → Z\'\'(ψ) is identical to Extrinsic Z-Y-X with reversed angles (ψ, θ, ϕ).'
  },
  YXZ: {
    id: 'YXZ',
    type: 'tait-bryan',
    axes: ['y', 'x', 'z'],
    indices: [2, 1, 3],
    name: 'Y-X-Z',
    intrinsicDesc: "Y(ϕ) → X'(θ) → Z''(ψ)",
    extrinsicDesc: 'Z(ψ) → X(θ) → Y(ϕ)',
    note: 'Tait-Bryan Y-X-Z: Intrinsic Y(ϕ) → X\'(θ) → Z\'\'(ψ) is identical to Extrinsic Z-X-Y with reversed angles (ψ, θ, ϕ).'
  },
  ZXY: {
    id: 'ZXY',
    type: 'tait-bryan',
    axes: ['z', 'x', 'y'],
    indices: [3, 1, 2],
    name: 'Z-X-Y',
    intrinsicDesc: "Z(ϕ) → X'(θ) → Y''(ψ)",
    extrinsicDesc: 'Y(ψ) → X(θ) → Z(ϕ)',
    note: 'Tait-Bryan Z-X-Y: Intrinsic Z(ϕ) → X\'(θ) → Y\'\'(ψ) is identical to Extrinsic Y-X-Z with reversed angles (ψ, θ, ϕ).'
  },
  YZX: {
    id: 'YZX',
    type: 'tait-bryan',
    axes: ['y', 'z', 'x'],
    indices: [2, 3, 1],
    name: 'Y-Z-X',
    intrinsicDesc: "Y(ϕ) → Z'(θ) → X''(ψ)",
    extrinsicDesc: 'X(ψ) → Z(θ) → Y(ϕ)',
    note: 'Tait-Bryan Y-Z-X: Intrinsic Y(ϕ) → Z\'(θ) → X\'\'(ψ) is identical to Extrinsic X-Z-Y with reversed angles (ψ, θ, ϕ).'
  },
  XZY: {
    id: 'XZY',
    type: 'tait-bryan',
    axes: ['x', 'z', 'y'],
    indices: [1, 3, 2],
    name: 'X-Z-Y',
    intrinsicDesc: "X(ϕ) → Z'(θ) → Y''(ψ)",
    extrinsicDesc: 'Y(ψ) → Z(θ) → X(ϕ)',
    note: 'Tait-Bryan X-Z-Y: Intrinsic X(ϕ) → Z\'(θ) → Y\'\'(ψ) is identical to Extrinsic Y-Z-X with reversed angles (ψ, θ, ϕ).'
  }
};

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function wrapDeg(deg) {
  let d = ((deg + 180) % 360);
  if (d <= 0) d += 360;
  return d - 180;
}

export function leviCivita(i, j, k) {
  if (i === j || j === k || k === i) return 0;
  if ((i === 1 && j === 2 && k === 3) ||
      (i === 2 && j === 3 && k === 1) ||
      (i === 3 && j === 1 && k === 2)) {
    return 1;
  }
  return -1;
}

export function elementaryRotationMatrix(axis, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const a = typeof axis === 'number' ? ['x', 'y', 'z'][axis - 1] : axis.toLowerCase();
  if (a === 'x') {
    return [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c]
    ];
  } else if (a === 'y') {
    return [
      [c, 0, s],
      [0, 1, 0],
      [-s, 0, c]
    ];
  } else {
    return [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1]
    ];
  }
}

export function matMul3(A, B) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
    }
  }
  return C;
}

export function matVec3(A, v) {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]
  ];
}

export function matDet3(A) {
  return (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  );
}

export function unitAxisVector(axis) {
  const a = typeof axis === 'number' ? ['x', 'y', 'z'][axis - 1] : axis.toLowerCase();
  if (a === 'x') return [1, 0, 0];
  if (a === 'y') return [0, 1, 0];
  return [0, 0, 1];
}

export function computeEulerForward(seqId, anglesRad) {
  const seq = SEQUENCES[seqId];
  const [a1, a2, a3] = seq.axes;
  const [phi, theta, psi] = anglesRad;

  const R1 = elementaryRotationMatrix(a1, phi);
  const R2 = elementaryRotationMatrix(a2, theta);
  const R3 = elementaryRotationMatrix(a3, psi);

  const F1 = R1;
  const F2 = matMul3(R1, R2);
  const F3 = matMul3(F2, R3);

  const e1 = unitAxisVector(a1);
  const e2 = matVec3(F1, unitAxisVector(a2));
  const e3 = matVec3(F2, unitAxisVector(a3));

  const E = [
    [e1[0], e2[0], e3[0]],
    [e1[1], e2[1], e3[1]],
    [e1[2], e2[2], e3[2]]
  ];
  const detE = matDet3(E);
  const manipulability = Math.min(1, Math.abs(detE));

  const dot13 = Math.max(-1, Math.min(1, e1[0] * e3[0] + e1[1] * e3[1] + e1[2] * e3[2]));
  const cross13 = [
    e1[1] * e3[2] - e1[2] * e3[1],
    e1[2] * e3[0] - e1[0] * e3[2],
    e1[0] * e3[1] - e1[1] * e3[0]
  ];
  const crossNorm = Math.hypot(cross13[0], cross13[1], cross13[2]);
  const axisAngle13Deg = Math.acos(dot13) * RAD2DEG;

  return {
    R: F3,
    F1,
    F2,
    F3,
    R1,
    R2,
    R3,
    axesVectors: { e1, e2, e3 },
    jacobian: E,
    detE,
    manipulability,
    dot13,
    crossNorm,
    axisAngle13Deg
  };
}

export function generateSymbolicMatrix(seqId) {
  const seq = SEQUENCES[seqId];
  const axesOrder = seq.axes;
  const symOrder = SYMBOLS;

  function elemSym(axis, idx) {
    const c = `c${idx}`;
    const s = `s${idx}`;
    const zero = [];
    const one = [{ sign: 1, factors: [] }];
    const posC = [{ sign: 1, factors: [c] }];
    const posS = [{ sign: 1, factors: [s] }];
    const negS = [{ sign: -1, factors: [s] }];

    if (axis === 'x') {
      return [
        [one, zero, zero],
        [zero, posC, negS],
        [zero, posS, posC]
      ];
    } else if (axis === 'y') {
      return [
        [posC, zero, posS],
        [zero, one, zero],
        [negS, zero, posC]
      ];
    } else {
      return [
        [posC, negS, zero],
        [posS, posC, zero],
        [zero, zero, one]
      ];
    }
  }

  function mulPoly(pA, pB) {
    if (pA.length === 0 || pB.length === 0) return [];
    const res = [];
    for (const a of pA) {
      for (const b of pB) {
        res.push({
          sign: a.sign * b.sign,
          factors: [...a.factors, ...b.factors]
        });
      }
    }
    return res;
  }

  function matMulSym(A, B) {
    const C = [
      [[], [], []],
      [[], [], []],
      [[], [], []]
    ];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        C[r][c] = [
          ...mulPoly(A[r][0], B[0][c]),
          ...mulPoly(A[r][1], B[1][c]),
          ...mulPoly(A[r][2], B[2][c])
        ];
      }
    }
    return C;
  }

  const M1 = elemSym(axesOrder[0], 0);
  const M2 = elemSym(axesOrder[1], 1);
  const M3 = elemSym(axesOrder[2], 2);
  const M12 = matMulSym(M1, M2);
  const M123 = matMulSym(M12, M3);

  function formatPoly(poly, mode = 'compact') {
    if (poly.length === 0) return '0';
    return poly
      .map((term, idx) => {
        const prefix = idx === 0 ? (term.sign < 0 ? '-' : '') : (term.sign < 0 ? ' - ' : ' + ');
        if (term.factors.length === 0) return prefix + '1';
        const facStr = term.factors
          .map((f) => {
            const fn = f[0];
            const k = parseInt(f[1], 10);
            const sym = symOrder[k];
            if (mode === 'compact') {
              return `${fn}_${sym}`;
            } else {
              return `${fn === 'c' ? 'cos' : 'sin'}(${sym})`;
            }
          })
          .join(' ');
        return prefix + facStr;
      })
      .join('');
  }

  const latexSyms = ['\\phi', '\\theta', '\\psi'];

  function formatPolyLatex(poly, mode = 'compact') {
    if (poly.length === 0) return '0';
    return poly
      .map((term, idx) => {
        const prefix = idx === 0 ? (term.sign < 0 ? '-' : '') : (term.sign < 0 ? ' - ' : ' + ');
        if (term.factors.length === 0) return prefix + '1';
        const facStr = term.factors
          .map((f) => {
            const fn = f[0];
            const k = parseInt(f[1], 10);
            const lsym = latexSyms[k];
            if (mode === 'compact') {
              return `${fn}_{${lsym}}`;
            } else {
              return `\\${fn === 'c' ? 'cos' : 'sin'}${lsym}`;
            }
          })
          .join('\\,');
        return prefix + facStr;
      })
      .join('');
  }

  const compact = M123.map((row) => row.map((cell) => formatPoly(cell, 'compact')));
  const full = M123.map((row) => row.map((cell) => formatPoly(cell, 'full')));
  const latexCompact = M123.map((row) => row.map((cell) => formatPolyLatex(cell, 'compact')));
  const latexFull = M123.map((row) => row.map((cell) => formatPolyLatex(cell, 'full')));
  const elemLatexCompact = [M1, M2, M3].map((M) =>
    M.map((row) => row.map((cell) => formatPolyLatex(cell, 'compact')))
  );
  const elemLatexFull = [M1, M2, M3].map((M) =>
    M.map((row) => row.map((cell) => formatPolyLatex(cell, 'full')))
  );

  return {
    compact,
    full,
    latexCompact,
    latexFull,
    elemLatexCompact,
    elemLatexFull,
    axesOrder,
    symOrder
  };
}

export function solveEulerInverse(R, seqId) {
  const seq = SEQUENCES[seqId];
  const [i1, j1, k1] = seq.indices;
  const i = i1 - 1;
  const j = j1 - 1;
  const k = k1 - 1;

  const SINGULAR_EPS = 1e-6;

  if (seq.type === 'proper') {
    const m1 = 6 - i1 - j1;
    const m = m1 - 1;
    const sigma = leviCivita(i1, j1, m1);

    const r_ii = Math.max(-1, Math.min(1, R[i][i]));
    const r_ji = R[j][i];
    const r_mi = R[m][i];
    const r_ij = R[i][j];
    const r_im = R[i][m];

    const sinAbs = Math.hypot(r_ji, r_mi);
    const isSingular = sinAbs < SINGULAR_EPS;

    const theta1 = Math.atan2(sinAbs, r_ii);
    const theta2 = Math.atan2(-sinAbs, r_ii);

    let phi1, psi1, phi2, psi2;
    const sumOrDiffRad = Math.atan2(sigma * R[m][j], R[j][j]);

    if (!isSingular) {
      phi1 = Math.atan2(r_ji, -sigma * r_mi);
      psi1 = Math.atan2(r_ij, sigma * r_im);

      phi2 = Math.atan2(-r_ji, sigma * r_mi);
      psi2 = Math.atan2(-r_ij, -sigma * r_im);
    } else {
      phi1 = sumOrDiffRad;
      psi1 = 0;
      phi2 = sumOrDiffRad;
      psi2 = 0;
    }

    const nearZeroPole = r_ii >= 0;
    const singularType = nearZeroPole ? 'sum' : 'diff';

    const negSigmaStr = -sigma > 0 ? '' : '-';
    const posSigmaStr = sigma > 0 ? '' : '-';
    const invNegSigmaStr = sigma > 0 ? '' : '-';
    const invPosSigmaStr = -sigma > 0 ? '' : '-';

    const formulas = {
      pivotEntry: `r_${i1}${i1} = cos(θ)`,
      pivotCoords: [i, i],
      branch1Title: `Solution Set 1: 0 < θ < π (sin θ > 0)`,
      branch1TitleLatex: `0 < \\theta < \\pi \\;(\\sin\\theta > 0)`,
      branch1: [
        `θ₁ = atan2(+√(r_${j1}${i1}² + r_${m1}${i1}²), r_${i1}${i1})`,
        `ϕ₁ = atan2(r_${j1}${i1}, ${negSigmaStr}r_${m1}${i1})`,
        `ψ₁ = atan2(r_${i1}${j1}, ${posSigmaStr}r_${i1}${m1})`
      ],
      branch1Latex: [
        `\\theta_1 &= \\operatorname{atan2}\\!\\left(+\\sqrt{r_{${j1}${i1}}^2 + r_{${m1}${i1}}^2},\\; r_{${i1}${i1}}\\right)`,
        `\\phi_1 &= \\operatorname{atan2}\\!\\left(r_{${j1}${i1}},\\; ${negSigmaStr}r_{${m1}${i1}}\\right)`,
        `\\psi_1 &= \\operatorname{atan2}\\!\\left(r_{${i1}${j1}},\\; ${posSigmaStr}r_{${i1}${m1}}\\right)`
      ],
      branch2Title: `Solution Set 2: -π < θ < 0 (or π < θ < 2π, sin θ < 0)`,
      branch2TitleLatex: `-\\pi < \\theta < 0 \\;(\\sin\\theta < 0)`,
      branch2: [
        `θ₂ = atan2(-√(r_${j1}${i1}² + r_${m1}${i1}²), r_${i1}${i1})`,
        `ϕ₂ = atan2(-r_${j1}${i1}, ${invNegSigmaStr}r_${m1}${i1})`,
        `ψ₂ = atan2(-r_${i1}${j1}, ${invPosSigmaStr}r_${i1}${m1})`
      ],
      branch2Latex: [
        `\\theta_2 &= \\operatorname{atan2}\\!\\left(-\\sqrt{r_{${j1}${i1}}^2 + r_{${m1}${i1}}^2},\\; r_{${i1}${i1}}\\right)`,
        `\\phi_2 &= \\operatorname{atan2}\\!\\left(-r_{${j1}${i1}},\\; ${invNegSigmaStr}r_{${m1}${i1}}\\right)`,
        `\\psi_2 &= \\operatorname{atan2}\\!\\left(-r_{${i1}${j1}},\\; ${invPosSigmaStr}r_{${i1}${m1}}\\right)`
      ],
      singularTitle: `Gimbal Lock Singularities (sin θ = 0 ⇔ r_${i1}${i1} = ±1)`,
      singularTitleLatex: `\\sin\\theta = 0 \\iff r_{${i1}${i1}} = \\pm 1`,
      singularPlus: `θ = 0° (r_${i1}${i1} = +1, ê₁ = +ê₃'' parallel): ϕ + ψ = atan2(${posSigmaStr}r_${m1}${j1}, r_${j1}${j1})`,
      singularMinus: `θ = 180° (r_${i1}${i1} = -1, ê₁ = -ê₃'' anti-parallel): ϕ - ψ = atan2(${posSigmaStr}r_${m1}${j1}, r_${j1}${j1})`,
      singularPlusLatex: `\\theta = 0^\\circ \\;\\left(r_{${i1}${i1}} = +1,\\; \\hat{\\mathbf{e}}_1 = +\\hat{\\mathbf{e}}_3''\\text{ parallel}\\right) &:\\quad \\phi + \\psi = \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${m1}${j1}},\\; r_{${j1}${j1}}\\right)`,
      singularMinusLatex: `\\theta = 180^\\circ \\;\\left(r_{${i1}${i1}} = -1,\\; \\hat{\\mathbf{e}}_1 = -\\hat{\\mathbf{e}}_3''\\text{ anti-parallel}\\right) &:\\quad \\phi - \\psi = \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${m1}${j1}},\\; r_{${j1}${j1}}\\right)`
    };

    const coupledFormulaText = nearZeroPole
      ? `ϕ + ψ = ${(sumOrDiffRad * RAD2DEG).toFixed(2)}°`
      : `ϕ - ψ = ${(sumOrDiffRad * RAD2DEG).toFixed(2)}°`;
    const coupledFormulaLatex = nearZeroPole
      ? `\\boldsymbol{\\phi} + \\boldsymbol{\\psi} = \\mathbf{${(sumOrDiffRad * RAD2DEG).toFixed(2)}^\\circ}`
      : `\\boldsymbol{\\phi} - \\boldsymbol{\\psi} = \\mathbf{${(sumOrDiffRad * RAD2DEG).toFixed(2)}^\\circ}`;

    const sol1 = [phi1, theta1, psi1];
    const sol2 = [phi2, theta2, psi2];

    return {
      isSingular,
      manipulability: sinAbs,
      pivotCoords: [i, i],
      pivotValue: r_ii,
      sol1Rad: sol1,
      sol2Rad: sol2,
      sol1Deg: sol1.map((a) => a * RAD2DEG),
      sol2Deg: sol2.map((a) => a * RAD2DEG),
      singularType,
      coupledAngleRad: sumOrDiffRad,
      coupledAngleDeg: sumOrDiffRad * RAD2DEG,
      coupledFormulaText,
      coupledFormulaLatex,
      formulas
    };
  } else {
    const sigma = leviCivita(i1, j1, k1);

    const r_ik = Math.max(-1, Math.min(1, R[i][k]));
    const r_jk = R[j][k];
    const r_kk = R[k][k];
    const r_ij = R[i][j];
    const r_ii = R[i][i];

    const sinTheta = sigma * r_ik;
    const cosAbs = Math.hypot(r_kk, r_jk);
    const isSingular = cosAbs < SINGULAR_EPS;

    const theta1 = Math.atan2(sinTheta, cosAbs);
    const theta2 = Math.atan2(sinTheta, -cosAbs);

    let phi1, psi1, phi2, psi2;
    const sumOrDiffRad = Math.atan2(sigma * R[k][j], R[j][j]);
    const isParallelPole = r_ik >= 0;
    const singularType = isParallelPole ? 'sum' : 'diff';

    if (!isSingular) {
      phi1 = Math.atan2(-sigma * r_jk, r_kk);
      psi1 = Math.atan2(-sigma * r_ij, r_ii);

      phi2 = Math.atan2(sigma * r_jk, -r_kk);
      psi2 = Math.atan2(sigma * r_ij, -r_ii);
    } else {
      phi1 = sumOrDiffRad;
      psi1 = 0;
      phi2 = sumOrDiffRad;
      psi2 = 0;
    }

    const posSigmaStr = sigma > 0 ? '' : '-';
    const negSigmaStr = -sigma > 0 ? '' : '-';
    const polePlusDeg = sigma > 0 ? '+90°' : '-90°';
    const poleMinusDeg = sigma > 0 ? '-90°' : '+90°';
    const polePlusLatex = sigma > 0 ? '+90^\\circ' : '-90^\\circ';
    const poleMinusLatex = sigma > 0 ? '-90^\\circ' : '+90^\\circ';

    const formulas = {
      pivotEntry: `r_${i1}${k1} = ${posSigmaStr}sin(θ)`,
      pivotCoords: [i, k],
      branch1Title: `Solution Set 1: -π/2 < θ < π/2 (cos θ > 0)`,
      branch1TitleLatex: `-\\tfrac{\\pi}{2} < \\theta < \\tfrac{\\pi}{2} \\;(\\cos\\theta > 0)`,
      branch1: [
        `θ₁ = atan2(${posSigmaStr}r_${i1}${k1}, +√(r_${k1}${k1}² + r_${j1}${k1}²))`,
        `ϕ₁ = atan2(${negSigmaStr}r_${j1}${k1}, r_${k1}${k1})`,
        `ψ₁ = atan2(${negSigmaStr}r_${i1}${j1}, r_${i1}${i1})`
      ],
      branch1Latex: [
        `\\theta_1 &= \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${i1}${k1}},\\; +\\sqrt{r_{${k1}${k1}}^2 + r_{${j1}${k1}}^2}\\right)`,
        `\\phi_1 &= \\operatorname{atan2}\\!\\left(${negSigmaStr}r_{${j1}${k1}},\\; r_{${k1}${k1}}\\right)`,
        `\\psi_1 &= \\operatorname{atan2}\\!\\left(${negSigmaStr}r_{${i1}${j1}},\\; r_{${i1}${i1}}\\right)`
      ],
      branch2Title: `Solution Set 2: π/2 < θ < 3π/2 (cos θ < 0)`,
      branch2TitleLatex: `\\tfrac{\\pi}{2} < \\theta < \\tfrac{3\\pi}{2} \\;(\\cos\\theta < 0)`,
      branch2: [
        `θ₂ = atan2(${posSigmaStr}r_${i1}${k1}, -√(r_${k1}${k1}² + r_${j1}${k1}²))`,
        `ϕ₂ = atan2(${posSigmaStr}r_${j1}${k1}, -r_${k1}${k1})`,
        `ψ₂ = atan2(${posSigmaStr}r_${i1}${j1}, -r_${i1}${i1})`
      ],
      branch2Latex: [
        `\\theta_2 &= \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${i1}${k1}},\\; -\\sqrt{r_{${k1}${k1}}^2 + r_{${j1}${k1}}^2}\\right)`,
        `\\phi_2 &= \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${j1}${k1}},\\; -r_{${k1}${k1}}\\right)`,
        `\\psi_2 &= \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${i1}${j1}},\\; -r_{${i1}${i1}}\\right)`
      ],
      singularTitle: `Gimbal Lock Singularities (cos θ = 0 ⇔ θ = ±90°)`,
      singularTitleLatex: `\\cos\\theta = 0 \\iff \\theta = \\pm 90^\\circ \\;\\left(r_{${i1}${k1}} = \\pm 1\\right)`,
      singularPlus: `θ = ${polePlusDeg} (r_${i1}${k1} = +1, ê₁ = +ê₃'' parallel): ϕ + ψ = atan2(${posSigmaStr}r_${k1}${j1}, r_${j1}${j1})`,
      singularMinus: `θ = ${poleMinusDeg} (r_${i1}${k1} = -1, ê₁ = -ê₃'' anti-parallel): ϕ - ψ = atan2(${posSigmaStr}r_${k1}${j1}, r_${j1}${j1})`,
      singularPlusLatex: `\\theta = ${polePlusLatex} \\;\\left(r_{${i1}${k1}} = +1,\\; \\hat{\\mathbf{e}}_1 = +\\hat{\\mathbf{e}}_3''\\text{ parallel}\\right) &:\\quad \\phi + \\psi = \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${k1}${j1}},\\; r_{${j1}${j1}}\\right)`,
      singularMinusLatex: `\\theta = ${poleMinusLatex} \\;\\left(r_{${i1}${k1}} = -1,\\; \\hat{\\mathbf{e}}_1 = -\\hat{\\mathbf{e}}_3''\\text{ anti-parallel}\\right) &:\\quad \\phi - \\psi = \\operatorname{atan2}\\!\\left(${posSigmaStr}r_{${k1}${j1}},\\; r_{${j1}${j1}}\\right)`
    };

    const coupledFormulaText = isParallelPole
      ? `ϕ + ψ = ${(sumOrDiffRad * RAD2DEG).toFixed(2)}°`
      : `ϕ - ψ = ${(sumOrDiffRad * RAD2DEG).toFixed(2)}°`;
    const coupledFormulaLatex = isParallelPole
      ? `\\boldsymbol{\\phi} + \\boldsymbol{\\psi} = \\mathbf{${(sumOrDiffRad * RAD2DEG).toFixed(2)}^\\circ}`
      : `\\boldsymbol{\\phi} - \\boldsymbol{\\psi} = \\mathbf{${(sumOrDiffRad * RAD2DEG).toFixed(2)}^\\circ}`;

    const sol1 = [phi1, theta1, psi1];
    const sol2 = [phi2, theta2, psi2];

    return {
      isSingular,
      manipulability: cosAbs,
      pivotCoords: [i, k],
      pivotValue: r_ik,
      sol1Rad: sol1,
      sol2Rad: sol2,
      sol1Deg: sol1.map((a) => a * RAD2DEG),
      sol2Deg: sol2.map((a) => a * RAD2DEG),
      singularType,
      coupledAngleRad: sumOrDiffRad,
      coupledAngleDeg: sumOrDiffRad * RAD2DEG,
      coupledFormulaText,
      coupledFormulaLatex,
      formulas
    };
  }
}

export function rotationMatrixToAxisAngleAndQuaternion(R) {
  const tr = R[0][0] + R[1][1] + R[2][2];
  let w, x, y, z;
  if (tr > 0) {
    const S = Math.sqrt(tr + 1.0) * 2;
    w = 0.25 * S;
    x = (R[2][1] - R[1][2]) / S;
    y = (R[0][2] - R[2][0]) / S;
    z = (R[1][0] - R[0][1]) / S;
  } else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
    const S = Math.sqrt(1.0 + R[0][0] - R[1][1] - R[2][2]) * 2;
    w = (R[2][1] - R[1][2]) / S;
    x = 0.25 * S;
    y = (R[0][1] + R[1][0]) / S;
    z = (R[0][2] + R[2][0]) / S;
  } else if (R[1][1] > R[2][2]) {
    const S = Math.sqrt(1.0 + R[1][1] - R[0][0] - R[2][2]) * 2;
    w = (R[0][2] - R[2][0]) / S;
    x = (R[0][1] + R[1][0]) / S;
    y = 0.25 * S;
    z = (R[1][2] + R[2][1]) / S;
  } else {
    const S = Math.sqrt(1.0 + R[2][2] - R[0][0] - R[1][1]) * 2;
    w = (R[1][0] - R[0][1]) / S;
    x = (R[0][2] + R[2][0]) / S;
    y = (R[1][2] + R[2][1]) / S;
    z = 0.25 * S;
  }

  const qNorm = Math.hypot(w, x, y, z) || 1;
  w /= qNorm;
  x /= qNorm;
  y /= qNorm;
  z /= qNorm;
  if (w < 0) {
    w = -w;
    x = -x;
    y = -y;
    z = -z;
  }

  const epsNorm = Math.hypot(x, y, z);
  const thetaRad = 2 * Math.atan2(epsNorm, w);
  const u = epsNorm > 1e-7 ? [x / epsNorm, y / epsNorm, z / epsNorm] : [0, 0, 1];

  return {
    quaternion: { w, x, y, z },
    axisAngle: {
      u,
      thetaRad,
      thetaDeg: thetaRad * RAD2DEG,
      meaningful: epsNorm > 1e-6
    }
  };
}

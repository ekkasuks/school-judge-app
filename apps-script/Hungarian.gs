/**
 * Hungarian.gs — Kuhn-Munkres (Jonker-Volgenant variant) สำหรับ assignment problem
 *
 * Input: cost[n][n] — square matrix ของ non-negative cost
 * Output: assignment[i] = j (row i ถูก match กับ col j) ที่ minimize Σ cost[i][assignment[i]]
 *
 * เนื่องจากปัญหารอบ 2 เป็น MAX votes เราต้องแปลง:
 *   cost[i][j] = MAX - votes[i][j]   (ผู้เรียกเตรียมไว้แล้ว)
 *
 * Complexity: O(n^3) — n=6 ⇒ ~216 ops ⇒ instantaneous
 */
function hungarian(cost) {
  const n = cost.length;
  if (n === 0) return [];
  if (cost.some(r => r.length !== n)) throw new Error('Matrix ต้องเป็นสี่เหลี่ยมจัตุรัส');

  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array(n);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
}

/**
 * Self-test — รันใน Apps Script editor เพื่อตรวจ correctness
 * คาดผล: assignment = [0, 1, 2], total cost = 4 (max votes = 8)
 */
function _testHungarian() {
  // votes matrix:
  // T1: A1=3 A2=1 A3=0
  // T2: A1=2 A2=2 A3=1
  // T3: A1=0 A2=1 A3=3
  // optimal: T1→A1 (3), T2→A2 (2), T3→A3 (3) → totalVotes=8
  const votes = [
    [3, 1, 0],
    [2, 2, 1],
    [0, 1, 3],
  ];
  const maxVal = 3;
  const cost = votes.map(r => r.map(v => maxVal - v));
  const assn = hungarian(cost);
  const totalVotes = assn.reduce((s, j, i) => s + votes[i][j], 0);
  Logger.log('assignment = ' + JSON.stringify(assn));
  Logger.log('total votes = ' + totalVotes + ' (expected 8)');
}

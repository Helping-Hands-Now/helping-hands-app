class GreedyOnion {
  constructor(distanceMatrix, batchSize) {
    this.matrix = distanceMatrix;
    this.n = distanceMatrix.length;
    this.current = 0;
    this.visited = new Set();
    this.routes = new Array();
    this.currentRoute = new Array();
    this.sedanPackageCapacity = batchSize;
  }

  run() {
    this.buildRoute();
  }

  buildRoute() {
    while (
      this.visited.size < this.n - 1 &&
      this.currentRoute.length < this.sedanPackageCapacity
    ) {
      this.current = this.next(this.current);
      this.currentRoute.push(this.current);
      this.visited.add(this.current);
    }
    this.routes.push(this.currentRoute);
    this.clearRoute();
    if (this.visited.size < this.n - 1) this.buildRoute();
  }

  next(i) {
    let [nextIndex, minDistanceSoFar] = [-1, Number.MAX_SAFE_INTEGER];
    for (let j = 1; j < this.n; j++) {
      if (i === j || this.visited.has(j)) continue;
      if (this.matrix[i][j] < minDistanceSoFar) {
        nextIndex = j;
        minDistanceSoFar = this.matrix[i][j];
      }
    }
    return nextIndex;
  }

  /*
      We always start from 0,
      the pickup.
      Please note that the pickup is not included in the
      multi stop route as it contain only dropoffs.
      Array length is the number of packages and dropoffs stops.
    */
  clearRoute() {
    this.current = 0;
    this.currentRoute = new Array();
  }
}

module.exports = { GreedyOnion };

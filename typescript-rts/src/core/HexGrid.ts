/**
 * Hexagonal coordinate system using axial coordinates (q, r)
 * Based on Red Blob Games hexagonal grid implementation
 */

export interface HexCoordinate {
  q: number; // column
  r: number; // row
}

export interface CubeCoordinate {
  x: number;
  y: number;
  z: number;
}

export class HexGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly hexSize: number;

  constructor(width: number, height: number, hexSize: number = 1) {
    this.width = width;
    this.height = height;
    this.hexSize = hexSize;
  }

  /**
   * Convert axial coordinates to cube coordinates
   */
  axialToCube(hex: HexCoordinate): CubeCoordinate {
    const x = hex.q;
    const z = hex.r;
    const y = -x - z;
    return { x, y, z };
  }

  /**
   * Convert cube coordinates to axial coordinates
   */
  cubeToAxial(cube: CubeCoordinate): HexCoordinate {
    return { q: cube.x, r: cube.z };
  }

  /**
   * Calculate distance between two hexagonal coordinates
   */
  distance(a: HexCoordinate, b: HexCoordinate): number {
    const cubeA = this.axialToCube(a);
    const cubeB = this.axialToCube(b);
    
    return Math.max(
      Math.abs(cubeA.x - cubeB.x),
      Math.abs(cubeA.y - cubeB.y),
      Math.abs(cubeA.z - cubeB.z)
    );
  }

  /**
   * Get all neighboring hexes
   */
  getNeighbors(hex: HexCoordinate): HexCoordinate[] {
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];

    return directions
      .map(dir => ({ q: hex.q + dir.q, r: hex.r + dir.r }))
      .filter(neighbor => this.isValidCoordinate(neighbor));
  }

  /**
   * Check if coordinate is within grid bounds
   */
  isValidCoordinate(hex: HexCoordinate): boolean {
    return hex.q >= 0 && hex.q < this.width && 
           hex.r >= 0 && hex.r < this.height;
  }

  /**
   * Get all hexes within a certain range
   */
  getHexesInRange(center: HexCoordinate, range: number): HexCoordinate[] {
    const results: HexCoordinate[] = [];
    
    for (let q = -range; q <= range; q++) {
      const r1 = Math.max(-range, -q - range);
      const r2 = Math.min(range, -q + range);
      
      for (let r = r1; r <= r2; r++) {
        const hex = { q: center.q + q, r: center.r + r };
        if (this.isValidCoordinate(hex)) {
          results.push(hex);
        }
      }
    }
    
    return results;
  }

  /**
   * Find path between two hexes using A* algorithm
   */
  findPath(start: HexCoordinate, goal: HexCoordinate, obstacles: Set<string> = new Set()): HexCoordinate[] {
    const openSet = new Set<string>();
    const cameFrom = new Map<string, HexCoordinate>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startKey = this.coordToKey(start);
    const goalKey = this.coordToKey(goal);

    openSet.add(startKey);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.distance(start, goal));

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current = '';
      let lowestF = Infinity;
      for (const node of openSet) {
        const f = fScore.get(node) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = node;
        }
      }

      if (current === goalKey) {
        // Reconstruct path
        const path: HexCoordinate[] = [];
        let currentCoord = goal;
        path.push(currentCoord);

        while (cameFrom.has(this.coordToKey(currentCoord))) {
          currentCoord = cameFrom.get(this.coordToKey(currentCoord))!;
          path.push(currentCoord);
        }

        return path.reverse();
      }

      openSet.delete(current);
      const currentCoord = this.keyToCoord(current);
      const neighbors = this.getNeighbors(currentCoord);

      for (const neighbor of neighbors) {
        const neighborKey = this.coordToKey(neighbor);
        
        if (obstacles.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = (gScore.get(current) || 0) + 1;

        if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)!) {
          cameFrom.set(neighborKey, currentCoord);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(neighborKey, tentativeGScore + this.distance(neighbor, goal));

          if (!openSet.has(neighborKey)) {
            openSet.add(neighborKey);
          }
        }
      }
    }

    return []; // No path found
  }

  /**
   * Convert coordinate to string key for maps/sets
   */
  coordToKey(hex: HexCoordinate): string {
    return `${hex.q},${hex.r}`;
  }

  /**
   * Convert string key back to coordinate
   */
  keyToCoord(key: string): HexCoordinate {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  /**
   * Convert hex coordinate to pixel position (for rendering)
   */
  hexToPixel(hex: HexCoordinate): { x: number; y: number } {
    const x = this.hexSize * (3/2 * hex.q);
    const y = this.hexSize * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  }

  /**
   * Convert pixel position to hex coordinate
   */
  pixelToHex(x: number, y: number): HexCoordinate {
    const q = (2/3 * x) / this.hexSize;
    const r = (-1/3 * x + Math.sqrt(3)/3 * y) / this.hexSize;
    return this.roundHex({ q, r });
  }

  /**
   * Round fractional hex coordinates to nearest hex
   */
  private roundHex(hex: { q: number; r: number }): HexCoordinate {
    const cube = this.axialToCube(hex);
    let rx = Math.round(cube.x);
    let ry = Math.round(cube.y);
    let rz = Math.round(cube.z);

    const xDiff = Math.abs(rx - cube.x);
    const yDiff = Math.abs(ry - cube.y);
    const zDiff = Math.abs(rz - cube.z);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }

    return this.cubeToAxial({ x: rx, y: ry, z: rz });
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getHexSize(): number {
    return this.hexSize;
  }
}

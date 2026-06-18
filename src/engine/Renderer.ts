import * as THREE from "three";

// Owns the WebGL renderer and the resize lifecycle.
export class Renderer {
  readonly three: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    this.three = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.three.setSize(window.innerWidth, window.innerHeight);
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.three.domElement);
  }

  get domElement(): HTMLCanvasElement {
    return this.three.domElement;
  }

  attachResize(camera: THREE.PerspectiveCamera): void {
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      this.three.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.three.render(scene, camera);
  }
}

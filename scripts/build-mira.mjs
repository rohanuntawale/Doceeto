import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const model = new THREE.Group();
model.name = "Mira";
const ceramic = new THREE.MeshStandardMaterial({ color: "#f4f1e8", roughness: 0.25, metalness: 0.12 });
const green = new THREE.MeshStandardMaterial({ color: "#153d32", roughness: 0.35 });
const gold = new THREE.MeshStandardMaterial({ color: "#c9a13f", roughness: 0.22, metalness: 0.5 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#a2d9c6", emissiveIntensity: 0.5 });
function sphere(name, scale, position, material, parent = model) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
  mesh.name = name;
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
sphere("Body", [0.52, 0.62, 0.4], [0, -0.4, 0], ceramic);
const head = new THREE.Group(); head.name = "Head"; head.position.y = 0.55; model.add(head);
sphere("Shell", [0.7, 0.59, 0.52], [0, 0, 0], ceramic, head);
sphere("Face", [0.56, 0.38, 0.16], [0, 0.01, 0.43], green, head);
sphere("EyeLeft", [0.08, 0.12, 0.035], [-0.22, 0.06, 0.587], eyeMaterial, head);
sphere("EyeRight", [0.08, 0.12, 0.035], [0.22, 0.06, 0.587], eyeMaterial, head);
sphere("Mouth", [0.115, 0.028, 0.028], [0, -0.13, 0.593], eyeMaterial, head);
sphere("EarLeft", [0.12, 0.19, 0.17], [-0.69, 0, 0], gold, head);
sphere("EarRight", [0.12, 0.19, 0.17], [0.69, 0, 0], gold, head);
sphere("HandLeft", [0.16, 0.34, 0.17], [-0.68, -0.34, 0], ceramic);
sphere("HandRight", [0.16, 0.34, 0.17], [0.68, -0.34, 0], ceramic);
sphere("Heart", [0.10, 0.10, 0.035], [0, -0.3, 0.4], gold);
const binary = await new GLTFExporter().parseAsync(model, { binary: true });
await mkdir("public/models", { recursive: true });
await writeFile("public/models/mira.glb", Buffer.from(binary));
console.log("Created public/models/mira.glb");

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

// Add BVH methods to THREE
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Scene Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121212);

// Camera
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(100, 100, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
dirLight2.position.set(-100, -100, -50);
scene.add(dirLight2);

// Grid Helper
const gridHelper = new THREE.GridHelper(200, 50, 0x444444, 0x222222);
scene.add(gridHelper);

// Cutting Plane Visual
const planeGeo = new THREE.PlaneGeometry(150, 150);
const planeMat = new THREE.MeshBasicMaterial({ 
    color: 0x4CAF50, 
    transparent: true, 
    opacity: 0.3, 
    side: THREE.DoubleSide,
    depthWrite: false
});
const cuttingPlaneVisual = new THREE.Mesh(planeGeo, planeMat);
// Start flat on Z axis
cuttingPlaneVisual.rotation.x = -Math.PI / 2; 
scene.add(cuttingPlaneVisual);

let currentAxis = 'z';
let modelBoundingBox = new THREE.Box3();
let modelCenter = new THREE.Vector3();
let modelSize = new THREE.Vector3();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- Drag and Drop File Handling ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const loadingIndicator = document.getElementById('loading');
let originalMesh = null; // The loaded mesh
let resultMeshes = []; // The split meshes

// Click to upload
dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;

    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    const isStl = file.name.toLowerCase().endsWith('.stl');
    const is3mf = file.name.toLowerCase().endsWith('.3mf');

    if (!isStl && !is3mf) {
        alert("Only .stl and .3mf files are supported.");
        return;
    }

    loadingIndicator.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        if (isStl) {
            loadSTL(contents);
        } else if (is3mf) {
            load3MF(contents);
        }
    };
    reader.readAsArrayBuffer(file);
}

function clearResults() {
    resultMeshes.forEach(m => {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
    });
    resultMeshes = [];
}

function loadSTL(arrayBuffer) {
    const loader = new STLLoader();
    try {
        const geometry = loader.parse(arrayBuffer);
        setupModelGeometry(geometry);
    } catch (error) {
        console.error("Error parsing STL:", error);
        alert("Error loading STL file.");
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function load3MF(arrayBuffer) {
    const loader = new ThreeMFLoader();
    try {
        const group = loader.parse(arrayBuffer);
        
        let targetGeometry = null;
        
        group.traverse((child) => {
            if (child.isMesh && !targetGeometry) {
                targetGeometry = child.geometry.clone();
                // Apply transformations from the 3MF hierarchy
                child.updateMatrixWorld(true);
                targetGeometry.applyMatrix4(child.matrixWorld);
            }
        });

        if (targetGeometry) {
            setupModelGeometry(targetGeometry);
        } else {
             throw new Error("No meshes found in 3MF");
        }

    } catch (error) {
        console.error("Error parsing 3MF:", error);
        alert("Error loading 3MF file.");
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function setupModelGeometry(geometry) {
        // Remove previous meshes
        if (originalMesh) {
            scene.remove(originalMesh);
            originalMesh.geometry.dispose();
            originalMesh.material.dispose();
        }
        clearResults();

        // compute BVH for performance
        geometry.computeBoundsTree();

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x909090, 
            roughness: 0.5,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        originalMesh = new THREE.Mesh(geometry, material);
        
        // Center the geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        originalMesh.position.sub(center);
        
        originalMesh.updateMatrixWorld(true);

        // Store bounds for cutting plane calculation
        modelBoundingBox.setFromObject(originalMesh);
        modelBoundingBox.getCenter(modelCenter);
        modelBoundingBox.getSize(modelSize);

        scene.add(originalMesh);
        cuttingPlaneVisual.visible = true;
        updateCuttingPlane();

        // Adjust camera to fit
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        camera.position.set(maxDim, maxDim, maxDim);
        controls.target.set(0, 0, 0);
        controls.update();
}

// Basic UI Interactivity
const positionSlider = document.querySelector('input[type="range"]');

document.querySelectorAll('.button-group button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const group = e.target.closest('.button-group');
        
        // Handle Cut Mode (Plane vs Sketch)
        if (group.previousElementSibling && group.previousElementSibling.textContent === 'Cut Mode') {
            if (e.target.textContent === 'Sketch') {
                alert("O modo 'Sketch' (desenho livre) é bastante avançado e não está implementado neste MVP. Retornando ao modo 'Plane'.");
                return; // don't make it active
            }
        }
        
        group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
    });
});

function updateCuttingPlane() {
    if (!originalMesh) return;
    
    // reset rotation
    cuttingPlaneVisual.rotation.set(0, 0, 0);
    
    // percent from -50 to 50
    const percent = parseFloat(positionSlider.value) / 100;

    let offset = 0;
    if (currentAxis === 'x') {
        cuttingPlaneVisual.rotation.y = Math.PI / 2;
        offset = percent * modelSize.x;
        cuttingPlaneVisual.position.set(offset, 0, 0);
    } else if (currentAxis === 'y') {
        cuttingPlaneVisual.rotation.x = Math.PI / 2; // Flat on Y means facing up, wait. 
        // Plane is XY by default, facing +Z.
        // To cut along Y (plane normal is Y), rotate X by PI/2
        cuttingPlaneVisual.rotation.x = -Math.PI / 2;
        offset = percent * modelSize.y;
        cuttingPlaneVisual.position.set(0, offset, 0);
    } else if (currentAxis === 'z') {
        // Plane normal is Z. Default geometry normal is Z, so no rotation needed
        cuttingPlaneVisual.rotation.set(0,0,0);
        offset = percent * modelSize.z;
        cuttingPlaneVisual.position.set(0, 0, offset);
    }
}

positionSlider.addEventListener('input', updateCuttingPlane);

document.querySelectorAll('.axis-group button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.axis-group button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentAxis = e.target.textContent.toLowerCase();
        updateCuttingPlane();
    });
});


document.querySelector('.split-btn').addEventListener('click', () => {
    if (!originalMesh) {
        alert("Please load a model first.");
        return;
    }

    loadingIndicator.textContent = "Processing CSG Cut...";
    loadingIndicator.classList.remove('hidden');

    // Timeout to allow UI to render the loading state
    setTimeout(() => {
        try {
            performSplit();
        } catch (err) {
            console.error("Split error:", err);
            alert("Error during split operation.");
        } finally {
            loadingIndicator.classList.add('hidden');
            loadingIndicator.textContent = "Loading Model...";
        }
    }, 50);
});

function performSplit() {
    // 1. Create Brushes for the target mesh and the cutting tool
    const modelBrush = new Brush(originalMesh.geometry, originalMesh.material);
    modelBrush.position.copy(originalMesh.position);
    modelBrush.rotation.copy(originalMesh.rotation);
    modelBrush.scale.copy(originalMesh.scale);
    modelBrush.updateMatrixWorld();

    // The cutting tool needs to be a solid volume, not a flat plane.
    // We create a very large box that represents "half" the world.
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z) * 10;
    const boxGeo = new THREE.BoxGeometry(maxDim, maxDim, maxDim);
    const boxMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    const cutterBrush = new Brush(boxGeo, boxMat);

    // Position the cutter box exactly where the visual plane is
    cutterBrush.position.copy(cuttingPlaneVisual.position);
    cutterBrush.rotation.copy(cuttingPlaneVisual.rotation);
    
    // Shift the box so its face aligns with the plane
    // Because BoxGeometry is centered, we move it back by half its size along its local Z axis
    cutterBrush.translateZ(-maxDim / 2);
    cutterBrush.updateMatrixWorld();

    // 2. Evaluate CSG
    const evaluator = new Evaluator();
    evaluator.useGroups = false;

    // Part A: Model SUBTRACT Cutter (The side not covered by the box)
    const resultA = evaluator.evaluate(modelBrush, cutterBrush, SUBTRACTION);
    
    // Part B: Model INTERSECT Cutter (The side covered by the box)
    const resultB = evaluator.evaluate(modelBrush, cutterBrush, INTERSECTION);

    // 3. Render Results
    clearResults();
    
    // Hide original mesh and plane
    originalMesh.visible = false;
    cuttingPlaneVisual.visible = false;

    // Give them distinct colors
    const matA = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
    const matB = new THREE.MeshStandardMaterial({ color: 0x4ecdc4, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });

    resultA.material = matA;
    resultB.material = matB;

    // Slightly separate them so the cut is visible
    const separation = 2; // mm
    const dir = new THREE.Vector3(0,0,1).applyEuler(cuttingPlaneVisual.rotation).normalize();
    
    resultA.position.addScaledVector(dir, separation);
    resultB.position.addScaledVector(dir, -separation);

    scene.add(resultA);
    scene.add(resultB);
    resultMeshes.push(resultA, resultB);

    document.querySelector('.split-btn').textContent = "Reset";
    document.querySelector('.split-btn').onclick = () => {
        clearResults();
        originalMesh.visible = true;
        cuttingPlaneVisual.visible = true;
        document.querySelector('.split-btn').textContent = "Split Model";
        document.querySelector('.split-btn').onclick = null;
        // reattach listener - a bit hacky but works for MVP
        location.reload(); 
    };
}

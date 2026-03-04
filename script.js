// --- CONFIGURACIÓN GLOBAL ---
let scene, camera, renderer, particles;
const particleCount = 15000; 
let shapes = { hani: [], heart: [], mensaje: [] };
let targetShapeName = 'heart'; 
let isInteracting = false;      
let isFontLoaded = false;

// Rotación controlada por mano
let targetRotationX = 0;
let targetRotationY = 0;

const uiStatus = document.getElementById('status');
const colorPicker = document.getElementById('colorPicker');

// --- INICIO ---
initThreeJS();
calculateShapes().then(() => {
    initMediaPipe();
    animate();
});

function initThreeJS() {
    const canvas = document.getElementById('canvas3d');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0005); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.z = 1800; 

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 3000;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: colorPicker.value,
        size: 12, opacity: 1.0, transparent: false,
        blending: THREE.NormalBlending, sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    colorPicker.addEventListener('input', (e) => particles.material.color.set(e.target.value));
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

async function calculateShapes() {
    uiStatus.innerText = "🔨 Esculpiendo...";

    // A) CORAZÓN REDONDO
    let count = 0;
    while (count < particleCount) {
        const x = (Math.random() - 0.5) * 6; const y = (Math.random() - 0.5) * 6; const z = (Math.random() - 0.5) * 3;
        const a = x*x + (9/4)*y*y + z*z - 1;
        if (a*a*a - x*x*z*z*z - (9/80)*y*y*z*z*z <= 0) {
            shapes.heart.push(x * 350, z * 350, y * 350); count++;
        }
    }

    // B) TEXTOS
    const loader = new THREE.FontLoader();
    await new Promise((resolve) => {
        loader.load('https://unpkg.com/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
            
            const haniGeo = new THREE.TextGeometry('Hani', {
                font: font, size: 500, height: 150, curveSegments: 20,
                bevelEnabled: true, bevelThickness: 30, bevelSize: 10, bevelSegments: 5
            });
            haniGeo.center();
            sampleGeometry(haniGeo, shapes.hani);

            const fraseGeo = new THREE.TextGeometry('Eres increible\nenojona :D', {
                font: font, size: 210, height: 80, curveSegments: 15,
                bevelEnabled: true, bevelThickness: 15, bevelSize: 8, bevelSegments: 5
            });
            fraseGeo.center();
            sampleGeometry(fraseGeo, shapes.mensaje);

            isFontLoaded = true;
            resolve();
        });
    });
    uiStatus.innerText = "✋ ¡Listo!";
}

function sampleGeometry(geometry, targetArray) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const sampler = new THREE.MeshSurfaceSampler(mesh).build();
    const tempPosition = new THREE.Vector3();
    for (let i = 0; i < particleCount; i++) {
        sampler.sample(tempPosition);
        targetArray.push(tempPosition.x, tempPosition.y, tempPosition.z);
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (!isFontLoaded) return;
    const target = shapes[targetShapeName];
    const positions = particles.geometry.attributes.position.array;

    particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.1;
    particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.1;

    for (let i = 0; i < particleCount; i++) {
        const ix = i * 3; const iy = i * 3 + 1; const iz = i * 3 + 2;
        if (isInteracting) {
            positions[ix] += (target[ix] - positions[ix]) * 0.1;
            positions[iy] += (target[iy] - positions[iy]) * 0.1;
            positions[iz] += (target[iz] - positions[iz]) * 0.1;
        } else {
            positions[ix] += (Math.cos(Date.now() * 0.001 + i) * 15);
            positions[iy] += (Math.sin(Date.now() * 0.002 + i) * 15);
            positions[iz] += (Math.sin(Date.now() * 0.001 + i) * 15);
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}

function initMediaPipe() {
    const videoElement = document.getElementsByClassName('input_video')[0];
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.75});
    hands.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            detectarGesto(results.multiHandLandmarks[0]);
        }
    });
    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480
    });
    cameraUtils.start();
}

function detectarGesto(landmarks) {
    const thumbUp = landmarks[4].y < landmarks[3].y;
    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;
    const ringUp = landmarks[16].y < landmarks[14].y;
    const pinkyUp = landmarks[20].y < landmarks[18].y;
    
    const pinchDist = Math.sqrt(Math.pow(landmarks[4].x - landmarks[8].x, 2) + Math.pow(landmarks[4].y - landmarks[8].y, 2));

    // 1. PELLIZCO -> ROTAR 👌
    if (pinchDist < 0.05) {
        isInteracting = true; uiStatus.innerText = "👌 Rotando...";
        targetRotationY = (landmarks[9].x - 0.5) * 5; 
        targetRotationX = (landmarks[9].y - 0.5) * 5;
        return; 
    }
    // 2. PAZ -> HANI ✌️
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
        targetShapeName = 'hani'; isInteracting = true; uiStatus.innerText = "✌️ HANI"; return;
    }
    // 3. MINI CORAZÓN 🫰 (Distancia corta entre pulgar e índice + otros cerrados)
    const heartDist = Math.sqrt(Math.pow(landmarks[4].x - landmarks[8].x, 2) + Math.pow(landmarks[4].y - landmarks[8].y, 2));
    if (heartDist < 0.08 && !middleUp && !ringUp && !pinkyUp) {
        targetShapeName = 'heart'; isInteracting = true; uiStatus.innerText = "🫰 CORAZÓN"; return;
    }
    // 4. LLAMADA -> MENSAJE 🤙
    if (thumbUp && pinkyUp && !indexUp && !middleUp && !ringUp) {
        targetShapeName = 'mensaje'; isInteracting = true; uiStatus.innerText = "🤙 ERES INCREIBLE..."; return;
    }
    // 5. ABIERTA -> DISPERSAR ✋
    if (indexUp && middleUp && ringUp && pinkyUp) {
        isInteracting = false; uiStatus.innerText = "✋ Dispersando..."; return;
    }
}

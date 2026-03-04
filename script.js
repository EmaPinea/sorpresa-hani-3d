// --- CONFIGURACIÓN TOTAL ---
let scene, camera, renderer, particles;
const particleCount = 15000; // ¡15 mil puntos! Densidad extrema.
let currentPositions, targetPositions;
let shapes = { sphere: [], hani: [], heart: [] };
let currentShape = 'sphere'; 
let isInteracting = false;
let isFontLoaded = false;

// Referencias HTML
const colorPicker = document.getElementById('colorPicker');
const statusText = document.getElementById('status');

// Secuencia de inicio
initThreeJS();
// Calculamos formas (tarda 1-2 seg) y luego iniciamos cámara y animación
calculateShapes().then(() => {
    initMediaPipe();
    animate();
});

// 1. MOTOR GRÁFICO (THREE.JS)
function initThreeJS() {
    const canvas = document.getElementById('canvas3d');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0005); // Niebla muy leve

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.z = 1800; // Cámara lejos para ver el texto gigante

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Nube de puntos inicial
    const geometry = new THREE.BufferGeometry();
    currentPositions = new Float32Array(particleCount * 3);
    targetPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        currentPositions[i] = (Math.random() - 0.5) * 3000;
        targetPositions[i] = currentPositions[i];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    // Material de las partículas (Sólido y Grande)
    const material = new THREE.PointsMaterial({
        color: colorPicker.value,
        size: 12,       // TAMAÑO GIGANTE
        opacity: 1.0,   // SÓLIDO (Sin transparencia)
        transparent: false,
        blending: THREE.NormalBlending, // Color puro
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Cambiar color
    colorPicker.addEventListener('input', (e) => particles.material.color.set(e.target.value));
    
    // Ajustar pantalla
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 2. CÁLCULO DE FORMAS (EL CEREBRO)
async function calculateShapes() {
    statusText.innerText = "🔨 Esculpiendo 15,000 puntos...";

    // A) ESFERA GIGANTE
    for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        const r = 900;
        shapes.sphere.push(
            r * Math.cos(theta) * Math.sin(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(phi)
        );
    }

    // B) CORAZÓN REDONDO (Inflado)
    const heartSteps = Math.floor(Math.pow(particleCount, 1/3)); 
    // Generamos puntos aleatorios dentro de la fórmula del corazón para que se vea relleno
    let count = 0;
    while (count < particleCount) {
        // Intentamos puntos al azar en un cubo imaginario
        const x = (Math.random() - 0.5) * 6; // Ancho
        const y = (Math.random() - 0.5) * 6; // Alto
        const z = (Math.random() - 0.5) * 3; // Profundidad (Grosor)

        // Fórmula matemática de corazón 3D suave
        // (x^2 + 9/4y^2 + z^2 - 1)^3 - x^2z^3 - 9/80y^2z^3 <= 0
        const a = x*x + (9/4)*y*y + z*z - 1;
        if (a*a*a - x*x*z*z*z - (9/80)*y*y*z*z*z <= 0) {
            // Si el punto está DENTRO del corazón, lo guardamos
            shapes.heart.push(x * 350, z * 350, y * 350); // Escala 350
            count++;
        }
    }

    // C) TEXTO "Hani" SIN HUECOS (Surface Sampling)
    const loader = new THREE.FontLoader();
    await new Promise((resolve) => {
        loader.load('https://unpkg.com/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
            
            // Creamos la geometría del texto
            const textGeo = new THREE.TextGeometry('Hani', {
                font: font,
                size: 500,       // TAMAÑO MASIVO
                height: 150,     // MUY GRUESO
                curveSegments: 20,
                bevelEnabled: true,
                bevelThickness: 30,
                bevelSize: 10,
                bevelSegments: 5
            });
            textGeo.center();

            // MUESTREO DE SUPERFICIE (Esto tapa los huecos)
            // Creamos una malla invisible
            const mesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
            const sampler = new THREE.MeshSurfaceSampler(mesh).build();
            const tempPosition = new THREE.Vector3();

            // Pedimos 15,000 puntos exactos distribuidos en la superficie
            for (let i = 0; i < particleCount; i++) {
                sampler.sample(tempPosition);
                shapes.hani.push(tempPosition.x, tempPosition.y, tempPosition.z);
            }
            
            isFontLoaded = true;
            console.log("Hani generado.");
            resolve();
        });
    });

    statusText.innerText = "✅ ¡Listo! Usa tu mano.";
}

// Control botones
window.setShape = function(name) {
    if (!isFontLoaded && name === 'hani') return;
    currentShape = name;
    if (isInteracting) statusText.innerText = "✊ Formando " + name.toUpperCase();
}

// 3. ANIMACIÓN
function animate() {
    requestAnimationFrame(animate);
    
    // Seguridad: si piden Hani y no está listo, mostrar esfera
    let safeShape = (currentShape === 'hani' && !isFontLoaded) ? 'sphere' : currentShape;
    const target = shapes[safeShape];
    const positions = particles.geometry.attributes.position.array;

    if (!target || target.length === 0) return;

    for (let i = 0; i < particleCount; i++) {
        const ix = i * 3; const iy = i * 3 + 1; const iz = i * 3 + 2;

        if (isInteracting) {
            // MANO CERRADA: Atracción fuerte (Velocidad 0.1)
            positions[ix] += (target[ix] - positions[ix]) * 0.1;
            positions[iy] += (target[iy] - positions[iy]) * 0.1;
            positions[iz] += (target[iz] - positions[iz]) * 0.1;
        } else {
            // MANO ABIERTA: Explosión caótica
            positions[ix] += (Math.cos(Date.now() * 0.001 + i) * 15);
            positions[iy] += (Math.sin(Date.now() * 0.002 + i) * 15);
            positions[iz] += (Math.sin(Date.now() * 0.001 + i) * 15);
        }
    }

    particles.geometry.attributes.position.needsUpdate = true;
    
    // SIN ROTACIÓN (Comentado para que el texto se lea bien)
    // particles.rotation.y += 0.001; 

    renderer.render(scene, camera);
}

// 4. CÁMARA E IA (MEDIAPIPE)
function initMediaPipe() {
    const videoElement = document.getElementsByClassName('input_video')[0];
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            statusText.style.color = "#00ff00";
            // Puntos clave de la mano
            const landmarks = results.multiHandLandmarks[0];
            const thumb = landmarks[4]; // Pulgar 
            const index = landmarks[8]; // Índice

            // Calcular distancia entre dedos
            const distance = Math.sqrt(
                Math.pow(thumb.x - index.x, 2) + 
                Math.pow(thumb.y - index.y, 2)
            );

            // Si están cerca (< 0.05), activamos el efecto
            if (distance < 0.05) {
                isInteracting = true;
                statusText.innerText = "✊ Formando " + currentShape.toUpperCase();
            } else {
                isInteracting = false;
                statusText.innerText = "✋ Dispersando...";
            }
        } else {
            statusText.innerText = "Buscando mano...";
            statusText.style.color = "orange";
            isInteracting = false;
        }
    });

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480
    });
    cameraUtils.start();
}
let video = null;
let pose = null;
let cameraInstance = null;
let poses = [];
let feathers = [];
let waxDrops = [];
let seagulls = [];

let featherImg = null;
let cloudImg = null;
let leavesImg = null;
let minotaurImg = null;

// ----------------------------------------
// CONTROL DE PAUSA OPCIONAL
// (Arranca en Play de manera automática)
// ----------------------------------------
let isPaused = false;
let pauseStartMillis = 0;
let totalPausedDuration = 0;

// ----------------------------------------
// TEMPORIZACIÓN
// ----------------------------------------
let startTime = null;
const STORY_DURATION = 24000;      // 24s prólogo con lectura tranquila
const TRANSITION_DURATION = 3500;  // 3.5s consigna "¡ES HORA DE VOLAR!"
const FLIGHT_START = STORY_DURATION + TRANSITION_DURATION; // 27.5s

// Duración del vuelo
const FLIGHT_DURATION = 38000; 

let progress = 0;
let cameraStarted = false;
let cameraShutDown = false;

// Aleteo
let previousLeftY = null;
let previousRightY = null;
let leftFlap = 0;
let rightFlap = 0;
let flapStrength = 0;

// Rayo inicial
let lightningFlash = 0;
let currentLightning = null;
let lightningTriggered = false;

// Clímax final
let explosionTriggered = false;
let explosionFlash = 0;
let epilogueStartTime = 0;

// Nubes
let clouds = [];
let cloudCount = 12;

// ----------------------------------------
// PRELOAD
// ----------------------------------------
function preload() {
  featherImg = loadImage('pluma.png', 
    () => console.log("Pluma cargada OK"), 
    () => console.warn("No se encontró pluma.png")
  );

  leavesImg = loadImage('hojas.png',
    () => console.log("Hojas cargadas OK"), 
    () => console.warn("No se encontró hojas.png")
  );

  minotaurImg = loadImage('minotauro.png',
    () => console.log("Minotauro cargado OK"), 
    () => console.warn("No se encontró minotauro.png")
  );
}

// ----------------------------------------
// SETUP
// ----------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(60);

  loadImage('nube.png', (img) => {
    cloudImg = img;
  });

  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: random(width),
      y: random(height),
      scale: random(0.5, 1.1),
      speed: random(1.8, 3.4),
      alpha: random(110, 180),
      flip: random() < 0.5 ? 1 : -1
    });
  }

  for (let i = 0; i < 5; i++) {
    seagulls.push({
      x: random(-width * 0.5, 0),
      y: random(height * 0.2, height * 0.6),
      vx: random(2.2, 3.8),
      size: random(16, 28),
      wingAngle: random(TWO_PI),
      wingSpeed: random(0.08, 0.14)
    });
  }
}

// ----------------------------------------
// CONTROL DE CÁMARA
// ----------------------------------------
function startCameraTracking() {
  if (cameraStarted) return;
  cameraStarted = true;

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(gotPose);

  cameraInstance = new Camera(video.elt, {
    onFrame: async () => {
      if (pose && video && video.elt && !cameraShutDown && !isPaused) {
        await pose.send({ image: video.elt });
      }
    },
    width: 640,
    height: 480
  });

  cameraInstance.start().catch((err) => console.error("Error cámara:", err));
}

function stopCameraTracking() {
  if (cameraShutDown) return;
  cameraShutDown = true;
  if (cameraInstance && cameraInstance.stop) {
    cameraInstance.stop();
  }
  if (video && video.elt && video.elt.srcObject) {
    let tracks = video.elt.srcObject.getTracks();
    tracks.forEach(track => track.stop());
  }
  poses = [];
}

function gotPose(results) {
  if (!cameraShutDown && !isPaused) {
    poses = results.poseLandmarks || [];
  }
}

// ----------------------------------------
// PAUSA CON CLICK
// ----------------------------------------
function mousePressed() {
  isPaused = !isPaused;

  if (isPaused) {
    pauseStartMillis = millis();
  } else {
    totalPausedDuration += (millis() - pauseStartMillis);
  }
}

// ----------------------------------------
// DRAW
// ----------------------------------------
function draw() {
  if (startTime === null) {
    startTime = millis();
  }

  if (isPaused) {
    drawPauseOverlay();
    return;
  }

  let elapsed = (millis() - totalPausedDuration) - startTime;

  if (elapsed > FLIGHT_START) {
    progress = constrain((elapsed - FLIGHT_START) / FLIGHT_DURATION, 0, 1);
    
    if (!cameraStarted && progress < 0.88) {
      startCameraTracking();
    }
    
    if (progress >= 0.88 && !cameraShutDown) {
      stopCameraTracking();
    }
  } else {
    progress = 0;
  }

  // 1. Atmósfera gradual
  drawAtmosphere(elapsed);

  // 2. Nubes
  if (!explosionTriggered || explosionFlash > 10) {
    drawClouds(elapsed);
  }

  // 3. Gaviotas en la primera mitad del vuelo
  if (elapsed > FLIGHT_START && progress < 0.50 && !explosionTriggered) {
    drawSeagulls();
  }

  // 4. Rayo inicial
  if (elapsed > 3500 && !lightningTriggered) {
    triggerLightning();
    lightningTriggered = true;
  }
  updateAndDrawLightning();

  // 5. Tracking y alas
  if (poses.length > 0 && elapsed > FLIGHT_START && progress < 0.88) {
    let leftShoulder = getPoint(11);
    let rightShoulder = getPoint(12);
    let leftElbow = getPoint(13);
    let rightElbow = getPoint(14);
    let leftWrist = getPoint(15);
    let rightWrist = getPoint(16);

    if (
      leftShoulder &&
      rightShoulder &&
      leftElbow &&
      rightElbow &&
      leftWrist &&
      rightWrist
    ) {

      if (previousLeftY !== null) {
        let leftMovement = abs(leftWrist.y - previousLeftY);
        let rightMovement = abs(rightWrist.y - previousRightY);

        leftFlap = lerp(leftFlap, leftMovement, 0.2);
        rightFlap = lerp(rightFlap, rightMovement, 0.2);

        flapStrength = (leftFlap + rightFlap) / 2;
      }

      previousLeftY = leftWrist.y;
      previousRightY = rightWrist.y;

      let wingAlpha = map(elapsed, FLIGHT_START, FLIGHT_START + 1200, 0, 255, true);

      if (wingAlpha > 10) {
        drawStyledWings(leftShoulder, leftElbow, leftWrist, -1, leftFlap);
        drawStyledWings(rightShoulder, rightElbow, rightWrist, 1, rightFlap);
      }
    }
  }

  // 6. Gotas de cera
  if (progress >= 0.38 && progress < 1.0 && !explosionTriggered) {
    let intensity = map(progress, 0.38, 0.88, 0.12, 0.75);
    releaseMeltingWax(intensity);
  }

  // 7. Plumas ardientes previas
  if (progress >= 0.70 && progress < 1.0 && !explosionTriggered) {
    releaseFastBurnFeathers();
  }

  // 8. Físicas de plumas y cera
  updateFeathers();
  updateWaxDrops();

  // 9. Intro Cinemática (Solo título e indicaciones)
  drawCinematicPrologue(elapsed);

  // 10. Consigna: "¡ES HORA DE VOLAR!"
  drawPromptMessage(elapsed);

  // 11. Los 3 carteles en orden
  drawWarningBanner();

  // 12. Clímax: Explosión solar tras el último cartel (a partir de 0.88)
  if (progress >= 0.88) {
    triggerAndDrawExplosion();
  }
}

// =========================================================
// INDICADOR VISUAL DE PAUSA
// =========================================================
function drawPauseOverlay() {
  push();
  fill(0, 0, 0, 110);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  textFont('Caesar Dressing', 'serif');
  textSize(min(width * 0.065, 52));
  fill(255, 235, 190);
  noStroke();

  drawingContext.shadowBlur = 18;
  drawingContext.shadowColor = 'rgba(255, 190, 80, 0.85)';
  text("PAUSA", width / 2, height / 2 - 15);
  drawingContext.shadowBlur = 0;

  textFont('Georgia', 'serif');
  textStyle(ITALIC);
  textSize(min(width * 0.022, 19));
  fill(230, 235, 245, 210);
  text("Haz click para continuar", width / 2, height / 2 + 35);
  pop();
}

// =========================================================
// INTRO CINEMÁTICA SOLO CON TÍTULO
// =========================================================
function drawCinematicPrologue(elapsed) {
  if (elapsed >= 0 && elapsed < STORY_DURATION) {
    let alphaIn = map(elapsed, 0, 1200, 0, 255, true);
    let alphaOut = map(elapsed, STORY_DURATION - 1200, STORY_DURATION, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);

    let titleY = height * 0.5;
    let titleSize = min(width * 0.075, 72);
    textFont('Caesar Dressing', 'serif');
    textSize(titleSize);
    let textW = textWidth("EL MITO DE ÍCARO Y DÉDALO");

    // Hojas decorativas detrás del título
    if (leavesImg && leavesImg.width > 0) {
      let leafH = min(width * 0.22, 230);
      let leafW = leafH * (leavesImg.width / leavesImg.height);

      drawingContext.globalAlpha = (a / 255) * 0.85;
      imageMode(CENTER);

      let branchY = titleY + titleSize * 0.45;
      let branchXOffset = textW * 0.44;

      push();
      translate(width / 2 - branchXOffset, branchY);
      rotate(HALF_PI * 0.95);
      scale(1, -1);
      image(leavesImg, 0, 0, leafW, leafH);
      pop();

      push();
      translate(width / 2 + branchXOffset, branchY);
      rotate(-HALF_PI * 0.95);
      image(leavesImg, 0, 0, leafW, leafH);
      pop();
    }

    // Título resplandeciente dorado
    let titleGlow = 25 + sin(millis() * 0.004) * 8;
    drawingContext.globalAlpha = 1.0;
    noStroke();
    drawingContext.shadowBlur = titleGlow;
    drawingContext.shadowColor = `rgba(255, 215, 140, ${(a / 255) * 0.95})`;
    fill(255, 248, 235, a);
    text("EL MITO DE ÍCARO Y DÉDALO", width / 2, titleY);
    drawingContext.shadowBlur = 0;

    pop();
  }
}

// =========================================================
// CONSIGNA DE INICIO: "¡ES HORA DE VOLAR!"
// =========================================================
function drawPromptMessage(elapsed) {
  if (elapsed >= STORY_DURATION && elapsed < FLIGHT_START) {
    let alphaIn = map(elapsed, STORY_DURATION, STORY_DURATION + 800, 0, 255, true);
    let alphaOut = map(elapsed, FLIGHT_START - 800, FLIGHT_START, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);
    textFont('Caesar Dressing', 'serif');

    let promptSize = min(width * 0.068, 54);
    textSize(promptSize);
    fill(255, 255, 255, a);
    noStroke();
    text("¡ES HORA DE VOLAR!", width / 2, height / 2 - 15);

    textFont('Georgia', 'serif');
    textSize(min(width * 0.024, 20));
    fill(235, 245, 255, a * 0.9);
    text("Mueve tus brazos para ascender hacia el cielo...", width / 2, height / 2 + 35);
    pop();
  }
}

// =========================================================
// CARTELES NARRATIVOS DURANTE EL VUELO
// =========================================================
function drawWarningBanner() {
  if (progress >= 0.15 && progress < 0.32) {
    let alphaIn = map(progress, 0.15, 0.20, 0, 255, true);
    let alphaOut = map(progress, 0.27, 0.32, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);
    textFont('Caesar Dressing', 'serif');

    let titleSize = min(width * 0.058, 48);
    textSize(titleSize);

    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = `rgba(10, 30, 60, ${(a / 255) * 0.85})`;
    fill(255, 250, 240, a);
    noStroke();
    text("ÍCARO ESTÁ VOLANDO MUY ALTO", width / 2, height * 0.24);
    drawingContext.shadowBlur = 0;

    textFont('Georgia', 'serif');
    textSize(min(width * 0.024, 21));
    textStyle(ITALIC);
    fill(235, 245, 255, a * 0.95);
    text("¡Date prisa! Alcánzalo antes de que sea tarde...", width / 2, height * 0.24 + titleSize * 0.85);
    pop();
  }

  if (progress >= 0.42 && progress < 0.58) {
    let alphaIn = map(progress, 0.42, 0.46, 0, 255, true);
    let alphaOut = map(progress, 0.54, 0.58, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);
    textFont('Caesar Dressing', 'serif');

    let titleSize = min(width * 0.058, 48);
    textSize(titleSize);

    let pulse = 1 + sin(millis() * 0.006) * 0.03;

    drawingContext.shadowBlur = 24;
    drawingContext.shadowColor = `rgba(180, 50, 10, ${(a / 255) * 0.9})`;
    fill(255, 240, 215, a);
    noStroke();

    push();
    translate(width / 2, height * 0.24);
    scale(pulse);
    text("¿ESTÁS SEGURO DE SEGUIR ALETEANDO?", 0, 0);
    pop();

    drawingContext.shadowBlur = 0;

    textFont('Georgia', 'serif');
    textSize(min(width * 0.022, 20));
    fill(240, 245, 255, a * 0.95);
    text("La cera comienza a calentarse bajo la mirada del Sol...", width / 2, height * 0.24 + titleSize * 0.85);
    pop();
  }

  if (progress >= 0.64 && progress < 0.80) {
    let alphaIn = map(progress, 0.64, 0.68, 0, 255, true);
    let alphaOut = map(progress, 0.76, 0.80, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);
    textFont('Caesar Dressing', 'serif');

    let titleSize = min(width * 0.062, 52);
    textSize(titleSize);

    let shakeX = random(-2, 2);
    let shakeY = random(-2, 2);

    drawingContext.shadowBlur = 28;
    drawingContext.shadowColor = `rgba(255, 30, 0, ${(a / 255) * 0.95})`;
    fill(255, 220, 180, a);
    noStroke();

    push();
    translate(width / 2 + shakeX, height * 0.24 + shakeY);
    text("¡ÍCARO ESTÁ DEMASIADO CERCA DEL SOL!", 0, 0);
    pop();

    drawingContext.shadowBlur = 0;

    textFont('Georgia', 'serif');
    textSize(min(width * 0.024, 21));
    textStyle(ITALIC);
    fill(255, 235, 220, a * 0.98);
    text("¡La cera se derrite! ¡Las alas no resistirán!", width / 2, height * 0.24 + titleSize * 0.85);
    pop();
  }
}

// =========================================================
// ATMÓSFERA SÚPER GRADUAL
// =========================================================
function drawAtmosphere(elapsed) {
  let cTop, cBottom;

  if (elapsed < FLIGHT_START) {
    let t = map(elapsed, 0, FLIGHT_START, 0, 1);
    cTop = lerpColor(color(5, 8, 14), color(10, 15, 24), t);
    cBottom = lerpColor(color(12, 18, 28), color(20, 30, 45), t);

  } else if (progress < 0.35) {
    let t = map(progress, 0, 0.35, 0, 1);
    cTop = lerpColor(color(20, 105, 205), color(35, 115, 205), t);
    cBottom = lerpColor(color(150, 215, 255), color(180, 225, 245), t);

  } else if (progress < 0.60) {
    let t = map(progress, 0.35, 0.60, 0, 1);
    let c1Top = color(35, 115, 205);
    let c1Bottom = color(180, 225, 245);
    let c2Top = color(75, 80, 145);
    let c2Bottom = color(235, 185, 120);

    cTop = lerpColor(c1Top, c2Top, t);
    cBottom = lerpColor(c1Bottom, c2Bottom, t);

  } else if (progress < 0.80) {
    let t = map(progress, 0.60, 0.80, 0, 1);
    let c2Top = color(75, 80, 145);
    let c2Bottom = color(235, 185, 120);
    let c3Top = color(145, 30, 25);
    let c3Bottom = color(245, 110, 30);

    cTop = lerpColor(c2Top, c3Top, t);
    cBottom = lerpColor(c2Bottom, c3Bottom, t);

  } else {
    let t = map(progress, 0.80, 1.0, 0, 1);
    let c3Top = color(145, 30, 25);
    let c3Bottom = color(245, 110, 30);
    let c4Top = color(215, 10, 5);
    let c4Bottom = color(255, 45, 10);

    cTop = lerpColor(c3Top, c4Top, t);
    cBottom = lerpColor(c3Bottom, c4Bottom, t);
  }

  let ctx = drawingContext;
  let gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, cTop.toString());
  gradient.addColorStop(1, cBottom.toString());
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// =========================================================
// NUBES
// =========================================================
function drawClouds(elapsed) {
  let cloudTint;

  if (elapsed < FLIGHT_START) {
    cloudTint = color(190, 205, 220);
  } else if (progress < 0.45) {
    cloudTint = color(255, 255, 255);
  } else {
    cloudTint = lerpColor(color(255, 255, 255), color(255, 90, 40), (progress - 0.45) / 0.55);
  }

  let heightSpeedMultiplier = map(progress, 0.15, 0.88, 1.0, 3.2, true);
  let playerSpeedBoost = map(flapStrength, 0, 15, 1, 2.0, true);

  push();
  blendMode(BLEND);
  imageMode(CENTER);

  for (let c of clouds) {
    c.y += (elapsed < FLIGHT_START ? c.speed : c.speed * heightSpeedMultiplier * playerSpeedBoost);

    if (c.y > height + 250) {
      c.y = -200;
      c.x = random(width);
      c.scale = random(0.5, 1.1);
      c.flip = random() < 0.5 ? 1 : -1;
    }

    if (cloudImg && cloudImg.width > 0) {
      push();
      translate(c.x, c.y);
      scale(c.scale * c.flip, c.scale);
      tint(red(cloudTint), green(cloudTint), blue(cloudTint), c.alpha);
      image(cloudImg, 0, 0);
      pop();
    } else {
      noStroke();
      fill(red(cloudTint), green(cloudTint), blue(cloudTint), c.alpha * 0.4);
      ellipse(c.x, c.y, 280 * c.scale, 110 * c.scale);
    }
  }
  pop();
}

// =========================================================
// MAR ICARIO GENERADO POR CÓDIGO
// =========================================================
function drawAnimatedSea(seaAlpha) {
  push();
  let seaBaseY = height * 0.70;
  let t = millis() * 0.0015;

  noStroke();
  fill(6, 12, 22, seaAlpha * 0.95);
  rect(0, seaBaseY, width, height - seaBaseY);

  fill(10, 22, 38, seaAlpha * 0.85);
  beginShape();
  vertex(0, height);
  for (let x = 0; x <= width; x += 30) {
    let y = seaBaseY + sin(x * 0.006 + t * 1.2) * 14 + cos(x * 0.003 - t * 0.8) * 8;
    vertex(x, y);
  }
  vertex(width, height);
  endShape(CLOSE);

  stroke(218, 175, 105, seaAlpha * 0.35);
  strokeWeight(1.8);
  fill(12, 28, 48, seaAlpha * 0.9);
  beginShape();
  vertex(0, height);
  for (let x = 0; x <= width; x += 25) {
    let y = seaBaseY + 28 + sin(x * 0.008 - t * 1.5) * 12 + sin(x * 0.004 + t) * 6;
    vertex(x, y);
  }
  vertex(width, height);
  endShape(CLOSE);

  stroke(245, 220, 160, seaAlpha * 0.4);
  strokeWeight(1.5);
  fill(8, 18, 32, seaAlpha * 0.95);
  beginShape();
  vertex(0, height);
  for (let x = 0; x <= width; x += 20) {
    let y = seaBaseY + 55 + sin(x * 0.01 + t * 1.8) * 10;
    vertex(x, y);
  }
  vertex(width, height);
  endShape(CLOSE);

  pop();
}

// =========================================================
// PLUMAS ARDIENTES LATERALES PARA EL TÍTULO FINAL
// =========================================================
function drawBurningFeatherDecor(x, y, scaleX, alphaVal) {
  if (!featherImg || featherImg.width === 0) return;

  push();
  translate(x, y);
  scale(scaleX, 1);
  rotate(0.35 + sin(millis() * 0.004) * 0.05);
  imageMode(CENTER);

  let pWidth = min(width * 0.16, 180);
  let pHeight = pWidth * (featherImg.height / featherImg.width);

  // Resplandor de fuego en la pluma
  blendMode(ADD);
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = `rgba(255, 80, 20, ${(alphaVal / 255) * 0.9})`;

  tint(255, 60, 10, alphaVal * 0.85);
  image(featherImg, 0, 0, pWidth * 1.05, pHeight * 1.05);

  tint(255, 200, 70, alphaVal);
  image(featherImg, 0, 0, pWidth, pHeight);

  drawingContext.shadowBlur = 0;
  pop();
}

// =========================================================
// CLÍMAX: FOGONAZO -> ROJO -> MAR CON REFLEXIÓN -> TÍTULO CON PLUMAS EN LLAMAS
// =========================================================
function triggerAndDrawExplosion() {
  if (!explosionTriggered) {
    explosionTriggered = true;
    explosionFlash = 255;
    epilogueStartTime = millis();

    feathers = [];
    waxDrops = [];
  }

  let epilogueElapsed = millis() - epilogueStartTime;

  // Lluvia densa durante la fase roja (0 a 8.2s)
  if (epilogueElapsed < 8200 && random() < 0.38 && feathers.length < 45) {
    feathers.push({
      x: width * 0.5 + random(-width * 0.48, width * 0.48),
      y: -30,
      vx: random(-3.0, 3.0),
      vy: random(5.5, 11.0),
      gravity: 0.16,
      swayFreq: 0.05,
      swayAmp: 2.8,
      phase: random(TWO_PI),
      rotation: random(TWO_PI),
      rotationSpeed: random(-0.05, 0.05),
      size: random(65, 105),
      flipX: random() < 0.5 ? 1 : -1,
      flipY: random() < 0.5 ? 1 : -1,
      alpha: 255,
      alphaSpeed: 1.1,
      type: 'icarusBurn'
    });
  }

  // PLUMAS POQUITAS Y LENTAS CAYENDO HACIA EL MAR (a partir de 8.5s)
  if (epilogueElapsed >= 8500 && random() < 0.06 && feathers.length < 7) {
    feathers.push({
      x: random(width * 0.1, width * 0.9),
      y: -20,
      vx: random(-0.8, 0.8),
      vy: random(1.2, 2.4),
      gravity: 0.02,
      swayFreq: 0.025,
      swayAmp: 1.8,
      phase: random(TWO_PI),
      rotation: random(TWO_PI),
      rotationSpeed: random(-0.015, 0.015),
      size: random(45, 75),
      flipX: random() < 0.5 ? 1 : -1,
      flipY: random() < 0.5 ? 1 : -1,
      alpha: 210,
      alphaSpeed: 0.35,
      type: 'icarusBurn'
    });
  }

  // Fogonazo inicial
  if (explosionFlash > 0) {
    push();
    blendMode(ADD);
    fill(255, 235, 200, explosionFlash);
    rect(0, 0, width, height);
    fill(255, 255, 255, explosionFlash * 0.95);
    rect(0, 0, width, height);
    pop();
    explosionFlash = lerp(explosionFlash, 0, 0.09);
  }

  // FONDO: Rojo brasa durante 8.5s y luego noche oscura
  push();
  if (epilogueElapsed < 8500) {
    let redTone = map(epilogueElapsed, 0, 8500, 200, 35);
    fill(redTone, 15, 8);
    rect(0, 0, width, height);
  } else {
    fill(4, 7, 14);
    rect(0, 0, width, height);
  }
  pop();

  // -------------------------------------------------------
  // PARTE 1: LA TRAGEDIA DE ÍCARO (EN CIELO ROJO)
  // Duración: 0.5s a 8.2s
  // -------------------------------------------------------
  if (epilogueElapsed >= 500 && epilogueElapsed < 8200) {
    let alphaIn = map(epilogueElapsed, 500, 1500, 0, 255, true);
    let alphaOut = map(epilogueElapsed, 7200, 8200, 255, 0, true);
    let a = min(alphaIn, alphaOut);

    push();
    textAlign(CENTER, CENTER);

    textFont('Caesar Dressing', 'serif');
    let titleSize = min(width * 0.058, 48);
    textSize(titleSize);
    noStroke();

    drawingContext.shadowBlur = 24;
    drawingContext.shadowColor = `rgba(0, 0, 0, ${(a / 255) * 0.9})`;
    fill(255, 230, 195, a);
    text("EL SOL HA CALCINADO LAS ALAS DE ÍCARO", width / 2, height * 0.44);
    drawingContext.shadowBlur = 0;

    textFont('Georgia', 'serif');
    textSize(min(width * 0.024, 21));
    textStyle(ITALIC);
    fill(245, 240, 230, a * 0.95);
    text("La cera cedió ante el calor implacable y el joven se hundió en el mar...", width / 2, height * 0.52);

    pop();
  }

  if (epilogueElapsed >= 8200 && epilogueElapsed < 8500 && feathers.length > 5) {
    feathers = [];
  }

  // -------------------------------------------------------
  // PARTE 2: EL MAR ICARIO + LA REFLEXIÓN POÉTICA
  // Duración: 8.8s a 19.5s
  // -------------------------------------------------------
  if (epilogueElapsed >= 8800) {
    // El mar se dibuja continuamente desde los 8.8s en adelante
    let seaAlpha = map(epilogueElapsed, 8800, 10200, 0, 255, true);
    drawAnimatedSea(seaAlpha);

    // Reflexión poética (hace fade-out antes de que aparezca el título final)
    if (epilogueElapsed < 19500) {
      let alphaIn = map(epilogueElapsed, 8800, 10200, 0, 255, true);
      let alphaOut = map(epilogueElapsed, 18500, 19500, 255, 0, true);
      let a = min(alphaIn, alphaOut);

      push();
      textAlign(CENTER, CENTER);
      rectMode(CENTER);

      stroke(218, 175, 105, a * 0.45);
      strokeWeight(1);
      line(width / 2 - 160, height * 0.22, width / 2 + 160, height * 0.22);
      line(width / 2 - 110, height * 0.56, width / 2 + 110, height * 0.56);
      noStroke();

      textFont('Georgia', 'serif');
      textStyle(ITALIC);
      let quoteSize = min(width * 0.028, 25);
      textSize(quoteSize);
      textLeading(quoteSize * 1.62);

      let textGlow = 24 + sin(millis() * 0.005) * 7;
      drawingContext.shadowBlur = textGlow;
      drawingContext.shadowColor = `rgba(255, 215, 140, ${(a / 255) * 0.92})`;
      fill(252, 244, 228, a);

      let finalQuote = "“Y ahora el cielo guarda por siempre la imagen de un vuelo perfecto y hermoso,\nmientras que la tierra se quedó con el eco de un llanto\nque ninguna de sus invenciones pudo consolar.”";
      
      text(finalQuote, width / 2, height * 0.39, min(width * 0.88, 920), height * 0.35);
      drawingContext.shadowBlur = 0;

      pop();
    }
  }

  // -------------------------------------------------------
  // PARTE 3: CIERRE CIRCULAR — EL TÍTULO SOBRE EL MAR CON PLUMAS EN LLAMAS
  // A partir de los 20 segundos
  // -------------------------------------------------------
  if (epilogueElapsed >= 20000) {
    let a = map(epilogueElapsed, 20000, 21800, 0, 255, true);

    push();
    textAlign(CENTER, CENTER);

    let titleY = height * 0.38;
    let titleSize = min(width * 0.075, 72);
    textFont('Caesar Dressing', 'serif');
    textSize(titleSize);
    let textW = textWidth("EL MITO DE ÍCARO Y DÉDALO");

    // Dos plumas prendidas fuego a los costados del título
    let featherXOffset = textW * 0.42;
    drawBurningFeatherDecor(width / 2 - featherXOffset, titleY, -1, a); // Izquierda
    drawBurningFeatherDecor(width / 2 + featherXOffset, titleY, 1, a);  // Derecha

    // Título con brillo dorado profundo
    let titleGlow = 26 + sin(millis() * 0.004) * 9;
    noStroke();
    drawingContext.shadowBlur = titleGlow;
    drawingContext.shadowColor = `rgba(255, 195, 100, ${(a / 255) * 0.95})`;
    fill(255, 246, 230, a);
    text("EL MITO DE ÍCARO Y DÉDALO", width / 2, titleY);
    drawingContext.shadowBlur = 0;

    // Epígrafe final sutil abajo del título
    textFont('Georgia', 'serif');
    textStyle(ITALIC);
    textSize(min(width * 0.022, 19));
    fill(218, 175, 105, a * 0.85);
    text("Fin", width / 2, titleY + titleSize * 0.85);

    pop();
  }
}

// =========================================================
// GAVIOTAS VOLANDO
// =========================================================
function drawSeagulls() {
  push();
  noFill();
  stroke(245, 250, 255, map(progress, 0.35, 0.50, 210, 0, true));
  strokeWeight(2.2);

  for (let g of seagulls) {
    g.x += g.vx;
    g.wingAngle += g.wingSpeed;

    if (g.x > width + 60) {
      g.x = -60;
      g.y = random(height * 0.2, height * 0.65);
      g.vx = random(2.2, 3.8);
    }

    let flapY = sin(g.wingAngle) * (g.size * 0.45);

    push();
    translate(g.x, g.y);
    beginShape();
    vertex(-g.size, flapY);
    quadraticVertex(-g.size * 0.45, -flapY * 0.5, 0, 0);
    quadraticVertex(g.size * 0.45, -flapY * 0.5, g.size, flapY);
    endShape();
    pop();
  }
  pop();
}

// =========================================================
// GOTAS DE CERA LÍQUIDA
// =========================================================
function releaseMeltingWax(rate) {
  if (random() < rate && waxDrops.length < 50) {
    waxDrops.push({
      x: random(width * 0.15, width * 0.85),
      y: random(-30, 0),
      vy: random(7, 14),
      length: random(18, 42),
      thickness: random(2.5, 5),
      color: color(255, random(185, 235), random(40, 85)),
      alpha: 255
    });
  }
}

function updateWaxDrops() {
  push();
  blendMode(ADD);
  for (let i = waxDrops.length - 1; i >= 0; i--) {
    let w = waxDrops[i];
    w.y += w.vy;
    w.vy += 0.38;

    stroke(red(w.color), green(w.color), blue(w.color), w.alpha);
    strokeWeight(w.thickness);
    line(w.x, w.y, w.x, w.y - w.length);

    noStroke();
    fill(255, 255, 210, w.alpha);
    circle(w.x, w.y, w.thickness * 1.4);

    if (w.y > height + 40) {
      waxDrops.splice(i, 1);
    }
  }
  pop();
}

// =========================================================
// PLUMAS ARDIENTES CAYENDO
// =========================================================
function releaseFastBurnFeathers() {
  if (random() < 0.48 && feathers.length < 50) {
    feathers.push({
      x: width * 0.5 + random(-width * 0.45, width * 0.45),
      y: -30,
      vx: random(-3.5, 3.5),
      vy: random(9.5, 17.5),
      gravity: 0.42,
      swayFreq: 0.08,
      swayAmp: 3.5,
      phase: random(TWO_PI),
      rotation: random(TWO_PI),
      rotationSpeed: random(-0.08, 0.08),
      size: random(65, 110),
      flipX: random() < 0.5 ? 1 : -1,
      flipY: random() < 0.5 ? 1 : -1,
      alpha: 255,
      alphaSpeed: 1.8,
      type: 'icarusBurn'
    });
  }
}

function updateFeathers() {
  for (let i = feathers.length - 1; i >= 0; i--) {
    let f = feathers[i];

    f.vy += f.gravity;
    f.phase += f.swayFreq;
    let swayX = sin(f.phase) * f.swayAmp;

    f.x += f.vx + swayX;
    f.y += f.vy;

    f.rotation += f.rotationSpeed;
    f.alpha -= f.alphaSpeed;

    drawFallingFeather(f);

    if (f.y > height + 80 || f.alpha <= 0) {
      feathers.splice(i, 1);
    }
  }
}

function drawFallingFeather(f) {
  if (!featherImg || featherImg.width === 0) return;

  push();
  translate(f.x, f.y);
  rotate(f.rotation);
  scale(f.flipX, f.flipY);
  imageMode(CENTER);

  let aspect = featherImg.height / featherImg.width;

  blendMode(ADD);
  tint(255, 75, 15, f.alpha);
  image(featherImg, 0, 0, f.size, f.size * aspect);
  tint(255, 210, 100, f.alpha * 0.85);
  image(featherImg, 0, 0, f.size * 0.7, f.size * 0.7 * aspect);

  pop();
}

// =========================================================
// ALAS ESTILIZADAS CON DOBLE CAPA DE PLUMAS
// =========================================================
function drawStyledWings(shoulder, elbow, wrist, side, movement) {
  push();
  let flapOffset = constrain(movement * 2.0, 0, 32);
  
  let wingColor = lerpColor(
    color(245, 250, 255, 240),
    color(255, 145, 45, 245),
    map(progress, 0.35, 0.88, 0, 1, true)
  );

  let coreGlow = lerpColor(
    color(170, 220, 255, 140),
    color(255, 65, 15, 210),
    map(progress, 0.35, 0.88, 0, 1, true)
  );

  drawingContext.shadowBlur = 22;
  drawingContext.shadowColor = coreGlow.toString();

  stroke(wingColor);
  strokeWeight(3.8);
  noFill();

  let tipX = wrist.x + side * (90 + flapOffset * 0.9);
  let tipY = wrist.y - (50 + flapOffset * 1.5);

  beginShape();
  curveVertex(shoulder.x, shoulder.y);
  curveVertex(shoulder.x, shoulder.y);
  curveVertex(elbow.x + side * 22, elbow.y - 18 - flapOffset * 0.45);
  curveVertex(wrist.x + side * 40, wrist.y - 30 - flapOffset * 0.95);
  curveVertex(tipX, tipY);
  curveVertex(tipX, tipY);
  endShape();

  drawingContext.shadowBlur = 0;

  // Capa superior: Coberteras
  let coverCount = 8;
  for (let j = 0; j < coverCount; j++) {
    let t = j / (coverCount - 1);
    let rootX = bezierPoint(shoulder.x, elbow.x, wrist.x, tipX, t * 0.75);
    let rootY = bezierPoint(shoulder.y, elbow.y, wrist.y, tipY, t * 0.75);
    let featherLen = lerp(30, 60, t);
    let baseAngle = side * (-0.25 + t * 0.40) - (flapOffset * 0.012 * side);
    drawFeatherBlade(rootX, rootY, featherLen, baseAngle, side, t, color(255, 255, 255, 160), 0.7);
  }

  // Capa inferior: Remeras largas
  let totalFeathers = 15;
  for (let i = 0; i < totalFeathers; i++) {
    let t = i / (totalFeathers - 1);
    let rootX = bezierPoint(shoulder.x, elbow.x, wrist.x, tipX, t);
    let rootY = bezierPoint(shoulder.y, elbow.y, wrist.y, tipY, t);

    let featherLen = lerp(50, 130, t) + sin(t * PI) * 22;
    let baseAngle = side * (-0.38 + t * 0.58) - (flapOffset * 0.018 * side);

    drawFeatherBlade(rootX, rootY, featherLen, baseAngle, side, t, wingColor, 1.0);
  }

  pop();
}

function drawFeatherBlade(x, y, len, angle, side, t, col, widthScale) {
  push();
  translate(x, y);
  rotate(angle);

  let w = lerp(11, 18, t) * widthScale;

  noStroke();
  fill(red(col), green(col), blue(col), map(t, 0, 1, 130, 220));
  
  beginShape();
  vertex(0, 0);
  bezierVertex(side * w * 0.65, -len * 0.35, side * w * 0.85, -len * 0.75, 0, -len);
  bezierVertex(-side * w * 0.35, -len * 0.75, -side * w * 0.25, -len * 0.35, 0, 0);
  endShape(CLOSE);

  stroke(255, 255, 255, 235);
  strokeWeight(1.4 * widthScale);
  line(0, 0, 0, -len * 0.96);

  pop();
}

// =========================================================
// RAYO INICIAL
// =========================================================
function triggerLightning() {
  let startX = random(width * 0.25, width * 0.75);
  let mainBranches = [];
  let segments = floor(random(12, 16));
  let curX = startX;
  let curY = -10;
  let totalH = height * 0.8;
  let stepY = totalH / segments;

  let path = [{ x: curX, y: curY }];

  for (let i = 0; i < segments; i++) {
    curX += random(-40, 40);
    curY += stepY + random(-10, 15);
    path.push({ x: curX, y: curY });

    if (random() < 0.35 && i < segments - 2) {
      let subPath = [{ x: curX, y: curY }];
      let subX = curX;
      let subY = curY;
      for (let j = 0; j < 4; j++) {
        subX += random(15, 30) * (random() < 0.5 ? -1 : 1);
        subY += random(10, 25);
        subPath.push({ x: subX, y: subY });
      }
      mainBranches.push(subPath);
    }
  }

  currentLightning = {
    main: path,
    sub: mainBranches,
    life: 255
  };

  lightningFlash = 220;
}

function updateAndDrawLightning() {
  if (lightningFlash > 0) {
    push();
    blendMode(ADD);
    noStroke();
    fill(210, 230, 255, lightningFlash * 0.55);
    rect(0, 0, width, height);
    pop();
    lightningFlash = lerp(lightningFlash, 0, 0.18);
  }

  if (currentLightning && currentLightning.life > 0) {
    push();
    blendMode(ADD);
    stroke(255, 255, 255, currentLightning.life);
    strokeWeight(2.5);
    noFill();

    beginShape();
    for (let pt of currentLightning.main) vertex(pt.x, pt.y);
    endShape();

    strokeWeight(1.5);
    for (let branch of currentLightning.sub) {
      beginShape();
      for (let pt of branch) vertex(pt.x, pt.y);
      endShape();
    }
    pop();

    currentLightning.life -= 28;
    if (currentLightning.life <= 0) {
      currentLightning = null;
    }
  }
}

// ========================================
// TRACKING DE PUNTOS
// ========================================
function getPoint(index) {
  if (!poses[index]) return null;
  return {
    x: width - poses[index].x * width,
    y: poses[index].y * height
  };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

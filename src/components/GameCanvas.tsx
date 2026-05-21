/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
"use client";

import React, { useRef, useEffect, useState } from "react";
import audioSystem from "./AudioSystem";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 450;

interface GameCanvasProps {
  playId: string | null;
  onGameOver: (score: number) => void;
  isMuted: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
}

interface Obstacle {
  x: number;
  yCenter: number;
  gap: number;
  width: number;
  passed: boolean;
  initialYCenter: number;
  spawnFrame: number;
  nearMissTriggered?: boolean;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
}

export default function GameCanvas({ playId, onGameOver, isMuted }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highScore, setHighScore] = useState<number>(0);
  
  // Internal state ref to bypass closures in requestAnimationFrame and event handlers
  const stateRef = useRef({
    playId,
    isPlaying: false,
    score: 0,
    birdY: 200,
    birdVY: 0,
    birdAngle: 0,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    shakeFrames: 0,
    shakeIntensity: 0,
    frameCount: 0,
    bgOffset: 0,
    isDead: false,
    width: 640,
    height: 450,
    waitingToStart: false,
    hasPlayedHighScoreSound: false,
    highScore: 0,
    isMuted,
    onGameOver,
    engineThrust: 0,
    gatePassRings: [] as { x: number; y: number; radius: number; maxRadius: number; alpha: number }[],
    warpFactor: 1.0,
    shieldPulse: 0.0,
    floatTexts: [] as FloatingText[],
  });

  // Synchronize dynamic props on every render to prevent stale closures
  stateRef.current.isMuted = isMuted;
  stateRef.current.onGameOver = onGameOver;

  // Keep track of parameters
  useEffect(() => {
    stateRef.current.playId = playId;
    if (playId) {
      resetGame();
    } else {
      stateRef.current.isPlaying = false;
      stateRef.current.isDead = false;
    }
  }, [playId]);

  // Load local high score on mount
  useEffect(() => {
    const saved = localStorage.getItem("flappy_high_score");
    if (saved) {
      const val = parseInt(saved, 10);
      setHighScore(val);
      stateRef.current.highScore = val;
    }
  }, []);

  function resetGame() {
    const state = stateRef.current;
    state.isPlaying = true;
    state.isDead = false;
    state.waitingToStart = true;
    state.hasPlayedHighScoreSound = false;
    state.score = 0;
    state.birdY = state.height / 2;
    state.birdVY = 0;
    state.birdAngle = 0;
    state.obstacles = [];
    state.particles = [];
    state.shakeFrames = 0;
    state.shakeIntensity = 0;
    state.frameCount = 0;
    state.engineThrust = 0;
    state.gatePassRings = [];
    state.warpFactor = 1.0;
    state.shieldPulse = 0.0;
    state.floatTexts = [];

    // Spawn first obstacle far enough
    spawnObstacle(state.width + 150);
  };

  function spawnObstacle(startX: number) {
    const state = stateRef.current;
    // Shrinking gap from 155px to 105px starting at score 5 (score - 4 >= 1)
    // Reduce gap by 4.5px per point starting at score 5, capping at 105px at score 16
    const gap = Math.max(105, 155 - Math.max(0, state.score - 4) * 4.5);
    const minMargin = 60;
    const range = state.height - 2 * minMargin - gap;
    const yCenter = minMargin + gap / 2 + Math.random() * range;

    state.obstacles.push({
      x: startX,
      yCenter,
      gap,
      width: 55,
      passed: false,
      initialYCenter: yCenter,
      spawnFrame: state.frameCount,
      nearMissTriggered: false,
    });
  };

  // Flap action
  function handleFlap() {
    const state = stateRef.current;
    if (!state.isPlaying || state.isDead) return;

    if (state.waitingToStart) {
      state.waitingToStart = false; // Launch the simulation!
    }

    state.birdVY = -5.8; // jump upward
    state.engineThrust = 1.0;
    state.warpFactor = 1.8; // Spike scrolling speed for warp inertia
    state.shieldPulse = 1.0; // Trigger flap shield pulse
    
    // Play sound
    if (!state.isMuted) {
      audioSystem.playFlap();
    }

    // Add engine burst particles
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x: 100, // Bird x is fixed at 100
        y: state.birdY + 5,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() - 0.5) * 3,
        color: i % 2 === 0 ? "#ff0055" : "#00f0ff", // Magenta & Cyan sparks
        size: Math.random() * 3 + 2,
        alpha: 1,
        decay: 0.04 + Math.random() * 0.03,
      });
    }
  };

  // Keyboard and touch events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when the user is typing in form inputs
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (stateRef.current.isPlaying && !stateRef.current.isDead) {
        if (e.code === "Space" || e.code === "ArrowUp") {
          e.preventDefault();
          handleFlap();
        }
      }
    };

    // Touch handler for mobile play — fires on the entire window
    // so the player can tap anywhere on screen while playing
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept touches on form inputs or buttons outside the canvas
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest("button") ||
          target.closest("a") ||
          target.closest("form"))
      ) {
        return;
      }

      if (stateRef.current.isPlaying && !stateRef.current.isDead) {
        e.preventDefault();
        handleFlap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Drawing loops
    let animationId: number;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = () => {
      update();
      draw(ctx);
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  function update() {
    const state = stateRef.current;
    state.frameCount++;

    // Parallax background scrolling (scaled by warpFactor for flap momentum)
    state.bgOffset = (state.bgOffset - 0.5 * state.warpFactor) % state.width;

    // Decay warpFactor towards 1.0
    state.warpFactor = Math.max(1.0, state.warpFactor - 0.02);

    // Decay shieldPulse towards 0.0
    state.shieldPulse = Math.max(0.0, state.shieldPulse - 0.04);

    // Update particles
    state.particles = state.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      return p.alpha > 0;
    });

    // Update floating texts
    state.floatTexts = state.floatTexts.filter((ft) => {
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      ft.scale = Math.max(0.6, ft.scale - 0.005);
      return ft.alpha > 0;
    });

    // Update engine exhaust thrust value
    state.engineThrust = Math.max(0, state.engineThrust - 0.05);

    // Update gate pass rings
    state.gatePassRings = state.gatePassRings.filter((ring) => {
      ring.radius += 3.5;
      ring.alpha -= 0.022;
      return ring.alpha > 0;
    });

    if (!state.isPlaying) {
      // In attract mode: bird bobs up and down smoothly
      state.birdY = state.height / 2 + Math.sin(state.frameCount / 15) * 15;
      state.birdAngle = Math.sin(state.frameCount / 15) * 0.15;
      return;
    }

    if (state.waitingToStart) {
      // Bob the ship up and down smoothly
      state.birdY = state.height / 2 + Math.sin(state.frameCount / 12) * 12;
      state.birdAngle = Math.sin(state.frameCount / 12) * 0.1;
      
      // Emit light fuel sparks / trail sparks
      if (state.frameCount % 3 === 0) {
        state.particles.push({
          x: 100 - 15,
          y: state.birdY + 2,
          vx: -1.5 - Math.random() * 1.5,
          vy: (Math.random() - 0.5) * 0.6,
          color: "#00f0ff", // Cyan trail spark
          size: Math.random() * 2 + 1,
          alpha: 0.8,
          decay: 0.03,
        });
      }
      return;
    }

    if (state.isDead) {
      // Bird falling animation on death
      state.birdVY += 0.4;
      state.birdY = Math.min(state.birdY + state.birdVY, state.height - 15);
      state.birdAngle = Math.min(state.birdAngle + 0.1, Math.PI / 2);
      return;
    }

    // Apply gravity
    state.birdVY += 0.33;
    state.birdY += state.birdVY;

    // Calculate bird angle based on velocity
    state.birdAngle = Math.min(Math.max(state.birdVY * 0.08, -0.5), 0.7);

    // Emit light thruster trail particles normally
    if (state.frameCount % 2 === 0) {
      state.particles.push({
        x: 100 - 15,
        y: state.birdY + 2,
        vx: -1.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: "#00f0ff", // cyan glow trail
        size: Math.random() * 2 + 1,
        alpha: 0.7,
        decay: 0.02,
      });
    }

    // Boundary check (ground and ceiling)
    if (state.birdY < 12) {
      state.birdY = 12;
      state.birdVY = 0;
    }
    if (state.birdY > state.height - 12) {
      triggerDeath();
    }

    // Update obstacles
    const obstacleSpeed = -2.6; // Constant speed matching anti-cheat timing
    state.obstacles.forEach((obs) => {
      obs.x += obstacleSpeed;

      // Apply vertical sine oscillation at score 5+
      if (state.score >= 5) {
        const age = state.frameCount - obs.spawnFrame;
        // Speed scales slightly with score, starting at 0.028
        const oscSpeed = 0.028 + Math.min(0.022, (state.score - 5) * 0.002);
        // Amplitude also scales, starting at 12px up to 35px
        const oscAmp = Math.min(35, 12 + (state.score - 5) * 1.5);
        
        // Calculate new yCenter
        const newYCenter = obs.initialYCenter + Math.sin(age * oscSpeed) * oscAmp;
        
        // Clamp to make sure the opening stays within minMargin (60px) from top and bottom
        const minMargin = 60;
        const minY = minMargin + obs.gap / 2;
        const maxY = state.height - minMargin - obs.gap / 2;
        obs.yCenter = Math.max(minY, Math.min(maxY, newYCenter));
      }

      // Pass check
      if (!obs.passed && obs.x < 100) {
        obs.passed = true;
        state.score++;
        
        // Spawn glowing pass shockwave ring
        state.gatePassRings.push({
          x: obs.x + obs.width / 2,
          y: obs.yCenter,
          radius: 15,
          maxRadius: 110,
          alpha: 0.8,
        });

        // Spawn "+1" floating text
        state.floatTexts.push({
          id: Date.now() + Math.random(),
          x: obs.x + obs.width / 2,
          y: obs.yCenter - 25,
          text: "+1",
          color: "#00f0ff",
          alpha: 1.0,
          scale: 1.2,
          vy: -1.0,
        });

        if (!state.isMuted) {
          if (state.highScore > 0 && state.score > state.highScore && !state.hasPlayedHighScoreSound) {
            audioSystem.playHighScore();
            state.hasPlayedHighScoreSound = true;
          } else {
            audioSystem.playScore();
          }
        }
        
        // Update local high score
        if (state.score > state.highScore) {
          setHighScore(state.score);
          state.highScore = state.score;
          localStorage.setItem("flappy_high_score", state.score.toString());
        }
      }

      // Collision and near-miss checks (Bird is a circle of radius 13 at x=100)
      const birdRadius = 13;
      const birdX = 100;

      const topHeight = obs.yCenter - obs.gap / 2;
      const bottomHeightStart = obs.yCenter + obs.gap / 2;
      const bottomHeight = state.height - bottomHeightStart;

      // Obstacle boundary check
      const inObstacleXRange = birdX + birdRadius > obs.x && birdX - birdRadius < obs.x + obs.width;
      
      // Near-miss check (only if we are in range and haven't triggered yet)
      if (inObstacleXRange && !state.isDead && !obs.nearMissTriggered) {
        const distTop = (state.birdY - birdRadius) - topHeight;
        const distBottom = bottomHeightStart - (state.birdY + birdRadius);

        if (distTop >= 0 && distBottom >= 0 && (distTop <= 10 || distBottom <= 10)) {
          obs.nearMissTriggered = true;
          state.score++; // Near miss grants 1 additional point!
          
          if (!state.isMuted) {
            audioSystem.playNearMiss();
          }

          // Golden spark burst at the dodged edge
          const sparkY = (distTop <= 10) ? topHeight : bottomHeightStart;
          for (let i = 0; i < 15; i++) {
            state.particles.push({
              x: 100 + (Math.random() - 0.5) * 20,
              y: sparkY + (Math.random() - 0.5) * 5,
              vx: -1 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 3,
              color: "#ffcc00", // Gold sparks
              size: Math.random() * 2.5 + 1.5,
              alpha: 1.0,
              decay: 0.03 + Math.random() * 0.02,
            });
          }

          // Floating text stunt popup
          state.floatTexts.push({
            id: Date.now() + Math.random(),
            x: 100,
            y: state.birdY - 20,
            text: "NEAR MISS! +50",
            color: "#ffcc00",
            alpha: 1.0,
            scale: 1.1,
            vy: -1.2,
          });

          // Update local high score for the extra near-miss point
          if (state.score > state.highScore) {
            setHighScore(state.score);
            state.highScore = state.score;
            localStorage.setItem("flappy_high_score", state.score.toString());
          }
        }
      }

      const hitTop = inObstacleXRange && state.birdY - birdRadius < topHeight;
      const hitBottom = inObstacleXRange && state.birdY + birdRadius > state.height - bottomHeight;

      if (hitTop || hitBottom) {
        triggerDeath();
      }
    });

    // Remove off-screen obstacles
    if (state.obstacles.length > 0 && state.obstacles[0].x < -state.obstacles[0].width) {
      state.obstacles.shift();
    }

    // Spawn new obstacles
    if (state.obstacles.length > 0) {
      const lastObs = state.obstacles[state.obstacles.length - 1];
      if (lastObs.x < state.width - 250) {
        spawnObstacle(state.width);
      }
    }
  };

  function triggerDeath() {
    const state = stateRef.current;
    if (state.isDead) return;

    state.isDead = true;
    state.shakeFrames = 18;
    state.shakeIntensity = 9;

    if (!state.isMuted) {
      audioSystem.playCrash();
    }

    // Explosion particles
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2;
      state.particles.push({
        x: 100,
        y: state.birdY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? "#ff0055" : "#00f0ff",
        size: Math.random() * 5 + 2,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02,
      });
    }

    // Play sad minor game-over melody shortly after crash
    if (!state.isMuted) {
      setTimeout(() => {
        audioSystem.playGameOverMelody();
      }, 500);
    }

    // Notify dashboard after animation plays
    setTimeout(() => {
      state.onGameOver(state.score);
    }, 1500);
  };

  function draw(ctx: CanvasRenderingContext2D) {
    const state = stateRef.current;

    // Apply Screen Shake
    ctx.save();
    if (state.shakeFrames > 0) {
      const dx = (Math.random() - 0.5) * state.shakeIntensity;
      const dy = (Math.random() - 0.5) * state.shakeIntensity;
      ctx.translate(dx, dy);
      state.shakeFrames--;
    }

    // Clear Canvas with rich dark retro space background
    ctx.fillStyle = "#0c071a";
    ctx.fillRect(0, 0, state.width, state.height);

    // Draw Parallax Nebulas (soft glowing radial gradients)
    const nebula1X = (state.width / 2) + Math.cos(state.frameCount * 0.002) * 100;
    const nebula1Y = (state.height / 2) + Math.sin(state.frameCount * 0.003) * 60;
    const grad1 = ctx.createRadialGradient(nebula1X, nebula1Y, 50, nebula1X, nebula1Y, 250);
    grad1.addColorStop(0, "rgba(46, 5, 60, 0.32)"); // Deep purple-pink nebula
    grad1.addColorStop(1, "rgba(12, 7, 26, 0)");
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.arc(nebula1X, nebula1Y, 250, 0, Math.PI * 2);
    ctx.fill();

    const nebula2X = (state.width * 0.8) + Math.sin(state.frameCount * 0.0015) * 80;
    const nebula2Y = (state.height * 0.3) + Math.cos(state.frameCount * 0.0025) * 50;
    const grad2 = ctx.createRadialGradient(nebula2X, nebula2Y, 30, nebula2X, nebula2Y, 180);
    grad2.addColorStop(0, "rgba(5, 40, 80, 0.25)"); // Deep cyan-blue nebula
    grad2.addColorStop(1, "rgba(12, 7, 26, 0)");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.arc(nebula2X, nebula2Y, 180, 0, Math.PI * 2);
    ctx.fill();

    // Draw Parallax Stars background (2 layers)
    // Layer 1 (Far, slow)
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let i = 0; i < 25; i++) {
      const starX = ((i * 57 + state.bgOffset * 0.2) % state.width + state.width) % state.width;
      const starY = (i * 23) % state.height;
      ctx.fillRect(starX, starY, 1, 1);
    }
    // Layer 2 (Near, faster)
    ctx.fillStyle = "rgba(0, 240, 255, 0.22)"; // Glowing cyan stars
    for (let i = 0; i < 15; i++) {
      const starX = ((i * 83 + state.bgOffset * 0.5) % state.width + state.width) % state.width;
      const starY = (i * 37) % state.height;
      const starSize = (i % 3 === 0) ? 2 : 1.2;
      ctx.fillRect(starX, starY, starSize, starSize);
    }

    // Synthwave Perspective Grid Floor
    const floorY = state.height - 35; // Floor start y
    const horizonY = floorY - 30;     // Horizon y
    
    // Horizon glow
    const horizonGlow = ctx.createLinearGradient(0, horizonY - 15, 0, floorY);
    horizonGlow.addColorStop(0, "rgba(255, 0, 85, 0)");
    horizonGlow.addColorStop(0.3, "rgba(255, 0, 85, 0.18)"); // Hot pink horizon pulse
    horizonGlow.addColorStop(1, "rgba(0, 240, 255, 0)");
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, horizonY - 15, state.width, 45);

    // Draw Synthwave Horizon Sun (Pulsating and sliced with scanlines)
    const sunRadius = 55;
    const sunX = state.width / 2;
    const sunY = horizonY;

    ctx.save();
    // Clip to upper half of the sun
    ctx.beginPath();
    ctx.rect(sunX - sunRadius - 10, sunY - sunRadius - 10, sunRadius * 2 + 20, sunRadius + 10);
    ctx.clip();

    // Pulse size gently
    const pulseRadius = sunRadius + Math.sin(state.frameCount * 0.03) * 1.5;

    // Create retro gradient
    const sunGrad = ctx.createLinearGradient(0, sunY - pulseRadius, 0, sunY);
    sunGrad.addColorStop(0.0, "#ff0055"); // Hot pink top
    sunGrad.addColorStop(0.5, "#ff5500"); // Orange mid
    sunGrad.addColorStop(1.0, "#ffcc00"); // Yellow bottom

    ctx.fillStyle = sunGrad;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#ff0055";
    ctx.beginPath();
    ctx.arc(sunX, sunY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cut horizontal slices
    ctx.fillStyle = "#0c071a";
    const sliceCount = 6;
    for (let i = 0; i < sliceCount; i++) {
      const sliceY = sunY - (i + 1) * (pulseRadius / (sliceCount + 1));
      const sliceHeight = 2.5 + i * 1.5; // Thicker towards bottom
      ctx.fillRect(sunX - pulseRadius - 10, sliceY, pulseRadius * 2 + 20, sliceHeight);
    }
    ctx.restore();

    // Draw vanishing perspective grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    const centerX = state.width / 2;
    const numVanishingLines = 18;
    for (let i = -numVanishingLines; i <= numVanishingLines; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX, horizonY);
      // Project lines outward to the bottom edge, shifting slightly with background offset
      const targetX = centerX + i * 50;
      ctx.lineTo(targetX + (state.bgOffset * 0.6) % 50, state.height);
      ctx.stroke();
    }
    
    // Draw horizontal perspective grid lines
    const numHorizontalLines = 7;
    for (let i = 0; i < numHorizontalLines; i++) {
      const animOffset = ((state.bgOffset * 0.4) % 40) / 40; // Scrolling factor
      const ratio = (i + animOffset) / numHorizontalLines;
      const ay = horizonY + (state.height - horizonY) * Math.pow(ratio, 2);
      
      // Lines fade out closer to the horizon
      const opacity = ratio * 0.14;
      ctx.strokeStyle = `rgba(0, 240, 255, ${opacity})`;
      ctx.beginPath();
      ctx.moveTo(0, ay);
      ctx.lineTo(state.width, ay);
      ctx.stroke();
    }

    // Draw Obstacles (Pillars)
    state.obstacles.forEach((obs, idx) => {
      // Dynamically calculate heights based on yCenter and gap
      const topHeight = obs.yCenter - obs.gap / 2;
      const bottomHeight = state.height - (obs.yCenter + obs.gap / 2);

      // Glow filter settings
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;

      // Draw Top Pillar
      ctx.shadowColor = "#ff0055"; // Pink neon glow for top gate
      ctx.strokeStyle = "#ff0055";
      ctx.fillStyle = "rgba(255, 0, 85, 0.08)";
      
      ctx.beginPath();
      ctx.rect(obs.x, 0, obs.width, topHeight);
      ctx.fill();
      ctx.stroke();

      // Top Gate lip (bottom edge of top pillar)
      ctx.fillStyle = "#ff0055";
      ctx.fillRect(obs.x - 3, topHeight - 14, obs.width + 6, 14);

      // Inner details for top pillar (ribs / power core glow)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 0, 85, 0.18)";
      ctx.lineWidth = 1;
      const topRibs = Math.floor(topHeight / 25);
      for (let r = 1; r < topRibs; r++) {
        const ry = r * 25;
        ctx.beginPath();
        ctx.moveTo(obs.x + 3, ry);
        ctx.lineTo(obs.x + obs.width - 3, ry);
        ctx.stroke();
      }

      // Draw Bottom Pillar
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00f0ff"; // Cyan neon glow for bottom gate
      ctx.strokeStyle = "#00f0ff";
      ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.rect(obs.x, state.height - bottomHeight, obs.width, bottomHeight);
      ctx.fill();
      ctx.stroke();

      // Bottom Gate lip (top edge of bottom pillar)
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(obs.x - 3, state.height - bottomHeight, obs.width + 6, 14);

      // Inner details for bottom pillar (ribs)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
      ctx.lineWidth = 1;
      const bottomRibs = Math.floor(bottomHeight / 25);
      for (let r = 1; r < bottomRibs; r++) {
        const ry = state.height - bottomHeight + r * 25;
        if (ry < state.height - 10) {
          ctx.beginPath();
          ctx.moveTo(obs.x + 3, ry);
          ctx.lineTo(obs.x + obs.width - 3, ry);
          ctx.stroke();
        }
      }
    });

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw Particles
    state.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Reset alpha

    // Draw Gate Pass Rings
    state.gatePassRings.forEach((ring) => {
      ctx.save();
      ctx.strokeStyle = `rgba(0, 240, 255, ${ring.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00f0ff";
      
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Draw Exhaust Flame for Spaceship
    if (!state.isDead && state.isPlaying && !state.waitingToStart) {
      ctx.save();
      ctx.translate(100, state.birdY);
      ctx.rotate(state.birdAngle);

      // Exhaust flame grows with engineThrust and flickers randomly
      const flameLen = 8 + state.engineThrust * 24 + Math.random() * 6;
      const flameWidth = 5 + state.engineThrust * 6;

      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff0055"; // Engine plume color
      
      const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
      flameGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      flameGrad.addColorStop(0.2, "rgba(0, 240, 255, 0.85)"); // Cyan core
      flameGrad.addColorStop(0.6, "rgba(255, 0, 85, 0.5)");   // Magenta outer plume
      flameGrad.addColorStop(1, "rgba(255, 0, 85, 0)");

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12, -flameWidth / 2);
      ctx.lineTo(-8 - flameLen, 0);
      ctx.lineTo(-12, flameWidth / 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Draw Bird (Spaceship)
    if (!state.isDead || state.birdY < state.height) {
      ctx.save();
      ctx.translate(100, state.birdY);
      ctx.rotate(state.birdAngle);

      if (state.isDead) {
        // Chromatic split glitching effect on crash
        const offset = Math.sin(state.frameCount * 0.55) * 4.0;
        
        // Cyan shifted wing silhouette
        ctx.save();
        ctx.translate(-offset, 0);
        ctx.strokeStyle = "#00f0ff";
        ctx.fillStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Magenta shifted wing silhouette
        ctx.save();
        ctx.translate(offset, 0);
        ctx.strokeStyle = "#ff0055";
        ctx.fillStyle = "rgba(255, 0, 85, 0.4)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Neon spacecraft design
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#00f0ff";
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(14, 0);       // Nose
        ctx.lineTo(-12, -9);     // Top wing
        ctx.lineTo(-7, 0);       // Engine center
        ctx.lineTo(-12, 9);      // Bottom wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shield aura surrounding the ship
        ctx.strokeStyle = "rgba(0, 240, 255, 0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 17 + Math.sin(state.frameCount * 0.1) * 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsating shield expand on flap
        if (state.shieldPulse > 0.0) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${state.shieldPulse * 0.6})`;
          ctx.lineWidth = 1.5 + state.shieldPulse * 2.0;
          ctx.beginPath();
          const baseRadius = 17 + Math.sin(state.frameCount * 0.1) * 1.5;
          ctx.arc(0, 0, baseRadius + state.shieldPulse * 16, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Jet core (internal engine glow)
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#ff0055";
        ctx.fillStyle = "#ff0055";
        ctx.beginPath();
        ctx.arc(-5, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw Floating Texts
    state.floatTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${Math.round(14 * ft.scale)}px "Orbitron", sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = "center";
      
      // Neon glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = ft.color;
      
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    // Draw HUD Score
    if (state.isPlaying) {
      ctx.font = 'bold 26px "Orbitron", sans-serif';
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      
      // Glow for HUD text
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#00f0ff";
      ctx.fillText(state.score.toString(), state.width / 2, 45);
      ctx.shadowBlur = 0;
    }

    // Draw Pre-flight instructions
    if (state.isPlaying && state.waitingToStart) {
      ctx.fillStyle = "rgba(12, 7, 26, 0.4)";
      ctx.fillRect(0, 0, state.width, state.height);

      ctx.textAlign = "center";
      
      // Glowing Title
      ctx.font = 'bold 36px "Orbitron", sans-serif';
      ctx.fillStyle = "#00f0ff";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#00f0ff";
      ctx.fillText("GET READY", state.width / 2, state.height / 2 - 50);

      // Pulse text effect
      const pulse = Math.abs(Math.sin(state.frameCount / 15));
      ctx.font = 'bold 15px "Orbitron", sans-serif';
      ctx.fillStyle = `rgba(255, 0, 85, ${0.35 + pulse * 0.65})`;
      ctx.shadowBlur = pulse * 10;
      ctx.shadowColor = "#ff0055";
      ctx.fillText("TAP OR PRESS SPACE TO LAUNCH", state.width / 2, state.height / 2 + 55);

      // Instruction subtext
      ctx.font = '500 12px "Orbitron", sans-serif';
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.shadowBlur = 0;
      ctx.fillText("NAVIGATE NEON GATES | AVOID COLLISIONS", state.width / 2, state.height / 2 + 85);
    }

    // Draw Attract Screen
    if (!state.isPlaying) {
      ctx.fillStyle = "rgba(12, 7, 26, 0.72)";
      ctx.fillRect(0, 0, state.width, state.height);

      ctx.textAlign = "center";
      ctx.font = 'bold 44px "Orbitron", sans-serif';
      ctx.fillStyle = "#00f0ff";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#00f0ff";
      ctx.fillText("VECTOR WING", state.width / 2, state.height / 2 - 40);

      ctx.font = '300 15px "Orbitron", sans-serif';
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#ff0055";
      ctx.fillText("HIGH-STAKES RETRO ARCADE", state.width / 2, state.height / 2 - 12);

      // Pulse text effect
      const pulse = Math.abs(Math.sin(state.frameCount / 20));
      ctx.font = 'bold 15px "Orbitron", sans-serif';
      ctx.fillStyle = `rgba(255, 0, 85, ${0.4 + pulse * 0.6})`;
      ctx.shadowBlur = pulse * 8;
      ctx.shadowColor = "#ff0055";
      ctx.fillText("ACTIVE TICKET REQUIRED TO PLAY", state.width / 2, state.height / 2 + 50);

      ctx.font = '400 13px "Orbitron", sans-serif';
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.shadowBlur = 0;
      ctx.fillText(`PERSONAL HIGH SCORE: ${state.highScore}`, state.width / 2, state.height / 2 + 100);
    }

    // CRT Scanline Static Glitch Overlay
    if (state.isDead) {
      ctx.save();
      const glitchCount = Math.floor(Math.random() * 4);
      for (let i = 0; i < glitchCount; i++) {
        const gy = Math.random() * state.height;
        const gh = Math.random() * 30 + 5;
        const shiftX = (Math.random() - 0.5) * 15;
        
        ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
        ctx.fillRect(0, gy, state.width, gh);
        
        ctx.fillStyle = "rgba(255, 0, 85, 0.12)";
        ctx.fillRect(shiftX, gy + 2, state.width, gh);
      }
      
      if (Math.random() < 0.45) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.beginPath();
        const ny = Math.random() * state.height;
        ctx.moveTo(0, ny);
        ctx.lineTo(state.width, ny);
        ctx.stroke();
      }

      if (Math.random() < 0.15) {
        ctx.fillStyle = Math.random() > 0.5 ? "#00f0ff" : "#ff0055";
        ctx.fillRect(
          Math.random() * state.width, 
          Math.random() * state.height, 
          Math.random() * 120 + 30, 
          Math.random() * 12 + 4
        );
      }
      ctx.restore();
    }

    ctx.restore(); // Restore screen shake state
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full relative flex items-center justify-center overflow-hidden rounded-xl border border-[rgba(255,0,85,0.25)] bg-[#070410] cursor-pointer group"
      onClick={handleFlap}
      style={{
        boxShadow: "0 0 30px rgba(7, 4, 16, 0.6), inset 0 0 20px rgba(0, 240, 255, 0.05)",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* CRT Scanline Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.14]"
        style={{
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%)",
          backgroundSize: "100% 4px",
        }}
      />
      {/* Chromatic RGB Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          background: "linear-gradient(90deg, rgba(255, 0, 0, 0.8), rgba(0, 255, 0, 0.2), rgba(0, 0, 255, 0.8))",
          backgroundSize: "6px 100%",
        }}
      />
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block max-w-full relative z-0 transition-transform duration-300 group-hover:scale-[1.01]"
        style={{ width: "100%", height: "auto", aspectRatio: "64 / 45" }}
      />
    </div>
  );
}

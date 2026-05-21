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

    // Parallax background scrolling
    state.bgOffset = (state.bgOffset - 0.5) % state.width;

    // Update particles
    state.particles = state.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      return p.alpha > 0;
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

      // Collision checks (Bird is a circle of radius 13 at x=100)
      const birdRadius = 13;
      const birdX = 100;

      const topHeight = obs.yCenter - obs.gap / 2;
      const bottomHeight = state.height - (obs.yCenter + obs.gap / 2);

      // Obstacle boundary check
      const inObstacleXRange = birdX + birdRadius > obs.x && birdX - birdRadius < obs.x + obs.width;
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

    // Clear Canvas
    ctx.fillStyle = "#0c071a";
    ctx.fillRect(0, 0, state.width, state.height);

    // Draw Parallax Stars background
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    for (let i = 0; i < 20; i++) {
      const starX = ((i * 57 + state.bgOffset * 0.4) % state.width + state.width) % state.width;
      const starY = (i * 23) % state.height;
      const starSize = (i % 3 === 0) ? 2.5 : 1.2;
      ctx.fillRect(starX, starY, starSize, starSize);
    }

    // Draw Grid Floor (aesthetic scrolling lines)
    ctx.strokeStyle = "rgba(0, 240, 255, 0.06)";
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    const floorY = state.height - 20;

    // Scrolling vertical grid lines
    const lineOffset = (state.bgOffset * 0.8) % gridSpacing;
    for (let x = lineOffset; x < state.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, floorY - 30);
      ctx.lineTo(x - 20, floorY);
      ctx.stroke();
    }
    // Horizontal floor grid lines
    ctx.beginPath();
    ctx.moveTo(0, floorY - 30);
    ctx.lineTo(state.width, floorY - 30);
    ctx.moveTo(0, floorY - 15);
    ctx.lineTo(state.width, floorY - 15);
    ctx.moveTo(0, floorY);
    ctx.lineTo(state.width, floorY);
    ctx.stroke();

    // Draw Obstacles (Pillars)
    state.obstacles.forEach((obs) => {
      // Dynamically calculate heights based on yCenter and gap
      const topHeight = obs.yCenter - obs.gap / 2;
      const bottomHeight = state.height - (obs.yCenter + obs.gap / 2);

      // Glow filter settings
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.5;

      // Draw Top Pillar
      ctx.shadowColor = "#ff0055"; // Pink neon glow for top gate
      ctx.strokeStyle = "#ff0055";
      ctx.fillStyle = "rgba(255, 0, 85, 0.08)";
      
      // Box path
      ctx.beginPath();
      ctx.rect(obs.x, 0, obs.width, topHeight);
      ctx.fill();
      ctx.stroke();

      // Top Gate lip (bottom edge of top pillar)
      ctx.fillStyle = "#ff0055";
      ctx.fillRect(obs.x - 3, topHeight - 14, obs.width + 6, 14);

      // Draw Bottom Pillar
      ctx.shadowColor = "#00f0ff"; // Cyan neon glow for bottom gate
      ctx.strokeStyle = "#00f0ff";
      ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
      
      // Box path
      ctx.beginPath();
      ctx.rect(obs.x, state.height - bottomHeight, obs.width, bottomHeight);
      ctx.fill();
      ctx.stroke();

      // Bottom Gate lip (top edge of bottom pillar)
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(obs.x - 3, state.height - bottomHeight, obs.width + 6, 14);
    });

    // Reset shadow blur for other drawings
    ctx.shadowBlur = 0;

    // Draw Particles
    state.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // reset alpha

    // Draw Bird (Futuristic triangular neon spaceship)
    if (!state.isDead || state.birdY < state.height) {
      ctx.save();
      ctx.translate(100, state.birdY);
      ctx.rotate(state.birdAngle);

      // Neon spacecraft design
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00f0ff";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      // Draw spaceship points (facing right)
      ctx.moveTo(14, 0);       // nose
      ctx.lineTo(-12, -9);     // top wing
      ctx.lineTo(-7, 0);       // engine center
      ctx.lineTo(-12, 9);      // bottom wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jet core (internal engine glow)
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#ff0055";
      ctx.fillStyle = "#ff0055";
      ctx.beginPath();
      ctx.arc(-5, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw HUD Score (during active gameplay)
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

    // Draw Pre-flight overlay instructions when waiting to start
    if (state.isPlaying && state.waitingToStart) {
      // Semitransparent cabinet tint overlay for focus
      ctx.fillStyle = "rgba(12, 7, 26, 0.4)";
      ctx.fillRect(0, 0, state.width, state.height);

      ctx.textAlign = "center";
      
      // Glowing Title
      ctx.font = 'bold 36px "Orbitron", sans-serif';
      ctx.fillStyle = "#00f0ff";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#00f0ff";
      ctx.fillText("GET READY", state.width / 2, state.height / 2 - 50);

      // Pulse text effect for instructions
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

    // Draw Attract Screen (when not playing)
    if (!state.isPlaying) {
      ctx.fillStyle = "rgba(12, 7, 26, 0.72)";
      ctx.fillRect(0, 0, state.width, state.height);

      ctx.textAlign = "center";
      ctx.font = 'bold 44px "Orbitron", sans-serif';
      ctx.fillStyle = "#00f0ff";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#00f0ff";
      ctx.fillText("NEON BIRD", state.width / 2, state.height / 2 - 40);

      ctx.font = '300 15px "Orbitron", sans-serif';
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#ff0055";
      ctx.fillText("HIGH-STAKES ARCADE", state.width / 2, state.height / 2 - 12);

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
      ctx.fillText(`PERSONAL HIGH SCORE: ${highScore}`, state.width / 2, state.height / 2 + 100);
    }

    ctx.restore(); // Restore screen shake state
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full relative flex items-center justify-center overflow-hidden rounded-xl border border-[rgba(255,0,85,0.25)] bg-[#070410] cursor-pointer"
      onClick={handleFlap}
      style={{
        boxShadow: "0 0 30px rgba(7, 4, 16, 0.6), inset 0 0 20px rgba(0, 240, 255, 0.05)",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block max-w-full"
        style={{ width: "100%", height: "auto", aspectRatio: "64 / 45" }}
      />
    </div>
  );
}

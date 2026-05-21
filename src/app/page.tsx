/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import GameCanvas from "../components/GameCanvas";
import audioSystem from "../components/AudioSystem";
import { COUNTRIES, getFlagUrl } from "../components/countries";
import styles from "./page.module.css";

export default function Home() {
  // Client States
  const [emailInput, setEmailInput] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [gameState, setGameState] = useState<"attract" | "tutorial" | "playing" | "gameover">("attract");
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState("24h 00m 00s");
  const [licenseInput, setLicenseInput] = useState("");
  
  // UX Alerts
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Reactive DB Subscriptions (live auto-updates)
  const activeTicket = useQuery(
    api.tickets.getActiveTicket,
    activeEmail ? { email: activeEmail } : "skip"
  );
  const leaderboard = useQuery(api.leaderboard.getLeaderboard) || [];
  const recentWinners = useQuery(api.leaderboard.getRecentWinners) || [];

  // Mutations
  const startPlayMutation = useMutation(api.plays.startPlay);
  const submitScoreMutation = useMutation(api.plays.submitScore);

  // Actions
  const redeemLicenseAction = useAction(api.tickets_action.verifyAndRedeemLicense);

  // Enter tutorial view (before consuming ticket play)
  const handleEnterTutorial = useCallback(() => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!activeTicket || activeTicket.status === "exhausted") {
      setErrorMsg("You need an active ticket to play. Purchase a ticket above!");
      if (!isMuted) {
        audioSystem.playError();
      }
      return;
    }

    if (!isMuted) {
      audioSystem.playClick();
    }
    setGameState("tutorial");
  }, [activeTicket, isMuted]);

  // Actually start the game play session (consumes 1 play)
  const handleLaunchGame = useCallback(async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!activeTicket || activeTicket.status === "exhausted") {
      setErrorMsg("You need an active ticket to play. Purchase a ticket above!");
      setGameState("attract");
      if (!isMuted) {
        audioSystem.playError();
      }
      return;
    }

    try {
      if (!isMuted) {
        audioSystem.playReady();
      }
      const playId = await startPlayMutation({ ticketId: activeTicket._id });
      setCurrentPlayId(playId);
      setGameState("playing");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start play session.");
      setGameState("attract");
      if (!isMuted) {
        audioSystem.playError();
      }
    }
  }, [activeTicket, isMuted, startPlayMutation]);

  // Countdown timer to the next 2-hour UTC reset
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentUTCHours = now.getUTCHours();
      const nextBlockHour = currentUTCHours + (2 - (currentUTCHours % 2));
      
      const nextReset = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          nextBlockHour,
          0,
          0,
          0
        )
      );

      const diff = Math.max(0, nextReset.getTime() - now.getTime());

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}h ${minutes
          .toString()
          .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync audio mute state
  useEffect(() => {
    audioSystem.setMuted(isMuted);
  }, [isMuted]);

  // Sync ticket email back to form once loaded
  useEffect(() => {
    const storedEmail = localStorage.getItem("flappy_active_email");
    if (storedEmail) {
      setEmailInput(storedEmail);
      setActiveEmail(storedEmail);
    }
  }, []);

  // Global keydown handler for arcade menu navigation via Spacebar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when the user is typing in form fields
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        if (gameState === "attract") {
          e.preventDefault();
          handleEnterTutorial();
        } else if (gameState === "tutorial") {
          e.preventDefault();
          handleLaunchGame();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [gameState, activeTicket, isMuted, handleEnterTutorial, handleLaunchGame]);

  // Handle checking ticket email & license verification (required in production)
  const handleCheckTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const email = emailInput.trim().toLowerCase();
    const license = licenseInput.trim().toUpperCase();
    if (!email) {
      setErrorMsg("Please enter an email address.");
      return;
    }
    if (!license) {
      setErrorMsg("Please enter your license key.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await redeemLicenseAction({
        email,
        licenseKey: license,
        productId: process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_ID,
      });

      if (result && result.success) {
        setActiveEmail(email);
        localStorage.setItem("flappy_active_email", email);
        setLicenseInput("");
        setSuccessMsg(result.message || "License successfully verified!");
        if (!isMuted) {
          audioSystem.playReady();
        }
      } else {
        throw new Error("License verification failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed. Please check your license key and email.");
      if (!isMuted) {
        audioSystem.playError();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log out of ticket session
  const handleLogout = () => {
    setActiveEmail("");
    setEmailInput("");
    setLicenseInput("");
    localStorage.removeItem("flappy_active_email");
    setGameState("attract");
    setCurrentPlayId(null);
    setSuccessMsg("Logged out successfully.");
  };



  // Exit tutorial back to attract mode
  const handleCancelTutorial = () => {
    if (!isMuted) {
      audioSystem.playClick();
    }
    setGameState("attract");
  };

  // Callback when player crashes
  const handleGameOver = (score: number) => {
    setFinalScore(score);
    setGameState("gameover");
  };

  // Submit verified score to DB
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlayId || finalScore === null) return;
    
    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);

    const name = playerName.trim() || "Anonymous";

    try {
      await submitScoreMutation({
        playId: currentPlayId as any,
        score: finalScore,
        playerName: name,
        ...(selectedCountry ? { country: selectedCountry } : {}),
      });

      setSuccessMsg(`Score of ${finalScore} successfully verified and posted!`);
      // Return to attract loop
      setGameState("attract");
      setCurrentPlayId(null);
      setFinalScore(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Anti-cheat verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };




  return (
    <main className={styles.container}>
      <Script src="https://gumroad.com/js/gum.js" strategy="lazyOnload" />

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Neon Bird</h1>
        <p className={styles.subtitle}>Highstakes Retro Arcade</p>
      </header>

      {/* Convex Connection Warning */}
      {!process.env.NEXT_PUBLIC_CONVEX_URL && (
        <div className={styles.warningBanner}>
          ⚠️ <strong>Convex Backend Not Connected!</strong> Please run <code>npx convex dev</code> in your terminal to spin up the database and link environment variables to your local environment.
        </div>
      )}

      {/* Main Grid */}
      <section className={styles.mainGrid}>
        
        {/* Left Side: Arcade Machine Canvas & Leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Cabinet Screen */}
          <div className={styles.panel} style={{ gap: "1rem" }}>
            <div className="flex justify-between items-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={styles.panelTitle} style={{ borderBottom: "none", paddingBottom: 0 }}>
                🕹️ Cabinet Screen
              </span>
              <div 
                className={styles.soundToggle} 
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute Sounds" : "Mute Sounds"}
              >
                <span className={styles.soundIcon}>{isMuted ? "🔇" : "🔊"}</span>
                <span>{isMuted ? "SFX MUTED" : "SFX ON"}</span>
              </div>
            </div>

            <div className={styles.cabinetContainer}>
              <GameCanvas 
                playId={gameState === "playing" || gameState === "gameover" ? currentPlayId : null}
                onGameOver={handleGameOver}
                isMuted={isMuted}
              />

              {gameState === "gameover" && (
                <div className={styles.cabinetOverlay}>
                  <div className={styles.gameOverSection}>
                    <h2 className={styles.gameOverTitle}>CRASHED!</h2>
                    <p className={styles.finalScore}>
                      Your verified score is: 
                      <span className={styles.finalScoreNumber}>{finalScore}</span>
                    </p>
                    
                    <form onSubmit={handleSubmitScore} className={styles.form}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="playerName" className={styles.inputLabel}>
                          Submit to Leaderboard
                        </label>
                        <input
                          type="text"
                          id="playerName"
                          placeholder="Enter your name..."
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value.substring(0, 15))}
                          className={styles.input}
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className={styles.inputGroup} style={{ position: "relative" }}>
                        <label htmlFor="countrySearchInput" className={styles.inputLabel}>
                          Represent Your Country
                        </label>
                        <div style={{ position: "relative" }}>
                          {/* Flag preview inside input */}
                          {selectedCountry && (
                            <img
                              src={getFlagUrl(selectedCountry, 24)}
                              alt={selectedCountry}
                              style={{
                                position: "absolute",
                                left: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 24,
                                height: 16,
                                objectFit: "cover",
                                borderRadius: 2,
                                zIndex: 2,
                              }}
                            />
                          )}
                          <input
                            id="countrySearchInput"
                            type="text"
                            autoComplete="off"
                            placeholder={selectedCountry ? COUNTRIES.find(c => c.code === selectedCountry)?.name : "Search your country..."}
                            value={countrySearch}
                            onChange={(e) => { setCountrySearch(e.target.value); setCountryOpen(true); }}
                            onFocus={() => setCountryOpen(true)}
                            onBlur={() => setTimeout(() => setCountryOpen(false), 150)}
                            className={styles.input}
                            disabled={isSubmitting}
                            style={{ paddingLeft: selectedCountry ? 44 : 14 }}
                          />
                        </div>
                        {countryOpen && (
                          <div style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: "#1a0a2e",
                            border: "1px solid #ff2d78",
                            borderRadius: 8,
                            maxHeight: 200,
                            overflowY: "auto",
                            boxShadow: "0 8px 32px rgba(255,45,120,0.25)",
                          }}>
                            {COUNTRIES.filter(c =>
                              c.name.toLowerCase().includes(countrySearch.toLowerCase())
                            ).length === 0 ? (
                              <div style={{ padding: "10px 14px", color: "#888", fontSize: 13 }}>No countries found</div>
                            ) : (
                              COUNTRIES.filter(c =>
                                c.name.toLowerCase().includes(countrySearch.toLowerCase())
                              ).map((c) => (
                                <div
                                  key={c.code}
                                  onMouseDown={() => {
                                    setSelectedCountry(c.code);
                                    setCountrySearch("");
                                    setCountryOpen(false);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "8px 14px",
                                    cursor: "pointer",
                                    background: selectedCountry === c.code ? "rgba(255,45,120,0.18)" : "transparent",
                                    color: selectedCountry === c.code ? "#ff2d78" : "#e0e0e0",
                                    fontSize: 13,
                                    fontFamily: "inherit",
                                    transition: "background 0.15s",
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,45,120,0.1)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = selectedCountry === c.code ? "rgba(255,45,120,0.18)" : "transparent")}
                                >
                                  <img
                                    src={getFlagUrl(c.code, 24)}
                                    alt={c.name}
                                    style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                                  />
                                  <span>{c.name}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <button 
                        type="submit" 
                        className={`${styles.button} ${styles.buttonPink}`}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "VERIFYING SCORE..." : "SUBMIT SCORE"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {gameState === "tutorial" && (
                <div className={styles.cabinetOverlay}>
                  <div className={styles.tutorialSection}>
                    {/* Hook: Lead with what they can win */}
                    <div className={styles.tutorialHero}>
                      <h2 className={styles.tutorialTitle}>Win Real Money</h2>
                      <div className={styles.tutorialPrize}>$10</div>
                      <p className={styles.tutorialHook}>
                        Hold <strong>#1</strong> on the leaderboard when the round ends and the jackpot is yours.
                      </p>
                    </div>

                    {/* How it works: Visual step flow */}
                    <div className={styles.tutorialSteps}>
                      <div className={styles.tutorialStep}>
                        <div className={styles.stepNumber}>1</div>
                        <div className={styles.stepText}>
                          <strong>Tap</strong> or press <strong>Space</strong> to fly
                        </div>
                      </div>
                      <div className={styles.stepDivider}>→</div>
                      <div className={styles.tutorialStep}>
                        <div className={styles.stepNumber}>2</div>
                        <div className={styles.stepText}>
                          Navigate <strong>neon gates</strong> to score
                        </div>
                      </div>
                      <div className={styles.stepDivider}>→</div>
                      <div className={styles.tutorialStep}>
                        <div className={styles.stepNumber}>3</div>
                        <div className={styles.stepText}>
                          <strong>Don&apos;t crash</strong> — it gets harder
                        </div>
                      </div>
                    </div>

                    {/* Stakes reminder */}
                    <p className={styles.tutorialWarning}>
                      ⚡ Launching costs <strong>1 play</strong> from your ticket
                    </p>

                    {/* CTA: Dominant action */}
                    <div className={styles.tutorialButtons}>
                      <button 
                        onClick={handleLaunchGame}
                        className={`${styles.button} ${styles.buttonPink} ${styles.buttonPulse}`}
                        style={{ flex: 2 }}
                      >
                        LAUNCH 🚀
                      </button>
                      <button 
                        onClick={handleCancelTutorial}
                        className={`${styles.button} ${styles.buttonOutline}`}
                        style={{ flex: 1 }}
                      >
                        BACK
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive controls under screen */}
            {gameState === "attract" && (
              <div className="flex flex-col gap-2" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {activeEmail ? (
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button 
                      onClick={handleEnterTutorial}
                      className={`${styles.button} ${styles.buttonPink}`}
                      style={{ flex: 1 }}
                      disabled={!activeTicket || activeTicket.playsRemaining <= 0}
                    >
                      🚀 START GAME • {activeTicket ? activeTicket.playsRemaining : 0} PLAYS LEFT
                    </button>
                    <button 
                      onClick={handleLogout} 
                      className={`${styles.button} ${styles.buttonOutline}`}
                    >
                      Change Email
                    </button>
                  </div>
                ) : (
                  <div className={styles.infoBanner}>
                    ⚡ <strong>Enter your purchase email</strong> in the dashboard to load plays and unlock the arcade cabinet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2-Hour Leaderboard */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>🏆 2-Hour Leaderboard</h2>
            
            <div className={styles.leaderboardList}>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, idx) => (
                  <div 
                    key={entry._id} 
                    className={`${styles.leaderboardItem} ${idx === 0 ? styles.leaderboardItemFirst : ""}`}
                  >
                    <span className={styles.rankBadge}>{idx + 1}</span>
                    {(entry as any).country ? (
                      <img 
                        src={getFlagUrl((entry as any).country, 40)} 
                        alt={(entry as any).country}
                        className={styles.playerFlag}
                        width={24}
                        height={16}
                      />
                    ) : (
                      <span className={styles.playerFlagPlaceholder}>🌍</span>
                    )}
                    <span className={styles.playerName}>{entry.playerName}</span>
                    <span className={styles.playerScore}>{entry.score} pts</span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyLeaderboard}>
                  No entries in this round yet. Be the first to claim rank #1!
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Panels for Tickets, Jackpot & Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Jackpot Stats */}
          <div className={styles.jackpotCard}>
            <span className={styles.jackpotTitle}>Active Jackpot Pool</span>
            <span className={styles.jackpotValue}>$10.00 USD</span>
            <span className={styles.countdownText}>
              Winner decided in: <span className={styles.timer}>{timeLeft}</span>
            </span>
          </div>

          {/* Ticket Dashboard (Player Session) */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>🔑 Player Session</h2>
            
            {activeEmail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className={styles.statsRow}>
                  <span className={styles.statsLabel}>Active Email</span>
                  <span className={styles.statsValue}>{activeEmail}</span>
                </div>
                <div className={styles.statsRow}>
                  <span className={styles.statsLabel}>Plays Remaining</span>
                  <span className={`${styles.statsValue} ${styles.statsValueHighlight}`}>
                    ⚡ {activeTicket ? activeTicket.playsRemaining : 0} Play{activeTicket?.playsRemaining !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className={styles.statsRow}>
                  <span className={styles.statsLabel}>Ticket Status</span>
                  <span className={styles.statsValue} style={{ color: activeTicket?.status === "active" ? "#00f0ff" : "#ff0055" }}>
                    {activeTicket ? activeTicket.status.toUpperCase() : "NO TICKET"}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Pay $5 to purchase a ticket (gives 3 plays). Once purchased, enter your email and license key below to activate your session.
                </p>
                
                {/* Gumroad Purchase link */}
                <a 
                  href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL || "https://gumroad.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.button} ${styles.buttonPink} gumroad-button`}
                  style={{ width: "100%", textDecoration: "none", textAlign: "center" }}
                >
                  💳 BUY TICKET ($5)
                </a>

                <form onSubmit={handleCheckTicket} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="ticketEmail" className={styles.inputLabel}>
                      Purchase Email
                    </label>
                    <input
                      type="email"
                      id="ticketEmail"
                      placeholder="Enter purchase email..."
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className={styles.input}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                   <div className={styles.inputGroup} style={{ marginTop: "0.5rem" }}>
                    <label htmlFor="ticketLicense" className={styles.inputLabel}>
                      License Key
                    </label>
                    <input
                      type="text"
                      id="ticketLicense"
                      placeholder="e.g. AAAA-BBBB-CCCC"
                      value={licenseInput}
                      onChange={(e) => setLicenseInput(e.target.value)}
                      className={styles.input}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className={`${styles.button} ${styles.buttonPink}`}
                    style={{ width: "100%", marginTop: "0.75rem" }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "PROCESSING..." : "ACTIVATE & LOAD SESSION 🔑"}
                  </button>
                </form>
              </div>
            )}

            {errorMsg && <p style={{ color: "var(--neon-pink)", fontSize: "0.85rem", fontWeight: 500 }}>⚠️ {errorMsg}</p>}
            {successMsg && <p style={{ color: "var(--neon-cyan)", fontSize: "0.85rem", fontWeight: 500 }}>✨ {successMsg}</p>}
          </div>

          {/* How It Works Info Panel */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>🎮 How It Works & Win</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem", lineHeight: 1.4, color: "var(--text-muted)" }}>
              <p>
                Welcome to <strong>Neon Bird</strong>, a highstakes retro arcade game. Here is how you can win real cash prizes:
              </p>
              <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>
                  💳 <strong>Buy a Ticket:</strong> Purchase a ticket for $5 USD. Each ticket gives you <strong>3 plays</strong>.
                </li>
                <li>
                  🔑 <strong>Activate Session:</strong> Enter your email and Gumroad license key in the form below to load your plays.
                </li>
                <li>
                  🕹️ <strong>Play:</strong> Press <strong>START GAME</strong>. Press <strong>Space</strong> or tap the screen to fly. Navigate through neon gates without crashing.
                </li>
                <li>
                  🏆 <strong>Win Payouts:</strong> Every <strong>2 hours</strong>, the player at the top (Rank #1) of the leaderboard wins the <strong>$10 USD jackpot</strong>!
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* Hall of Fame / Past Winners */}
      <section className={styles.panel} style={{ marginTop: "1rem" }}>
        <h2 className={styles.panelTitle}>👑 Hall of Fame • Jackpot Winners</h2>
        <div className={styles.winnersList}>
          {recentWinners.length > 0 ? (
            recentWinners.map((winner) => (
              <div key={winner._id} className={styles.winnerItem}>
                <div className={styles.winnerDetails}>
                  <span className={styles.winnerDate}>{winner.date}</span>
                  <span className={styles.winnerName}>🥇 {winner.playerName}</span>
                  <span className={styles.winnerScore}>Score: {winner.score} pts</span>
                </div>
                <div className={styles.winnerStatus}>
                  <span className={styles.winnerPayout}>${winner.payoutAmount.toFixed(2)}</span>
                  <span 
                    className={`${styles.statusTag} ${winner.paid ? styles.statusPaid : styles.statusPending}`}
                    title={winner.paid ? "Payout Completed" : "Payout is pending processing by the game administrator"}
                  >
                    {winner.paid ? "PAID" : "PENDING"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyLeaderboard} style={{ borderStyle: "none" }}>
              Winners will appear here every 2 hours.
            </div>
          )}
        </div>
      </section>


    </main>
  );
}

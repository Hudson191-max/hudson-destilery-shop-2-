"use client";
// ── Login screen ─────────────────────────────────────────────────────────────
// Role select (Owner / Employee / Track order) + name + password.
// Same auth flow as before (handled by the parent via onSubmit → POST
// /api/auth/login); this file is presentation-only polish: centered card with
// the distillery logo, role tabs, show/hide password toggle, loading state on
// submit, and a subtle framer-motion entrance.
import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { LOGO_URL } from "../admin-helpers";
import type { Role } from "../types";
import { FOCUS_RING, TOUCH_TARGET } from "../components/touch";

interface LoginScreenProps {
  role: Role;
  setRole: (r: Role) => void;
  name: string;
  setName: (s: string) => void;
  pw: string;
  setPw: (s: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

// Staggered entrance variants (subtle — the panel is a workspace, not a show).
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: "easeOut",
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const ROLES: { id: Role; label: string }[] = [
  { id: "owner", label: "👑 Owner" },
  { id: "employee", label: "👷 Employee" },
  { id: "customer", label: "🔍 Track Order" },
];

export function LoginScreen({
  role,
  setRole,
  name,
  setName,
  pw,
  setPw,
  submitting,
  onSubmit,
}: LoginScreenProps) {
  const isCustomer = role === "customer";
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="login-screen">
      <motion.div
        className="login-box"
        variants={cardVariants}
        initial="hidden"
        animate="show"
        style={{
          boxShadow: "0 24px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(200,168,75,.08)",
        }}
      >
        <motion.div variants={itemVariants} style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 96,
              height: 96,
              padding: 10,
              borderRadius: "50%",
              border: "1px solid var(--border2)",
              background: "var(--bg2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <img
              src={LOGO_URL}
              alt="The Hudson Distillery logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            color: "var(--accent)",
            lineHeight: 1.2,
          }}
        >
          THE HUDSON{" "}
          <span style={{ color: "var(--text1)", fontWeight: 400 }}>
            DISTILLERY
          </span>
        </motion.div>
        <motion.div className="login-sub" variants={itemVariants}>
          ACCESS CONTROL
        </motion.div>

        {/* Role first: it frames the rest of the form. The tab is only a UI
            preference — the server detects the role from the account. */}
        <motion.div className="form-group" variants={itemVariants}>
          <label id="hd-role-label">Role</label>
          <div className="role-btns" role="group" aria-labelledby="hd-role-label">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={`role-btn ${FOCUS_RING}` +
                  (role === r.id ? " selected" : "")}
                onClick={() => setRole(r.id)}
                type="button"
                aria-pressed={role === r.id}
              >
                {r.label}
              </button>
            ))}
          </div>
          {!isCustomer ? (
            <p
              className="login-hint"
              style={{
                marginTop: 6,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "var(--text2)",
                opacity: 0.85,
              }}
            >
              Your role is detected automatically from your account — the tab
              only pre-selects the view.
            </p>
          ) : null}
        </motion.div>

        {!isCustomer ? (
          <motion.div className="form-group" variants={itemVariants}>
            <label htmlFor="hd-login-name">Your name</label>
            <input
              id="hd-login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={24}
              autoComplete="username"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
          </motion.div>
        ) : null}

        {!isCustomer ? (
          <motion.div className="form-group" variants={itemVariants}>
            <label htmlFor="hd-login-pw">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="hd-login-pw"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmit();
                }}
              />
              <button
                type="button"
                className={`absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded text-[var(--text2)] transition-colors hover:text-[var(--text0)] ${FOCUS_RING}`}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                title={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </motion.div>
        ) : null}

        <motion.button
          variants={itemVariants}
          className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
          style={{
            width: "100%",
            marginTop: 8,
            justifyContent: "center",
            gap: 8,
          }}
          onClick={onSubmit}
          disabled={submitting}
          whileTap={submitting ? undefined : { scale: 0.985 }}
        >
          {submitting ? (
            <>
              <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ENTERING…
            </>
          ) : (
            "ENTER SHOP"
          )}
        </motion.button>

        <motion.a
          variants={itemVariants}
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/";
          }}
          className={FOCUS_RING}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            marginTop: 8,
            padding: 8,
            background: "rgba(200,168,75,.1)",
            border: "1px solid rgba(200,168,75,.3)",
            borderRadius: 3,
            color: "var(--accent)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          🛒 Place an order
        </motion.a>
      </motion.div>
    </div>
  );
}

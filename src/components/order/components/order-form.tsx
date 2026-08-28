"use client";

// Customer details form + honeypot + TOS agreement + submit button.
// Field STATE lives here; VALIDATION stays in the parent (order-view) so the
// exact original toast order is preserved. The honeypot field `company` must
// stay visually hidden and empty — real users never fill it, the server no-ops
// if a bot does.

import { useRef, useState } from "react";
import type { OrderFormValues } from "../order-types";
import { TosBlock } from "./tos-modal";

export interface OrderFormProps {
  submitting: boolean;
  onSubmit: (values: OrderFormValues) => void;
}

export function OrderForm({ submitting, onSubmit }: OrderFormProps) {
  const [formName, setFormName] = useState("");
  const [formDiscord, setFormDiscord] = useState("");
  const [formSteam, setFormSteam] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [agreeTos, setAgreeTos] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const companyRef = useRef<HTMLInputElement>(null);

  function handleSubmitClick() {
    onSubmit({
      customer: formName,
      contact: formDiscord,
      steam: formSteam,
      notes: formNotes,
      company: companyRef.current?.value || "",
      agreed: agreeTos,
    });
  }

  return (
    <div id="order-details">
      <div className="form-section">
        <div className="card-title" style={{ marginBottom: 16 }}>
          Your details
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="f-name">Your name / IGN *</label>
            <input
              id="f-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. WarriorXX99"
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="f-discord">Discord / contact *</label>
            <input
              id="f-discord"
              type="text"
              value={formDiscord}
              onChange={(e) => setFormDiscord(e.target.value)}
              placeholder="e.g. warrior#1234"
              autoComplete="off"
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="f-steam">Steam ID 64 *</label>
          <input
            id="f-steam"
            type="text"
            value={formSteam}
            onChange={(e) => setFormSteam(e.target.value)}
            placeholder="e.g. 76561199401090066"
            autoComplete="off"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="f-notes">Notes (optional)</label>
          <textarea
            id="f-notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Delivery location, special requests..."
            maxLength={1000}
            aria-describedby="f-notes-counter"
          />
          <div
            id="f-notes-counter"
            className="notes-counter"
            aria-live="polite"
            style={{
              marginTop: 4,
              textAlign: "right",
              fontSize: 11.5,
              color:
                formNotes.length >= 1000
                  ? "var(--red, #b84040)"
                  : formNotes.length >= 900
                    ? "var(--yellow, #9a7410)"
                    : "var(--text2)",
            }}
          >
            {formNotes.length}/1000
          </div>
        </div>
        {/* Honeypot — visually hidden. Real users never fill it; server no-ops if filled. */}
        <input
          ref={companyRef}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            width: "1px",
            height: "1px",
            opacity: 0,
          }}
        />
      </div>

      <button
        type="button"
        className="submit-btn"
        onClick={handleSubmitClick}
        disabled={submitting}
      >
        {submitting ? "Placing order…" : "Place order"}
      </button>

      <div className="checkbox-row">
        <input
          id="agree-tos"
          type="checkbox"
          checked={agreeTos}
          onChange={(e) => setAgreeTos(e.target.checked)}
        />
        <label htmlFor="agree-tos">
          I agree to the Terms of Service and understand that I am submitting my
          details for order processing.
        </label>
      </div>

      <TosBlock open={tosOpen} onToggle={() => setTosOpen((v) => !v)} />
    </div>
  );
}

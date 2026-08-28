"use client";

// "Order placed!" success screen with copy-to-clipboard and printable receipt.

import { motion } from "framer-motion";
import { copyDetails, printReceipt, type SuccessData } from "../order-types";

export function OrderSuccess({
  data,
  onReset,
}: {
  data: SuccessData;
  onReset: () => void;
}) {
  return (
    <motion.div
      className="success-box"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="success-icon">🥃</div>
      <div className="success-title">Order placed!</div>
      <div className="success-sub">Your order number is:</div>
      <div className="success-id">{`#${data.id}`}</div>
      <div className="success-sub">Your cancellation code is:</div>
      <div className="success-id" style={{ marginTop: 8 }}>
        {data.cancelCode}
      </div>
      <div className="success-card">
        <div className="success-card-title">What happens next</div>
        <div className="success-grid">
          <div className="success-detail">
            <div className="success-label">Status</div>
            <div className="success-value">{data.status}</div>
          </div>
          <div className="success-detail">
            <div className="success-label">Follow-up</div>
            <div className="success-value">
              Use your order number and code to track it
            </div>
          </div>
        </div>
        <div className="success-note">
          This summary is easy to paste into Discord, save, or print for pickup.
        </div>
      </div>
      <div className="success-actions">
        <button
          type="button"
          className="reset-btn"
          onClick={() => copyDetails(data)}
        >
          📋 Copy details
        </button>
        <button
          type="button"
          className="reset-btn"
          onClick={() => printReceipt(data)}
        >
          🖨 Print receipt
        </button>
        <button type="button" className="reset-btn" onClick={onReset}>
          🛒 Place another order
        </button>
      </div>
    </motion.div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SubscriptionService } from "../services/subscriptionService.js";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Subscription({ user, userProfile }) {
  const t = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [publishableKey, setPublishableKey] = useState("");
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [selectedPriceId, setSelectedPriceId] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [checkoutInfo, setCheckoutInfo] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("month");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
    if (searchParams.get("canceled") === "true") {
      setShowCanceled(true);
      setTimeout(() => setShowCanceled(false), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const [prods, sub, key] = await Promise.all([
          SubscriptionService.getProducts(),
          SubscriptionService.getSubscription(),
          SubscriptionService.getPublishableKey(),
        ]);
        setProducts(prods);
        setSubscription(sub);
        setPublishableKey(key || "");
        if (key) {
          setStripePromise(loadStripe(key));
        }
      } catch (err) {
        console.error("Failed to load subscription data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCheckout = async (priceId) => {
    setCheckoutInfo("");
    setPaymentError("");
    setSelectedPriceId(priceId);
    setClientSecret("");
    setCheckoutLoading(priceId);
    try {
      let key = publishableKey;
      if (!key) {
        try {
          key = await SubscriptionService.getPublishableKey();
          setPublishableKey(key || "");
          if (key) {
            setStripePromise(loadStripe(key));
          }
        } catch (error) {
          console.warn("Publishable key unavailable, using redirect checkout fallback", error);
        }
      }

      if (!key) {
        setCheckoutInfo("Rivalis secure checkout is opening now.");
        const url = await SubscriptionService.createCheckout(priceId);
        window.location.href = url;
        return;
      }

      const checkoutSession = await SubscriptionService.createCustomCheckout(priceId);
      if (!checkoutSession?.clientSecret) {
        throw new Error("Custom checkout client secret missing");
      }
      setClientSecret(checkoutSession.clientSecret);
    } catch (err) {
      console.error("Checkout error:", err);
      setPaymentError("Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
    setShowCanceled(false);
    setClientSecret("");
    setSelectedPriceId(null);
    setPaymentError("");
    setCheckoutInfo("");

    try {
      const sub = await SubscriptionService.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error("Failed to refresh subscription after payment:", error);
    }
  };

  const handlePaymentCancel = () => {
    setClientSecret("");
    setSelectedPriceId(null);
    setPaymentError("");
    setCheckoutInfo("");
  };

  const handleManage = async () => {
    try {
      const url = await SubscriptionService.openPortal();
      window.location.href = url;
    } catch (err) {
      console.error("Portal error:", err);
      alert("Failed to open billing portal.");
    }
  };

  const isActive = subscription && (subscription.status === "active" || subscription.status === "trialing");

  const rivalisProduct = products.find(
    (p) => p.name && p.name.toLowerCase().includes("rivalis pro")
  );

  const monthlyPrice = rivalisProduct?.prices?.find(
    (p) => p.recurring?.interval === "month"
  );
  const annualPrice = rivalisProduct?.prices?.find(
    (p) => p.recurring?.interval === "year"
  );

  const getPriceAmount = (price) => price?.unit_amount ?? price?.unitAmount ?? 0;

  const features = [
    { icon: "🚫", title: "Ad-Free Experience", desc: "No banners, no interruptions" },
    { icon: "🤖", title: "AI Personal Trainer", desc: "Custom workouts built for you" },
    { icon: "🥗", title: "Smart Meal Plans", desc: "Nutrition tailored to your goals" },
    { icon: "🎯", title: "Goal Tracking", desc: "Set targets and crush them" },
    { icon: "📊", title: "Advanced Analytics", desc: "Deep dive into your progress" },
    { icon: "⚡", title: "Priority Support", desc: "Get help when you need it" },
  ];

  const styles = {
    container: {
      padding: "16px",
      paddingBottom: "calc(18px + env(safe-area-inset-bottom))",
      minHeight: "100vh",
    },
    inner: {
      maxWidth: 600,
      margin: "0 auto",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 24,
      gap: 12,
    },
    title: {
      margin: 0,
      fontSize: 24,
      fontWeight: 900,
      letterSpacing: 2,
      background: `linear-gradient(135deg, ${t.accent}, ${t.accent})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    subtitle: {
      margin: "4px 0 0",
      color: "rgba(255,255,255,0.6)",
      fontSize: 14,
    },
    backBtn: {
      padding: "8px 16px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "transparent",
      color: "rgba(255,255,255,0.8)",
      cursor: "pointer",
      fontSize: 14,
      flexShrink: 0,
    },
    successBanner: {
      background: "rgba(0,200,80,0.15)",
      border: "1px solid rgba(0,200,80,0.3)",
      borderRadius: 12,
      padding: "12px 16px",
      color: "#00ff60",
      fontSize: 14,
      marginBottom: 16,
      textAlign: "center",
    },
    canceledBanner: {
      background: "rgba(255,200,0,0.1)",
      border: "1px solid rgba(255,200,0,0.3)",
      borderRadius: 12,
      padding: "12px 16px",
      color: "#ffcc00",
      fontSize: 14,
      marginBottom: 16,
      textAlign: "center",
    },
    loadingContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 60,
    },
    spinner: {
      width: 32,
      height: 32,
      border: "3px solid rgba(255,255,255,0.1)",
      borderTop: `3px solid ${t.accent}`,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    pricingSection: {
      marginBottom: 32,
    },
    toggleRow: {
      display: "flex",
      gap: 8,
      marginBottom: 20,
      justifyContent: "center",
    },
    toggleBtn: {
      padding: "10px 20px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(0,0,0,0.3)",
      color: "rgba(255,255,255,0.5)",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8,
      transition: "all 0.2s",
    },
    toggleActive: {
      background: t.shadowXs,
      borderColor: t.shadowSm,
      color: "#fff",
      boxShadow: `0 0 20px ${t.shadowXs}`,
    },
    saveBadge: {
      background: "#00ff60",
      color: "#000",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
    },
    priceCard: {
      position: "relative",
      background: "rgba(0,0,0,0.4)",
      border: `1px solid ${t.shadowSm}`,
      borderRadius: 20,
      padding: "32px 24px",
      textAlign: "center",
      overflow: "hidden",
    },
    priceGlow: {
      position: "absolute",
      top: -60,
      left: "50%",
      transform: "translateX(-50%)",
      width: 200,
      height: 200,
      background: `radial-gradient(circle, ${t.shadowXs} 0%, transparent 70%)`,
      pointerEvents: "none",
    },
    priceAmount: {
      fontSize: 48,
      fontWeight: 900,
      color: "#fff",
      marginBottom: 4,
    },
    priceInterval: {
      fontSize: 16,
      fontWeight: 400,
      color: "rgba(255,255,255,0.5)",
    },
    savingsNote: {
      color: "#00ff60",
      fontSize: 13,
      marginBottom: 16,
    },
    subscribeBtn: {
      marginTop: 16,
      padding: "14px 40px",
      borderRadius: 14,
      border: "none",
      background: t.accent,
      color: "#fff",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 0 30px ${t.shadowSm}`,
      transition: "all 0.2s",
      width: "100%",
      maxWidth: 300,
    },
    activeCard: {
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(0,200,80,0.3)",
      borderRadius: 20,
      padding: "32px 24px",
      textAlign: "center",
      marginBottom: 32,
    },
    activeBadge: {
      display: "inline-block",
      background: "rgba(0,200,80,0.15)",
      border: "1px solid rgba(0,200,80,0.3)",
      color: "#00ff60",
      padding: "4px 16px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 2,
      marginBottom: 16,
    },
    activeTitle: {
      margin: "0 0 8px",
      fontSize: 22,
      fontWeight: 800,
      color: "#fff",
    },
    activeSubtext: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 14,
      marginBottom: 20,
    },
    cancelNotice: {
      color: "#ffcc00",
      fontSize: 13,
      marginBottom: 16,
      background: "rgba(255,200,0,0.1)",
      padding: "8px 12px",
      borderRadius: 8,
      display: "inline-block",
    },
    manageBtn: {
      padding: "12px 32px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.2s",
    },
    paymentPanel: {
      marginTop: 14,
      background: "rgba(0,0,0,0.35)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 14,
      maxWidth: 420,
      marginLeft: "auto",
      marginRight: "auto",
      textAlign: "left",
    },
    paymentActions: {
      display: "flex",
      gap: 8,
      marginTop: 12,
    },
    payBtn: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 12,
      border: "none",
      background: t.accent,
      color: "#fff",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 14,
    },
    cancelBtn: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "transparent",
      color: "rgba(255,255,255,0.8)",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 14,
    },
    paymentError: {
      color: "#ff8f8f",
      background: "rgba(255,0,0,0.08)",
      border: "1px solid rgba(255,0,0,0.2)",
      borderRadius: 10,
      padding: "8px 10px",
      marginTop: 10,
      fontSize: 12,
      textAlign: "left",
    },
    checkoutInfo: {
      color: "rgba(255,255,255,0.75)",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "8px 10px",
      marginTop: 10,
      fontSize: 12,
      textAlign: "left",
    },
    featuresGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
      gap: 12,
    },
    featureCard: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
    },
    featureIcon: {
      fontSize: 24,
      flexShrink: 0,
    },
    featureTitle: {
      color: "#fff",
      fontSize: 14,
      fontWeight: 600,
    },
    featureDesc: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 12,
      marginTop: 2,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {showSuccess && (
          <div style={styles.successBanner}>
            Welcome to Rivalis Pro! Your subscription is now active.
          </div>
        )}
        {showCanceled && (
          <div style={styles.canceledBanner}>
            Checkout canceled. No charges were made.
          </div>
        )}

        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>RIVALIS PRO</h1>
            <p style={styles.subtitle}>Unlock the full Rivalis experience</p>
          </div>
          <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>
            Back
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={{ color: "#aaa", marginTop: 12 }}>Loading plans...</p>
          </div>
        ) : isActive ? (
          <div style={styles.activeCard}>
            <div style={styles.activeBadge}>ACTIVE</div>
            <h2 style={styles.activeTitle}>You're a Rivalis Pro member!</h2>
            <p style={styles.activeSubtext}>
              Enjoy ad-free workouts, AI coaching, and all premium features.
            </p>
            {subscription.cancel_at_period_end && (
              <p style={styles.cancelNotice}>
                Your subscription will end on{" "}
                {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
              </p>
            )}
            <button onClick={handleManage} style={styles.manageBtn}>
              Manage Subscription
            </button>
          </div>
        ) : (
          <>
            {rivalisProduct && (monthlyPrice || annualPrice) && (
              <div style={styles.pricingSection}>
                <div style={styles.toggleRow}>
                  <button
                    onClick={() => setBillingPeriod("month")}
                    style={{
                      ...styles.toggleBtn,
                      ...(billingPeriod === "month" ? styles.toggleActive : {}),
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod("year")}
                    style={{
                      ...styles.toggleBtn,
                      ...(billingPeriod === "year" ? styles.toggleActive : {}),
                    }}
                  >
                    Annual
                    <span style={styles.saveBadge}>Save 33%</span>
                  </button>
                </div>

                <div style={styles.priceCard}>
                  <div style={styles.priceGlow} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    {billingPeriod === "month" && monthlyPrice && (
                      <>
                        <div style={styles.priceAmount}>
                          ${(getPriceAmount(monthlyPrice) / 100).toFixed(2)}
                          <span style={styles.priceInterval}>/month</span>
                        </div>
                        <button
                          onClick={() => handleCheckout(monthlyPrice.id)}
                          disabled={checkoutLoading === monthlyPrice.id}
                          style={{
                            ...styles.subscribeBtn,
                            opacity: checkoutLoading === monthlyPrice.id ? 0.6 : 1,
                          }}
                        >
                          {checkoutLoading === monthlyPrice.id
                            ? "Preparing Checkout..."
                            : "Subscribe Now"}
                        </button>
                        {selectedPriceId === monthlyPrice.id && clientSecret && stripePromise && (
                          <div style={styles.paymentPanel}>
                            <Elements
                              stripe={stripePromise}
                              options={{
                                clientSecret,
                                appearance: {
                                  theme: "night",
                                },
                              }}
                            >
                              <CustomCheckoutForm
                                styles={styles}
                                onSuccess={handlePaymentSuccess}
                                onCancel={handlePaymentCancel}
                                onError={setPaymentError}
                              />
                            </Elements>
                          </div>
                        )}
                      </>
                    )}
                    {billingPeriod === "year" && annualPrice && (
                      <>
                        <div style={styles.priceAmount}>
                          ${(getPriceAmount(annualPrice) / 100).toFixed(2)}
                          <span style={styles.priceInterval}>/year</span>
                        </div>
                        <div style={styles.savingsNote}>
                          That's just ${(getPriceAmount(annualPrice) / 100 / 12).toFixed(2)}/month
                        </div>
                        <button
                          onClick={() => handleCheckout(annualPrice.id)}
                          disabled={checkoutLoading === annualPrice.id}
                          style={{
                            ...styles.subscribeBtn,
                            opacity: checkoutLoading === annualPrice.id ? 0.6 : 1,
                          }}
                        >
                          {checkoutLoading === annualPrice.id
                            ? "Preparing Checkout..."
                            : "Subscribe Now"}
                        </button>
                        {selectedPriceId === annualPrice.id && clientSecret && stripePromise && (
                          <div style={styles.paymentPanel}>
                            <Elements
                              stripe={stripePromise}
                              options={{
                                clientSecret,
                                appearance: {
                                  theme: "night",
                                },
                              }}
                            >
                              <CustomCheckoutForm
                                styles={styles}
                                onSuccess={handlePaymentSuccess}
                                onCancel={handlePaymentCancel}
                                onError={setPaymentError}
                              />
                            </Elements>
                          </div>
                        )}
                      </>
                    )}
                    {checkoutInfo && <div style={styles.checkoutInfo}>{checkoutInfo}</div>}
                    {paymentError && <div style={styles.paymentError}>{paymentError}</div>}
                  </div>
                </div>
              </div>
            )}

            <div style={styles.featuresGrid}>
              {features.map((f, i) => (
                <div key={i} style={styles.featureCard}>
                  <span style={styles.featureIcon}>{f.icon}</span>
                  <div>
                    <div style={styles.featureTitle}>{f.title}</div>
                    <div style={styles.featureDesc}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CustomCheckoutForm({ styles, onSuccess, onCancel, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    onError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscription?success=true`,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const okStatuses = ["succeeded", "processing", "requires_capture"];
    if (paymentIntent?.status && okStatuses.includes(paymentIntent.status)) {
      await onSuccess();
      setSubmitting(false);
      return;
    }

    onError("Payment is not complete yet. Please try again.");
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <div style={styles.paymentActions}>
        <button type="submit" disabled={!stripe || submitting} style={styles.payBtn}>
          {submitting ? "Processing..." : "Complete Subscription"}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} style={styles.cancelBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

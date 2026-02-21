# Archived Stripe Integration

This file contains the archived code and logic for Stripe integration previously used in the project. All Stripe-related files and code have been removed from the app, but are preserved here for reference.

---

## src/services/subscriptionService.js

```
import { auth } from "../firebase.js";

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export const SubscriptionService = {
  async getPublishableKey() {
    const res = await fetch("/api/stripe/publishable-key");
    if (!res.ok) throw new Error("Failed to fetch publishable key");
    const data = await res.json();
    return data.publishableKey;
  },

  async getProducts() {
    const res = await fetch("/api/stripe/products");
    if (!res.ok) throw new Error("Failed to fetch products");
    const data = await res.json();
    return data.products;
  },

  async getSubscription() {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/subscription", { headers });
    if (!res.ok) throw new Error("Failed to check subscription");
    const data = await res.json();
    return data.subscription;
  },

  async createCheckout(priceId) {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify({ priceId }),
    });
    if (!res.ok) throw new Error("Failed to create checkout");
    const data = await res.json();
    return data.url;
  },

  async createCustomCheckout(priceId) {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/custom-checkout", {
      method: "POST",
      headers,
      body: JSON.stringify({ priceId }),
    });
    if (!res.ok) throw new Error("Failed to create custom checkout");
    return res.json();
  },

  async openPortal() {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error("Failed to open portal");
    const data = await res.json();
    return data.url;
  },
};
```

---

## src/views/Subscription.jsx (Stripe-related logic)

```
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// ...existing code...

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

// ...existing code...

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
```

---

## Note
All Stripe backend files (stripeClient.js, webhookHandlers.js, createCheckoutSession.routes.js, seed-products.js) and frontend files (stripeBrowser.js, stripeCheckout.js) were previously deleted. If you need their contents archived, please let me know.

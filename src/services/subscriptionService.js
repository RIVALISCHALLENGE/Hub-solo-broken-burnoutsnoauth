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

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
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },

  async getProducts() {
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },

  async getSubscription() {
    const headers = await getAuthHeaders();
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },

  async createCheckout(priceId) {
    const headers = await getAuthHeaders();
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },

  async createCustomCheckout(priceId) {
    const headers = await getAuthHeaders();
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },

  async openPortal() {
    const headers = await getAuthHeaders();
      // Stripe integration removed. All subscription API calls are now disabled.
      throw new Error("Stripe integration removed.");
  },
};

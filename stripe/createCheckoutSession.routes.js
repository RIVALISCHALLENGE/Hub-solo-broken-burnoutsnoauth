// Stripe Checkout session creation endpoint
const express = require('express');
const router = express.Router();

const { getUncachableStripeClient } = require('../stripe/stripeClient');

// Requires user authentication
router.post('/create-checkout-session', async (req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const { priceId, successUrl, cancelUrl } = req.body;
    // You may want to validate user and priceId here
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

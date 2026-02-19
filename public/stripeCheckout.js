// Fetch Stripe Checkout session ID and redirect
export async function startStripeCheckout(publishableKey, priceId) {
  // You must set these URLs to your actual domain
  const successUrl = window.location.origin + '/success';
  const cancelUrl = window.location.origin + '/cancel';

  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add Authorization header if needed
    },
    body: JSON.stringify({ priceId, successUrl, cancelUrl }),
  });

  const data = await response.json();
  if (!data.sessionId) {
    alert('Failed to create Stripe session: ' + (data.error || 'Unknown error'));
    return;
  }

  if (!window.Stripe) {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    document.head.appendChild(script);
    script.onload = () => {
      const stripe = window.Stripe(publishableKey);
      stripe.redirectToCheckout({ sessionId: data.sessionId });
    };
  } else {
    const stripe = window.Stripe(publishableKey);
    stripe.redirectToCheckout({ sessionId: data.sessionId });
  }
}

// Example usage:
// startStripeCheckout('pk_test_12345', 'price_abc123');

// Stripe payment integration for browser
// Replace 'pk_test_12345' with your actual Stripe publishable key

export function loadStripeScript() {
  if (!window.Stripe) {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    document.head.appendChild(script);
  }
}

export function createStripeCheckoutButton(publishableKey, sessionId) {
  loadStripeScript();
  const button = document.createElement('button');
  button.innerText = 'Pay with Stripe';
  button.onclick = () => {
    const stripe = window.Stripe(publishableKey);
    stripe.redirectToCheckout({ sessionId });
  };
  return button;
}

// Example usage:
// const btn = createStripeCheckoutButton('pk_test_12345', 'your_session_id');
// document.body.appendChild(btn);

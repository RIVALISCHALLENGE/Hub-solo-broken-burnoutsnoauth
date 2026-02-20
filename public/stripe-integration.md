# Stripe Integration (Browser)

This project uses Stripe Checkout for browser-side payments.

## Steps

1. Add your Stripe publishable key and sessionId in `index.html` (see the Stripe integration script).
2. The Stripe.js library is loaded dynamically via `stripeBrowser.js`.
3. A payment button is created and appended to the page. Clicking it redirects to Stripe Checkout.

## Example

```
import { createStripeCheckoutButton } from '/public/stripeBrowser.js';
const publishableKey = 'pk_test_12345'; // Replace with your key
const sessionId = 'your_session_id'; // Replace with your session id
const btn = createStripeCheckoutButton(publishableKey, sessionId);
document.body.appendChild(btn);
```

## Notes
- Never expose your Stripe secret key in the browser.
- Session IDs must be generated server-side using Stripe's API.
- For production, use your live publishable key.

## References
- [Stripe.js documentation](https://stripe.com/docs/js)
- [Checkout integration guide](https://stripe.com/docs/checkout/)

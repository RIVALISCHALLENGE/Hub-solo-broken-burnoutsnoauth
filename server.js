const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());

const { registerChatRoutes, getOpenAIClientExported } = require("./replit_integrations/chat");
const { registerImageRoutes } = require("./replit_integrations/image");
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    const mp3 = await openai.audio.speech.create({
      model: "gpt-audio",
      voice: "alloy",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    console.error('TTS Error:', err);
    res.status(500).send('TTS Failed');
  }
});

const { getRandomSocialImage, getSocialImageById } = require("./replit_integrations/live-engine-sync/socialImages");
const { WebhookHandlers } = require("./stripe/webhookHandlers");
const { getUncachableStripeClient, getStripePublishableKey, getStripeSync } = require("./stripe/stripeClient");
const { runMigrations } = require('stripe-replit-sync');

<<<<<<< HEAD
const liveRoomsRouter = require('./liveRooms.routes');
const stripeCheckoutSessionRouter = require('./stripe/createCheckoutSession.routes');

app.use(liveRoomsRouter);
app.use('/api/stripe', stripeCheckoutSessionRouter);
=======
const app = express();
app.use(cors());
const ENABLE_STRIPE = process.env.ENABLE_STRIPE === 'true';
>>>>>>> fix/test-live-mode-script

async function initStripe() {
  console.log('Stripe backend initialized for Firebase.');
}
<<<<<<< HEAD
initStripe();

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' });
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Failed to process Stripe webhook' });
=======

if (ENABLE_STRIPE) {
  initStripe();

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return sendStripeError(res, 400, 'Missing Stripe signature');
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
          return sendStripeError(res, 500, 'Failed to process Stripe webhook');
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        res.status(200).json({ received: true });
      const express = require('express');
      const cors = require('cors');
      const { randomUUID } = require('crypto');
      const app = express();
      app.use(cors());
      app.use(express.json());

      const ENABLE_STRIPE = process.env.ENABLE_STRIPE === 'true';

      const { registerChatRoutes, getOpenAIClientExported } = require("./replit_integrations/chat");
      const { registerImageRoutes } = require("./replit_integrations/image");
      const { OpenAI } = require('openai');

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy",
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      app.post('/api/tts', async (req, res) => {
        try {
          const { text } = req.body;
          const mp3 = await openai.audio.speech.create({
            model: "gpt-audio",
            voice: "alloy",
            input: text,
          });
          const buffer = Buffer.from(await mp3.arrayBuffer());
          res.set('Content-Type', 'audio/mpeg');
          res.send(buffer);
        } catch (err) {
          console.error('TTS Error:', err);
          res.status(500).send('TTS Failed');
        }
      });

      const { getRandomSocialImage, getSocialImageById } = require("./replit_integrations/live-engine-sync/socialImages");
      const { WebhookHandlers } = require("./stripe/webhookHandlers");
      const { getUncachableStripeClient, getStripePublishableKey, getStripeSync } = require("./stripe/stripeClient");
      const { runMigrations } = require('stripe-replit-sync');

      function sendStripeError(res, status, message) {
        try {
          return res.status(status).json({ error: message });
        } catch (e) {
          // fallback
          res.status(status).send(message);
        }
      }

      async function initStripe() {
        console.log('Stripe backend initialized for Firebase.');
      }

      // Webhook and Stripe-related endpoints (gated by ENABLE_STRIPE)
      if (ENABLE_STRIPE) {
        initStripe();

        app.post(
          '/api/stripe/webhook',
          express.raw({ type: 'application/json' }),
          async (req, res) => {
            const signature = req.headers['stripe-signature'];
            if (!signature) {
              return sendStripeError(res, 400, 'Missing Stripe signature');
            }
            try {
              const sig = Array.isArray(signature) ? signature[0] : signature;
              if (!Buffer.isBuffer(req.body)) {
                console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
                return sendStripeError(res, 500, 'Failed to process Stripe webhook');
              }
              await WebhookHandlers.processWebhook(req.body, sig);
              res.status(200).json({ received: true });
            } catch (error) {
              console.error('Webhook error:', error.message);
              return sendStripeError(res, 400, 'Failed to process Stripe webhook');
            }
          }
        );

        app.get('/api/stripe/publishable-key', async (req, res) => {
          try {
            const key = await getStripePublishableKey();
            res.json({ publishableKey: key });
          } catch (error) {
            console.error('Error getting publishable key:', error);
            sendStripeError(res, 500, 'Failed to fetch Stripe publishable key');
          }
        });

        app.get('/api/stripe/products', async (req, res) => {
          try {
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
            const result = await pool.query(`SELECT p.id as product_id, p.name as product_name, p.description as product_description, p.metadata as product_metadata, pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring, pr.active as price_active FROM stripe.products p LEFT JOIN stripe.prices pr ON pr.product = p.id WHERE p.active = true`);
            await pool.end();

            const productsMap = new Map();
            for (const row of result.rows) {
              if (!productsMap.has(row.product_id)) {
                productsMap.set(row.product_id, {
                  id: row.product_id,
                  name: row.product_name,
                  description: row.product_description,
                  metadata: row.product_metadata,
                  prices: []
                });
              }
              if (row.price_id) {
                productsMap.get(row.product_id).prices.push({
                  id: row.price_id,
                  unitAmount: row.unit_amount,
                  currency: row.currency,
                  recurring: row.recurring,
                  active: row.price_active
                });
              }
            }

            res.json({ products: Array.from(productsMap.values()) });
          } catch (error) {
            console.error('Error fetching products:', error);
            sendStripeError(res, 500, 'Failed to fetch Stripe products');
          }
        });

        app.get('/api/subscription/current', verifyFirebaseToken, async (req, res) => {
          try {
            const { db } = require('./src/firebase_server');
            const userDoc = await db.collection('users').doc(req.user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            if (!userData.stripeCustomerId) {
              return res.json({ subscription: null });
            }

            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
            const result = await pool.query(
              `SELECT id, status, current_period_start, current_period_end, cancel_at_period_end, items
               FROM stripe.subscriptions 
               WHERE customer = $1 AND status IN ('active', 'trialing', 'past_due')
               ORDER BY current_period_end DESC LIMIT 1`,
              [userData.stripeCustomerId]
            );
            await pool.end();

            const sub = result.rows[0] || null;

            const isActive = sub && (sub.status === 'active' || sub.status === 'trialing');
            await db.collection('users').doc(req.user.uid).set(
              { 
                subscriptionStatus: isActive ? 'active' : 'inactive',
                subscriptionUpdatedAt: new Date()
              },
              { merge: true }
            );

            res.json({ subscription: sub });
          } catch (error) {
            console.error('Error fetching subscription:', error);
            sendStripeError(res, 500, 'Failed to fetch subscription');
          }
        });

        app.post('/api/stripe/checkout', verifyFirebaseToken, async (req, res) => {
          try {
            const { priceId } = req.body;
            const { stripeClient, customerId } = await resolveStripeCustomer(req, { createIfMissing: true });
            const session = await stripeClient.checkout.sessions.create({ customer: customerId, payment_method_types: ['card'], line_items: [{ price: priceId, quantity: 1 }], mode: 'subscription', success_url: `${getAppBaseUrl(req)}/subscription?success=true`, cancel_url: `${getAppBaseUrl(req)}/subscription?canceled=true` });
            res.json({ url: session.url });
          } catch (error) {
            console.error('Checkout error:', error);
            sendStripeError(res, 500, 'Failed to create Stripe checkout session');
          }
        });

        app.post('/api/stripe/custom-checkout', verifyFirebaseToken, async (req, res) => {
          try {
            const { priceId } = req.body || {};
            if (!priceId) return sendStripeError(res, 400, 'Missing required field: priceId');

            const { stripeClient, customerId } = await resolveStripeCustomer(req, { createIfMissing: true });

            const subscription = await stripeClient.subscriptions.create({
              customer: customerId,
              items: [{ price: priceId }],
              payment_behavior: 'default_incomplete',
              payment_settings: { save_default_payment_method: 'on_subscription' },
              expand: ['latest_invoice.payment_intent'],
            });

            const paymentIntent = subscription.latest_invoice?.payment_intent;
            const clientSecret = paymentIntent?.client_secret;

            if (!clientSecret) return sendStripeError(res, 500, 'Failed to initialize Stripe payment');

            res.json({ clientSecret, subscriptionId: subscription.id, customerId });
          } catch (error) {
            console.error('Custom checkout error:', error);
            sendStripeError(res, 500, 'Failed to create Stripe custom checkout');
          }
        });

        app.post('/api/stripe/portal', verifyFirebaseToken, async (req, res) => {
          try {
            const { stripeClient, customerId } = await resolveStripeCustomer(req, { createIfMissing: false });
            if (!customerId) return sendStripeError(res, 400, 'No Stripe customer found');
            const baseUrl = getAppBaseUrl(req);
            const session = await stripeClient.billingPortal.sessions.create({ customer: customerId, return_url: `${baseUrl}/subscription` });
            res.json({ url: session.url });
          } catch (error) {
            console.error('Portal error:', error);
            sendStripeError(res, 500, 'Failed to create Stripe billing portal session');
          }
        });
      } else {
        // Stripe disabled - provide light stubs
        app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (_req, res) => sendStripeError(res, 503, 'Stripe integration is disabled'));
        app.get('/api/stripe/publishable-key', (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
        app.get('/api/stripe/products', (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
        app.get('/api/subscription/current', verifyFirebaseToken, async (_req, res) => res.json({ subscription: null }));
        app.post('/api/stripe/checkout', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
        app.post('/api/stripe/custom-checkout', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
        app.post('/api/stripe/portal', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
      }

      // lightweight payments endpoint (non-Stripe) - keep as-is but gate calls that require Stripe
      app.post('/api/payments/checkout', async (req, res) => {
        if (!ENABLE_STRIPE) return res.status(503).json({ success: false, error: 'Payments disabled' });
        const validPriceIds = ['price_1T1XanJzhejoQ9C7S6D7XbwU', 'price_1T1XakJzhejoQ9C71HH5Bnv1', 'price_1T1XamJzhejoQ9C7wyhVRcHv', 'price_1T1XalJzhejoQ9C71ihd5lV6'];
        const { priceId, userId } = req.body;
        if (!validPriceIds.includes(priceId)) return res.status(400).json({ success: false, error: 'Invalid priceId' });
        try {
          const stripe = await getUncachableStripeClient();
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/cancel`,
            metadata: { userId }
          });
          res.json({ success: true, sessionUrl: session.url });
        } catch (error) {
          console.error('Payments checkout error:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });

      function getAppBaseUrl(req) {
        const configuredDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
        if (configuredDomain) return `https://${configuredDomain}`;
        const forwardedProto = req.headers['x-forwarded-proto'];
        const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : (forwardedProto || req.protocol || 'http');
        const host = req.headers.host;
        return host ? `${protocol}://${host}` : 'http://localhost:5000';
      }

      async function verifyFirebaseToken(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
        try {
          const token = authHeader.split('Bearer ')[1];
          const { admin } = require('./src/firebase_server');
          const decoded = await admin.auth().verifyIdToken(token);
          req.user = decoded;
          next();
        } catch (error) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      async function resolveStripeCustomer(req, { createIfMissing = false } = {}) {
        const { db } = require('./src/firebase_server');
        const userRef = db.collection('users').doc(req.user.uid);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};
        let customerId = userData.stripeCustomerId || null;
        const stripeClient = await getUncachableStripeClient();
        if (!customerId && createIfMissing) {
          const customer = await stripeClient.customers.create({ email: req.user.email, metadata: { firebaseUid: req.user.uid } });
          customerId = customer.id;
          await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        } else if (customerId) {
          await stripeClient.customers.update(customerId, { metadata: { firebaseUid: req.user.uid } });
        }
        return { stripeClient, customerId };
      }

      function getLiveEngineBaseUrl() { return (process.env.LIVE_ENGINE_URL || '').replace(/\/$/, ''); }

      async function callLiveEngine(path, method = 'GET', body = null) {
        const baseUrl = getLiveEngineBaseUrl();
        if (!baseUrl) throw new Error('LIVE_ENGINE_URL is not configured');
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.LIVE_ENGINE_API_KEY) headers.Authorization = `Bearer ${process.env.LIVE_ENGINE_API_KEY}`;
        const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || data?.message || `Live Engine request failed (${response.status})`);
        return data;
      }

      app.get('/api/live-engine/health', async (_req, res) => {
        try { res.json({ success: true, health: await callLiveEngine('/health', 'GET') }); }
        catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.post('/api/live-engine/rooms/create', async (req, res) => {
        try {
          const { gameMode, exerciseName, showdown } = req.body || {};
          const created = await callLiveEngine('/sessions', 'POST', { gameMode: gameMode || 'classic', exerciseName: exerciseName || showdown?.name || 'pushups', showdown: showdown?.id || 'hub' });
          res.json({ success: true, sessionId: created?.sessionId || created?.id || null, room: created || null });
        } catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.get('/api/live-engine/rooms/:sessionId', async (req, res) => {
        try { res.json({ success: true, room: await callLiveEngine(`/sessions/${req.params.sessionId}`, 'GET') }); }
        catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.post('/api/live-engine/rooms/:sessionId/start', async (req, res) => {
        try { res.json({ success: true, data: await callLiveEngine(`/sessions/${req.params.sessionId}/start`, 'POST', req.body || {}) }); }
        catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.post('/api/live-engine/rooms/:sessionId/end', async (req, res) => {
        try { res.json({ success: true, data: await callLiveEngine(`/sessions/${req.params.sessionId}/end`, 'POST', req.body || {}) }); }
        catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.post('/api/live-engine/sessions/ended', async (req, res) => {
        try {
          const authHeader = req.headers.authorization || '';
          if (!process.env.HUB_API_SECRET || authHeader !== `Bearer ${process.env.HUB_API_SECRET}`) return res.status(401).json({ success: false, error: 'Unauthorized' });
          const { sessionId, endedAt, winner, finalLeaderboard, sessionDurationMs, exerciseName, gameMode, socialImage, imageId, imageUrl } = req.body || {};
          if (!sessionId || !Array.isArray(finalLeaderboard)) return res.status(400).json({ success: false, error: 'Missing required fields' });
          const { db } = require('./src/firebase_server');
          const selectedSocialImage = socialImage || (imageId ? getSocialImageById(imageId) : null) || (imageUrl ? { id: null, url: imageUrl, description: 'Provided social image' } : null) || getRandomSocialImage();
          await db.collection('liveSessionArchive').doc(sessionId).set({ sessionId, exerciseName: exerciseName || null, gameMode: gameMode || 'standard', endedAt: endedAt || Date.now(), durationMs: Number.isFinite(Number(sessionDurationMs)) ? Number(sessionDurationMs) : null, winner: winner || null, finalLeaderboard, socialImage: selectedSocialImage, updatedAt: new Date() }, { merge: true });
          return res.status(200).json({ success: true, sessionId, socialImage: selectedSocialImage, message: `Session ${sessionId} archived` });
        } catch (error) { return res.status(500).json({ success: false, error: 'Failed to archive session', message: error.message }); }
      });

      app.get('/api/live-engine/session/:sessionId', async (req, res) => {
        try {
          const { db } = require('./src/firebase_server');
          const archiveDoc = await db.collection('liveSessionArchive').doc(req.params.sessionId).get();
          if (!archiveDoc.exists) return res.status(404).json({ success: false, error: 'Session not found' });
          return res.status(200).json({ success: true, sessionId: req.params.sessionId, ...archiveDoc.data() });
        } catch (error) { return res.status(500).json({ success: false, error: 'Failed to fetch session data', message: error.message }); }
      });

      app.post('/api/live-engine/rooms/:sessionId/discord-vc', async (req, res) => {
        try {
          const discordBaseUrl = (process.env.LIVE_ENGINE_DISCORD_BOT_URL || '').replace(/\/$/, '');
          if (!discordBaseUrl) return res.status(400).json({ success: false, error: 'LIVE_ENGINE_DISCORD_BOT_URL is not configured' });
          const response = await fetch(`${discordBaseUrl}/create-vc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: req.params.sessionId, guildId: process.env.DISCORD_GUILD_ID }) });
          const data = await response.json().catch(() => null);
          if (!response.ok) return res.status(502).json({ success: false, error: data?.error || data?.message || 'Discord VC request failed' });
          res.json({ success: true, inviteLink: data?.inviteLink || data?.discordLink || data?.url || '', data });
        } catch (error) { res.status(502).json({ success: false, error: error.message }); }
      });

      app.post('/api/live-engine/share-bonus', async (req, res) => {
        try {
          const authHeader = req.headers.authorization || '';
          if (!process.env.HUB_API_SECRET || authHeader !== `Bearer ${process.env.HUB_API_SECRET}`) return res.status(401).json({ success: false, error: 'Unauthorized' });
          const { userId, sessionId, platform, bonusTickets, sharedAt, postUrl } = req.body || {};
          if (!userId || !sessionId || !platform) return res.status(400).json({ success: false, error: 'Missing required fields' });
          const { db, admin } = require('./src/firebase_server');
          const normalizedPlatform = String(platform).toLowerCase();
          const ticketAmount = Number.isFinite(Number(bonusTickets)) && Number(bonusTickets) > 0 ? Math.floor(Number(bonusTickets)) : 100;
          const shareEventId = `${sessionId}_${normalizedPlatform}`;
          const userRef = db.collection('users').doc(userId);
          const shareBonusRef = userRef.collection('liveShareBonuses').doc(shareEventId);
          const archiveRef = db.collection('liveSessionArchive').doc(sessionId);
          const result = await db.runTransaction(async (transaction) => {
            if ((await transaction.get(shareBonusRef)).exists) return { alreadyAwarded: true };
            transaction.set(userRef, { ticketBalance: admin.firestore.FieldValue.increment(ticketAmount), updatedAt: new Date() }, { merge: true });
            transaction.set(shareBonusRef, { userId, sessionId, platform: normalizedPlatform, bonusTickets: ticketAmount, sharedAt: sharedAt ? new Date(sharedAt) : new Date(), postUrl: postUrl || '', createdAt: new Date() }, { merge: true });
            transaction.set(archiveRef, { socialShares: { [normalizedPlatform]: { userId, bonusTickets: ticketAmount, sharedAt: sharedAt ? new Date(sharedAt) : new Date(), postUrl: postUrl || '' } }, updatedAt: new Date() }, { merge: true });
            return { alreadyAwarded: false };
          });
          if (result.alreadyAwarded) return res.status(200).json({ success: true, alreadyAwarded: true, message: 'Already awarded' });
          return res.status(200).json({ success: true, awardedTickets: ticketAmount, message: 'Awarded' });
        } catch (error) { return res.status(500).json({ success: false, error: 'Failed to process share bonus', message: error.message }); }
      });

      registerChatRoutes(app);
      registerImageRoutes(app);

      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} else {
  app.post('/api/stripe/checkout', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
  app.post('/api/stripe/custom-checkout', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
  app.post('/api/stripe/portal', verifyFirebaseToken, (_req, res) => sendStripeError(res, 503, 'Stripe integration disabled'));
}
>>>>>>> fix/test-live-mode-script

registerChatRoutes(app);
registerImageRoutes(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

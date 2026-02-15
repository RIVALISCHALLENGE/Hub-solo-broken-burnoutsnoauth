const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const { registerChatRoutes, getOpenAIClientExported } = require("./replit_integrations/chat");
const { registerImageRoutes } = require("./replit_integrations/image");
const { registerLiveEngineSyncRoutes } = require("./replit_integrations/live-engine-sync");
const { WebhookHandlers } = require("./stripe/webhookHandlers");
const { getUncachableStripeClient, getStripePublishableKey, getStripeSync } = require("./stripe/stripeClient");
const { runMigrations } = require('stripe-replit-sync');

const app = express();
app.use(cors());

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set — skipping Stripe initialization');
    return;
  }
  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    console.log('Webhook configured:', JSON.stringify(webhookResult).slice(0, 200));

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

initStripe();

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json());

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const { admin } = require('./src/firebase_server');
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/stripe/publishable-key', async (req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error) {
    console.error('Error getting publishable key:', error);
    res.status(500).json({ error: 'Failed to get publishable key' });
  }
});

app.get('/api/stripe/products', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const result = await pool.query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY p.name, pr.unit_amount
    `);
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
    res.status(500).json({ error: 'Failed to fetch products' });
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
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

app.post('/api/checkout-session', verifyFirebaseToken, async (req, res) => {
  try {
    const { db } = require('./src/firebase_server');
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    let customerId = userData.stripeCustomerId;

    const stripeClient = await getUncachableStripeClient();
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: req.user.email,
      });
      customerId = customer.id;
      await db.collection('users').doc(req.user.uid).set({
        stripeCustomerId: customerId,
      }, { merge: true });
    }

    const { priceId } = req.body;
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/subscription?success=true`,
      cancel_url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/subscription?success=false`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.post('/api/customer-portal', verifyFirebaseToken, async (req, res) => {
  try {
    const { db } = require('./src/firebase_server');
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    if (!userData.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer' });
    }

    const stripeClient = await getUncachableStripeClient();
    const session = await stripeClient.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/subscription`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

registerChatRoutes(app);

app.post('/api/generate-plan', verifyFirebaseToken, async (req, res) => {
  try {
    const { fitnessGoals, appSeeking, age, gender, fitnessLevel, workoutFrequency, injuries } = req.body;

    const { db } = require('./src/firebase_server');
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const isPro = userData.subscriptionStatus === 'active';

    const goalsText = Array.isArray(fitnessGoals) && fitnessGoals.length > 0
      ? fitnessGoals.join(", ")
      : "General Fitness";
    const seekingText = Array.isArray(appSeeking) && appSeeking.length > 0
      ? appSeeking.join(", ")
      : (appSeeking || "not specified");

    if (!isPro) {
      const levelMap = {
        'Beginner': { sets: 2, reps: '8-10', rest: '60s' },
        'Intermediate': { sets: 3, reps: '12-15', rest: '45s' },
        'Advanced': { sets: 4, reps: '15-20', rest: '30s' },
      };
      const params = levelMap[fitnessLevel] || levelMap['Beginner'];

      const sampleExercises = [
        { name: 'Squats', category: 'Legs' },
        { name: 'Push-ups', category: 'Arms' },
        { name: 'Plank', category: 'Core' },
        { name: 'Jumping Jacks', category: 'Cardio' },
        { name: 'Lunges', category: 'Legs' },
      ];

      const plan = `**⚡ YOUR RIVALIS STARTER PLAN**

**WEEKLY OVERVIEW**
Train ${workoutFrequency || '3-4 days/week'} focusing on full-body bodyweight sessions. Mix strength days with cardio bursts using Solo Mode and Burnouts to keep your body guessing and your scores climbing.

**SAMPLE WORKOUT DAY**
${sampleExercises.map(e => `- **${e.name}** (${e.category}) — ${params.sets} sets × ${params.reps} reps, ${params.rest} rest`).join('\n')}

**TOP 3 TIPS**
1. **Start every session in Burnouts Mode** — let the camera track your reps and build your streak.
2. **Stay consistent** — ${fitnessLevel === 'Beginner' ? 'focus on form over speed, your scores will climb naturally' : 'push for progressive overload each week to keep leveling up'}.
3. **Log your runs** — Use Run Mode to track outdoor cardio and stack points on the leaderboard.

---

**🔒 YOU'RE MISSING OUT ON YOUR ULTIMATE EDGE**

With **Rivalis Pro**, your AI Coach becomes your full-time personal trainer, nutritionist, and wellness guide:

⚔️ **Custom Workout Builder** — A full weekly training split built around YOUR body, YOUR schedule, and YOUR goals. Not a generic template — a real plan that evolves with you.

🍎 **Personalized Nutrition Guide** — Daily macro targets, meal timing strategies, and sample meals tailored to your goals. Whether you're cutting, bulking, or maintaining — your coach has you covered.

🧘 **Wellness & Recovery Protocol** — Smart rest day programming, stretching routines, sleep optimization, and injury prevention guidance to keep you performing at your peak.

📈 **12-Week Milestone Tracker** — 4-week, 8-week, and 12-week checkpoints so you can see exactly how far you've come and what's next.

💬 **Unlimited AI Coaching** — Ask your coach anything, anytime. No daily limits, no short answers. Get the full power of your personal fitness AI.

🚫 **Ad-Free Experience** — Zero distractions. Just you and the grind.

👉 **Upgrade to Rivalis Pro and unlock your ultimate fitness coach.**`;

      return res.json({ plan, isPro });
    }

    const prompt = `You are the Rivalis AI Fitness Coach. Generate a personalized fitness plan based on this user's profile:

GOALS: ${goalsText}
SEEKING IN RIVALIS: ${seekingText}
AGE: ${age || "not provided"}
GENDER: ${gender || "not provided"}
FITNESS LEVEL: ${fitnessLevel || "not provided"}
WORKOUT FREQUENCY: ${workoutFrequency || "not provided"}
INJURIES/LIMITATIONS: ${injuries || "none"}

CRITICAL: You may ONLY recommend exercises from this approved list (all bodyweight, NO equipment):
- Arms: Push-ups, Plank Up-Downs, Pike Push-ups, Shoulder Taps
- Legs: Squats, Lunges, Glute Bridges, Calf Raises
- Core: Crunches, Plank, Russian Twists, Leg Raises
- Cardio: Jumping Jacks, High Knees, Burpees, Mountain Climbers
- Running: Outdoor runs (tracked in Run Mode)

Do NOT suggest dumbbells, resistance bands, barbells, kettlebells, machines, pull-up bars, or any equipment.

Generate a FULL detailed plan with:
1. **WEEKLY TRAINING SPLIT** — Day-by-day breakdown using ONLY the approved exercises above, with sets, reps, and rest times
2. **NUTRITION BLUEPRINT** — Daily macro targets, meal timing, sample meals
3. **RECOVERY PROTOCOL** — Rest days, stretching, sleep recommendations
4. **MILESTONES** — 4-week, 8-week, and 12-week progress checkpoints
5. **RIVALIS INTEGRATION** — How to use Solo Mode, Burnouts, and Run Mode to complement the plan

Be detailed, specific, and actionable. Use bold headings and bullet points.
Use the cyberpunk Rivalis tone — sharp, motivating, and authoritative. Format with markdown-style bold headings.`;

    const openai = getOpenAIClientExported();
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    });

    const plan = completion.choices[0]?.message?.content || "Plan generation failed. Try again.";
    res.json({ plan, isPro });
  } catch (error) {
    console.error("Plan generation error:", error);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

registerImageRoutes(app);

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

app.post("/api/uploads/request-url", async (req, res) => {
  try {
    const { name, contentType } = req.body;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    
    if (!bucketId || !privateDir) {
      return res.status(500).json({ error: "Object storage not configured" });
    }

    const objectId = randomUUID();
    const objectName = `${privateDir}/uploads/${objectId}`;
    
    const request = {
      bucket_name: bucketId,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
    };

    const signResponse = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );

    if (!signResponse.ok) throw new Error("Failed to sign URL");

    const { signed_url } = await signResponse.json();
    res.json({
      uploadURL: signed_url,
      objectPath: `/objects/uploads/${objectId}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/objects/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    
    if (!bucketId || !privateDir) {
      return res.status(500).json({ error: "Object storage not configured" });
    }

    const objectName = `${privateDir}/${type}/${id}`;

    const request = {
      bucket_name: bucketId,
      object_name: objectName,
      method: "GET",
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    const signResponse = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );

    if (!signResponse.ok) return res.status(404).send("Not found");

    const { signed_url } = await signResponse.json();
    res.redirect(signed_url);
  } catch (error) {
    res.status(500).send("Error");
  }
});

app.post("/api/admin/raffle-draw", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const { runRaffle } = require('./scripts/raffle_draw');
    const result = await runRaffle();
    res.json({ success: true, winner: result });
  } catch (error) {
    console.error("Raffle draw failed:", error);
    res.status(500).json({ error: "Raffle draw failed" });
  }
});

app.post("/api/logs/client-error", async (req, res) => {
  try {
    const { db } = require('./src/firebase_server');
    const logEntry = {
      ...req.body,
      type: 'error',
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    await db.collection('system_logs').add(logEntry);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send("Logging failed");
  }
});

app.post("/api/logs/activity", async (req, res) => {
  try {
    const { db } = require('./src/firebase_server');
    const logEntry = {
      ...req.body,
      type: 'activity',
      timestamp: new Date()
    };
    await db.collection('system_logs').add(logEntry);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send("Logging failed");
  }
});

app.post("/api/admin/system-logs", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const { db } = require('./src/firebase_server');
    const snapshot = await db.collection('system_logs')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/user-action", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { action, userId } = req.body;
  try {
    const { db } = require('./src/firebase_server');
    await db.collection('admin_actions').add({
      action,
      userId,
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/delete-message", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { messageId, collection } = req.body;
  try {
    const { db } = require('./src/firebase_server');
    await db.collection(collection || 'global_messages').doc(messageId).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/live-perk", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { perk } = req.body;
  try {
    const { db } = require('./src/firebase_server');
    await db.collection('system_config').doc('live_mode').set({ 
      activePerk: perk,
      updatedAt: new Date()
    }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/arena-event", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { event } = req.body;
  try {
    const { db } = require('./src/firebase_server');
    await db.collection('system_config').doc('live_mode').set({ 
      activeEvent: event,
      updatedAt: new Date()
    }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/broadcast", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { message } = req.body;
  try {
    const { db } = require('./src/firebase_server');
    await db.collection('global_broadcasts').add({
      message,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000)
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register Live Engine Sync Routes
registerLiveEngineSyncRoutes(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

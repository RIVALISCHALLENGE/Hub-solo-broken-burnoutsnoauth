const OpenAI = require("openai");
const { chatStorage } = require("./storage.js");
const { Parser } = require("json2csv");
const { Pool } = require("pg");

let pool = null;

let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set up the OpenAI integration.");
    }
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openai;
}

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  }
  return pool;
}

async function resolveSubscriptionAccess(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isPro: false, uid: null, userData: null };
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const { admin, db } = require("../../src/firebase_server");
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    if (userData?.subscriptionStatus === "active") {
      return { isPro: true, uid, userData };
    }

    const customerId = userData?.stripeCustomerId;
    const dbPool = getPool();

    if (!customerId || !dbPool) {
      return { isPro: false, uid, userData };
    }

    const result = await dbPool.query(
      `SELECT status, id
       FROM stripe.subscriptions
       WHERE customer = $1 AND status IN ('active', 'trialing', 'past_due')
       ORDER BY current_period_end DESC LIMIT 1`,
      [customerId]
    );

    const sub = result.rows[0] || null;
    const isPro = Boolean(sub && (sub.status === "active" || sub.status === "trialing"));

    await db.collection("users").doc(uid).set(
      {
        subscriptionStatus: isPro ? "active" : "inactive",
        subscriptionId: sub?.id || null,
        subscriptionUpdatedAt: new Date(),
      },
      { merge: true }
    );

    return { isPro, uid, userData };
  } catch (error) {
    console.error("Subscription access resolution failed:", error.message);
    return { isPro: false, uid: null, userData: null };
  }
}

function registerChatRoutes(app) {
  function extractPreferredName(userContext = "") {
    const text = String(userContext || "");
    if (!text) return null;

    const match = text.match(/preferred\s+name\s*:\s*([^,\n]+)/i);
    if (!match || !match[1]) return null;

    const parsed = match[1].trim();
    return parsed || null;
  }

  function buildFreeTierTeaser(userMessage = "") {
    const text = (userMessage || "").toLowerCase();

    if (/meal|nutrition|diet|macro/.test(text)) {
      return [
        "PREMIUM PREVIEW 🔒",
        "",
        "Rivalis Pro unlocks:",
        "- Personalized nutrition protocols",
        "- Macro-calibrated meal structures",
        "- Goal-specific fueling timelines",
        "",
        "Unlock Rivalis Pro to activate your full personalized protocol.",
      ].join("\n");
    }

    if (/workout|plan|program|routine|training/.test(text)) {
      return [
        "PREMIUM PREVIEW 🔒",
        "",
        "Rivalis Pro unlocks:",
        "- Full in-app workout protocols",
        "- Progressive overload programming",
        "- Recovery and adaptation sequencing",
        "",
        "Unlock Rivalis Pro to activate your full personalized protocol.",
      ].join("\n");
    }

    return [
      "PREMIUM PREVIEW 🔒",
      "",
      "Rivalis Pro unlocks your full AI Coach capabilities:",
      "- Personalized training systems",
      "- Nutrition strategy and progress tracking",
      "- Advanced protocol generation",
      "",
      "Unlock Rivalis Pro to activate your full personalized protocol.",
    ].join("\n");
  }

  // Export conversation to CSV
  app.get("/api/conversations/:id/export", async (req, res) => {
    try {
      const conversationId = req.params.id;
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      
      // Structure data for a clean, professional protocol
      const data = messages.map(m => {
        const role = m.role === 'user' ? 'RIVAL' : 'COACH';
        const timestamp = new Date(m.createdAt).toLocaleString();
        
        // Split content into rows if it contains bullet points for better readability in Excel/CSV
        return {
          'Protocol Phase': role,
          'Timestamp': timestamp,
          'Data Payload': m.content.replace(/\n/g, ' | ')
        };
      });

      const fields = ["Protocol Phase", "Timestamp", "Data Payload"];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.header("Content-Type", "text/csv");
      res.attachment(`RIVALIS_PROTOCOL_${conversationId}_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    } catch (error) {
      console.error("Export Error:", error);
      res.status(500).json({ error: "Failed to export protocol" });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = req.params.id;
      const { content, userContext } = req.body;
      const { isPro } = await resolveSubscriptionAccess(req);
      const preferredName = extractPreferredName(userContext) || "Rival";

      if (!isPro) {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `free_msgs_${conversationId}_${today}`;
        if (!global._freeMsgCounts) global._freeMsgCounts = {};
        global._freeMsgCounts[cacheKey] = (global._freeMsgCounts[cacheKey] || 0) + 1;
        if (global._freeMsgCounts[cacheKey] > 1000) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.write(`data: ${JSON.stringify({ content: "Daily free preview limit reached. Unlock Rivalis Pro for always-on coaching. 🔒" })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          return res.end();
        }
      }

      await chatStorage.createMessage(conversationId, "user", content);

      if (!isPro) {
        const teaser = buildFreeTierTeaser(content || "");
        await chatStorage.createMessage(conversationId, "assistant", teaser);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ content: teaser })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }

      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const recentMessages = messages;
      const chatMessages = recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const baseSystemPrompt = `You are the Rivalis AI Fitness Coach, a high-intelligence cyberpunk entity. 

PERSONA:
- High-energy, gritty, and relentlessly motivating.
- **ELITE EFFICIENCY**: Never send wall-of-text responses.
- **PHASED PROTOCOL**: Break down large plans into small, punchy segments.
- **ONE QUESTION AT A TIME**: Gather specific data (equipment, injuries, etc.) through short, tactical questions rather than one massive data dump.
- **CONCISE & IMPACTFUL**: Use short sentences and bold headings to ensure the data is instantly actionable and not intimidating.
- **ESCALATION PROTOCOL**: If the user asks for something outside your operational parameters (e.g., technical support, billing, account deletion, or complex medical advice) or if you are unable to fulfill a request, you MUST say: "TRANSFERRING TO HUMAN AGENT. A high-level administrator has been notified. Stand by."
- **STRICT MISSION FOCUS**: You are strictly a fitness and nutrition coach. Unrelated topics trigger the escalation protocol.

KNOWLEDGE BASE:
- Rivalis Hub: A gamified fitness dashboard.
- Solo Mode: Camera-based AI rep counting (Arms, Legs, Core, Cardio).
- Burnouts: High-intensity category-based workouts.
- Run Mode: GPS-tracked outdoor running.
- Raffle: Tickets are earned through workouts and entries for real-world prizes drawn weekly.

AVAILABLE EXERCISES (ONLY use these — NO equipment, NO dumbbells, NO bands, NO gym machines):
- **Arms:** Push-ups, Plank Up-Downs, Pike Push-ups, Shoulder Taps
- **Legs:** Squats, Lunges, Glute Bridges, Calf Raises
- **Core:** Crunches, Plank, Russian Twists, Leg Raises
- **Cardio:** Jumping Jacks, High Knees, Burpees, Mountain Climbers
- **Running:** Outdoor runs (tracked in Run Mode)
These are ALL bodyweight exercises. NEVER suggest exercises requiring dumbbells, resistance bands, barbells, kettlebells, cable machines, pull-up bars, or any other equipment. If a user asks about equipment-based exercises, explain that Rivalis focuses on bodyweight training and running, then recommend alternatives from the list above.

PERSONALIZED WORKOUT PROTOCOL:
- When a user requests a workout plan or expresses a goal, you MUST design a sophisticated, multi-part protocol using ONLY the exercises listed above plus running.
- STRUCTURE:
    1. EXERCISES: Specific movements from the approved list, sets, reps, and alignment with Solo Mode/Burnouts/Run Mode.
    2. NUTRITION: Hyper-efficient fueling, macros, and hydration tailored to the goal.
- FORMATTING: Use clear headings and bullet points. Never send wall-of-text responses. Use bold text for emphasis.
- EXPORT: At the end of a finalized plan, you MUST include a specific command for the user: "PROTOCOL READY. Click 'EXPORT PLAN' to download your biometric data sheet."
- ONE QUESTION AT A TIME: Ask exactly one clarifying question (injuries, etc.) before finalizing the full multi-part plan. Do NOT ask about equipment — all exercises are bodyweight only.
- Maintain the cyberpunk persona while delivering elite-level physiological advice.

COMMUNICATION PROTOCOL:
- BREAK DOWN RESPONSES: Never send massive blocks of text. 
- ONE QUESTION AT A TIME: When building a workout plan or gathering info, ask exactly one clarifying question and wait for the Rival's response.
- CONCISE & IMPACTFUL: Use short, punchy sentences. 
- STEP-BY-STEP: If providing a plan, give it in small, digestible phases rather than one giant dump.
- SMART RESPONSE POLICY: If the user request is clear and answerable, provide a direct tactical answer immediately. Ask a clarifying question only when critical data is missing.

RIVALIS INTEGRATION CONTRACT (MANDATORY for workout/program/plan requests):
- After the human-readable response, include a machine-readable block exactly in this format:
\`\`\`RIVALIS_PLAN_JSON
{ "planName": "...", "days": [ { "day": "Day 1", "focus": "Arms", "mode": "Solo|Burnouts|Run", "exercises": [ { "name": "Push-ups", "sets": 4, "reps": "10-15", "restSec": 60 } ] } ] }
\`\`\`
- ONLY use these exact exercise names in JSON: Push-ups, Plank Up-Downs, Pike Push-ups, Shoulder Taps, Squats, Lunges, Glute Bridges, Calf Raises, Crunches, Plank, Russian Twists, Leg Raises, Jumping Jacks, High Knees, Burpees, Mountain Climbers, Outdoor Run.
- Never output any equipment-based exercise in the JSON block.
- Keep JSON valid and parseable.

TONE:
- Do not be generic. Be sharp, witty, and authoritative.
- Keep responses concise but saturated with personality.
- If the user is on a tour, guide them to the next sector of the hub.
- You MUST directly address the user by their preferred name in every response.`;

      const proEnhancement = isPro ? `

PRO MEMBER FEATURES (This user is a Rivalis Pro subscriber):
- You have FULL access to advanced personal training capabilities.
- **CUSTOM MEAL PLANS**: When asked, create detailed daily/weekly meal plans with exact portions, macros (protein/carbs/fat), calories, and meal timing. Tailor to their goals (cutting, bulking, maintenance, keto, vegan, etc.).
- **WORKOUT BUILDER**: Design comprehensive multi-week training programs with progressive overload, periodization, and exercise substitutions. Include warm-up and cooldown protocols.
- **GOAL TRACKING**: Help them set SMART fitness goals, track progress metrics, and adjust plans based on their feedback. Provide weekly check-in prompts.
- **ADVANCED ANALYTICS**: Offer detailed analysis of their training volume, intensity, and recovery needs.
- **INJURY PREVENTION**: Provide prehab exercises, mobility work, and form cues for their specific needs.
${userContext ? `\nUSER CONTEXT: ${userContext}` : ''}
- Preferred name: ${preferredName}
- Address them as a valued Pro member. Provide the most detailed, personalized advice possible.` : `

FREE TIER USER:
- Provide basic fitness advice and motivation.
- PREMIUM PREVIEW POLICY (STRICT): If the user asks for meal plans, full workout programs, long-term progression, or advanced tracking, provide ONLY a short preview (high-level bullet outline), not a full actionable plan.
- Always end premium-preview responses with: "Unlock Rivalis Pro to activate your full personalized protocol."
- Keep free-tier outputs concise and teaser-level for premium capabilities while still being helpful.
- Do NOT gate basic fitness Q&A behind the subscription.
- Preferred name: ${preferredName}
- Address the user by preferred name in every response.`;

      const stream = await getOpenAIClient().chat.completions.create({
        model: isPro ? "gpt-5" : "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: baseSystemPrompt + proEnhancement
          },
          ...chatMessages
        ],
        stream: true,
        max_completion_tokens: isPro ? 4096 : 700,
      });

      let fullResponse = "";
      const forcedPrefix = `${preferredName}, `;
      fullResponse += forcedPrefix;
      res.write(`data: ${JSON.stringify({ content: forcedPrefix })}\n\n`);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("AI Route Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Failed" });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });
}

function getOpenAIClientExported() {
  return getOpenAIClient();
}

module.exports = { registerChatRoutes, getOpenAIClientExported };

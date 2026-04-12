import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  // @ts-ignore - databaseId is supported in newer versions of firebase-admin
  db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
}

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
console.log(`Stripe Key Prefix: ${stripeKey.substring(0, 7)}...`);

const stripe = new Stripe(stripeKey, {
  // @ts-ignore - version might differ based on installed package
  apiVersion: "2024-04-10",
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Webhook endpoint needs raw body
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const coins = parseInt(session.metadata?.coins || "0");
      
      console.log(`Webhook: Processing completed session ${session.id} for user ${userId} (${coins} coins)`);

      if (userId && coins > 0) {
        try {
          const userRef = db.collection("users").doc(userId);
          await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (userDoc.exists) {
              const currentCoins = userDoc.data()?.coins || 0;
              const newCoins = currentCoins + coins;
              console.log(`Webhook: Updating user ${userId} coins from ${currentCoins} to ${newCoins}`);
              t.update(userRef, { coins: newCoins });
              
              // Record transaction
              const transRef = db.collection("transactions").doc();
              t.set(transRef, {
                userId,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                coins,
                type: "purchase",
                status: "completed",
                stripeSessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              console.error(`Webhook: User document ${userId} not found in Firestore`);
            }
          });
          console.log(`Webhook: Successfully added ${coins} coins to user ${userId}`);
        } catch (error) {
          console.error("Webhook: Error updating user coins:", error);
        }
      } else {
        console.warn(`Webhook: Missing userId or coins in session metadata. userId: ${userId}, coins: ${coins}`);
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, coins, price, label } = req.body;

    if (!userId || !coins || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Use the origin from the request or fallback to a safe default
      const origin = req.get('origin') || req.get('referer') || `${req.protocol}://${req.get('host')}`;
      console.log(`Creating checkout session for user ${userId}, origin: ${origin}`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `${coins} Moedas - VibeClub`,
                description: `Pacote ${label}`,
              },
              unit_amount: price * 100, // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment-cancel`,
        metadata: {
          userId,
          coins: coins.toString(),
        },
      });

      console.log(`Session created successfully: ${session.id}`);
      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

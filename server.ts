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

// 🔥 Firebase
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
);

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore();

if (firebaseConfig.firestoreDatabaseId) {
  // @ts-ignore
  db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
}

// 🔥 Stripe (CORRIGIDO)
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error("❌ STRIPE_SECRET_KEY não encontrada!");
  process.exit(1);
}

console.log(`Stripe Key Prefix: ${stripeKey.substring(0, 7)}...`);

const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-04-10",
});

async function startServer() {
  const app = express();

  // 🔥 PORTA CORRETA (OBRIGATÓRIO)
  const PORT = process.env.PORT || 3000;

  app.use(cors());

  // 🔥 ROTA TESTE
  app.get("/", (req, res) => {
    res.send("VibeClub API rodando 🚀");
  });

  // 🔥 WEBHOOK (Stripe)
  app.post(
    "/api/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
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

        if (userId && coins > 0) {
          try {
            const userRef = db.collection("users").doc(userId);

            await db.runTransaction(async (t) => {
              const userDoc = await t.get(userRef);

              if (userDoc.exists) {
                const currentCoins = userDoc.data()?.coins || 0;
                const newCoins = currentCoins + coins;

                t.update(userRef, { coins: newCoins });

                const transRef = db.collection("transactions").doc();
                t.set(transRef, {
                  userId,
                  coins,
                  type: "purchase",
                  status: "completed",
                  stripeSessionId: session.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            });

            console.log(`✅ Coins adicionadas: ${coins} para ${userId}`);
          } catch (error) {
            console.error("Erro ao atualizar coins:", error);
          }
        }
      }

      res.json({ received: true });
    }
  );

  app.use(express.json());

  // 🔥 HEALTH CHECK
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 🔥 CRIAR PAGAMENTO
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, coins, price, label } = req.body;

    if (!userId || !coins || !price) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    try {
      const origin =
        req.get("origin") ||
        `${req.protocol}://${req.get("host")}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `${coins} moedas`,
              },
              unit_amount: price * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/success`,
        cancel_url: `${origin}/cancel`,
        metadata: {
          userId,
          coins: coins.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Erro Stripe:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 🔥 VITE / FRONTEND
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

  // 🔥 START FINAL (CORRETO PRA RAILWAY)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server rodando na porta ${PORT}`);
  });
}

startServer();

// Sinnoh Edition - Payment Routes with Stripe
import { Hono } from 'hono';
import { battlePassOps } from '../services/database.service.js';

const router = new Hono();

// Initialize Stripe with secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeConfigured = Boolean(
  stripeSecretKey &&
    !stripeSecretKey.includes('your_stripe') &&
    stripeSecretKey !== 'sk_test_placeholder'
);
let stripe: any = null;

if (stripeConfigured) {
  // Dynamic import for Stripe
  const Stripe = (await import('stripe')).default;
  stripe = new Stripe(stripeSecretKey!, {
    apiVersion: '2023-10-16',
  });
} else {
  console.warn('Stripe not initialized - set STRIPE_SECRET_KEY in .env');
}

// Battle Pass configuration
const BATTLE_PASS_PRICE_USD = parseInt(process.env.BATTLE_PASS_PRICE_USD || '1000');
const BATTLE_PASS_NAME = 'Battle Pass — Dios Tarjeta de Crédito';
const BATTLE_PASS_DESCRIPTION = 'Por solo $1000 USD, desbloquea Pokémon shiny y acceso al Arceus canónicamente correcto. El espacio-tiempo no se rompe solo.';

// Create Stripe Checkout Session for Battle Pass
router.post('/create-battle-pass-checkout', async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe no esta configurado. Crea .env y define STRIPE_SECRET_KEY con una clave real sk_test_...' }, 500);
  }

  try {
    const origin = c.req.header('origin') || 'http://localhost:5173';
    const body = await c.req.json().catch(() => ({}));
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: BATTLE_PASS_NAME,
              description: BATTLE_PASS_DESCRIPTION,
            },
            unit_amount: BATTLE_PASS_PRICE_USD * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/battle-pass/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/battle-pass/cancel`,
      customer_email: body.email || undefined,
      metadata: {
        product: 'battle_pass',
        clerkUserId: body.userId || '',
      },
    });

    return c.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return c.json({ error: error.message || 'Failed to create checkout session' }, 500);
  }
});

// Verify checkout session (for success page)
router.get('/verify-battle-pass/:sessionId', async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const sessionId = c.req.param('sessionId');
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      const clerkUserId = session.metadata?.clerkUserId || '';
      if (clerkUserId) {
        battlePassOps.upsert.run(
          clerkUserId,
          session.customer_details?.email || '',
          session.id
        );
      }

      return c.json({
        success: true,
        battlePassUnlocked: true,
        customerEmail: session.customer_details?.email,
        clerkUserId,
      });
    }
    
    return c.json({
      success: false,
      battlePassUnlocked: false,
    });
  } catch (error: any) {
    console.error('Stripe verify error:', error);
    return c.json({ error: error.message || 'Failed to verify session' }, 500);
  }
});

router.get('/battle-pass-status/:userId', async (c) => {
  const userId = c.req.param('userId');
  const row = battlePassOps.findByUserId.get(userId) as any;

  return c.json({
    unlocked: Boolean(row),
    godModeActive: Boolean(row?.god_mode_active),
    purchasedAt: row?.purchased_at ? new Date(Number(row.purchased_at) * 1000).toISOString() : null,
  });
});

// Webhook for Stripe events (optional - for production)
router.post('/webhook', async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const body = await c.req.text();
    const sig = c.req.header('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return c.json({ error: 'Missing signature or webhook secret' }, 400);
    }

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        // Mark battle pass as purchased
        console.log('Battle Pass purchased:', event.data.object);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }

    return c.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return c.json({ error: error.message }, 400);
  }
});

export default router;

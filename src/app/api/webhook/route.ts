import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Verification failed', { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Full Webhook Body Received:", JSON.stringify(body, null, 2));

    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (message) {
      const phone = message.from;
      const name = value.contacts?.[0]?.profile?.name || "Customer";
      const phoneNumberId = value.metadata?.phone_number_id;

      // 1. Interactive Handling (Buttons & List)
      if (message.type === 'interactive') {
        const interactive = message.interactive;
        
        // --- Shopify COD Buttons ---
        if (interactive.type === 'button_reply') {
          const buttonId = interactive.button_reply.id;
          let replyText = "";
          if (buttonId === 'confirm_order') {
            replyText = `Dhanyavad ${name}! 🙏 Tamaro order confirm thai gayo che. Ame jaldi thi delivery chalu karishu.`;
          } else if (buttonId === 'cancel_order') {
            replyText = `Koi vandho nahi ${name}. Tamaro order cancel kari didho che. 😊`;
          }
          if (replyText && phoneNumberId) await sendWhatsAppMessage(phoneNumberId, phone, replyText);
        }

        // --- Premium Chatbot Menu (List) ---
        if (interactive.type === 'list_reply') {
          const listId = interactive.list_reply.id;
          
          if (listId === 'buy_ghee' && phoneNumberId) {
            // Send Premium Catalog
            await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "interactive",
                interactive: {
                  type: "product_list",
                  header: { type: "text", text: "Madhram Naturals - A2 Ghee" },
                  body: { text: "Amara shuddh A2 Gir Cow Ghee na packing select karo:" },
                  footer: { text: "Pure & Natural" },
                  action: {
                    catalog_id: "918726744480680",
                    sections: [{ title: "Our Ghee", product_items: [{ product_retailer_id: "GHEE_500ML" }, { product_retailer_id: "GHEE_1L" }, { product_retailer_id: "GHEE_2L" }, { product_retailer_id: "GHEE_3L" }, { product_retailer_id: "GHEE_4L" }, { product_retailer_id: "GHEE_5L" }] }]
                  }
                }
              }),
            });
          } else if (listId === 'support' && phoneNumberId) {
            await sendWhatsAppMessage(phoneNumberId, phone, `Namaste ${name}! 🙏\n\nHow can I help you? Tamari query ahiya lakho, amari team jaldi contact karshe.`);
          } else if (listId === 'order_status' && phoneNumberId) {
            await sendWhatsAppMessage(phoneNumberId, phone, `Tamaro Order Status janva mate tamaro Order ID (e.g. #1051) ahiya type karo.`);
          }
        }
        return NextResponse.json({ status: 'ok' });
      }

      // 2. Normal Text Message (Show Main Menu)
      if (message.type === 'text') {
        await prisma.customer.upsert({
          where: { phone: phone },
          update: { name: name },
          create: { phone: phone, name: name },
        });

        if (phoneNumberId) {
          // Send Interactive List Menu
          await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Madhram Naturals 🙏" },
                body: { text: `Namaste ${name}! Swagat che. Hu tamari kevi rite madat kari shaku?` },
                footer: { text: "Menu select karo" },
                action: {
                  button: "Explore Menu",
                  sections: [{
                    title: "Select Service",
                    rows: [
                      { id: "buy_ghee", title: "🛒 Buy A2 Ghee", description: "View our catalog" },
                      { id: "support", title: "📞 Support", description: "Product query" },
                      { id: "order_status", title: "🚚 Order Status", description: "Track order" }
                    ]
                  }]
                }
              }
            }),
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("Webhook Logic Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function sendWhatsAppMessage(phoneNumberId: string, to: string, text: string) {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } }),
    });
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
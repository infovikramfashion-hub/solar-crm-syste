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

      console.log(`Message Type: ${message.type}, From: ${phone}, Name: ${name}, ID: ${phoneNumberId}`);

      // 1. Interactive Button Reply Handle Karo (Shopify COD mate)
      if (message.type === 'interactive') {
        const buttonReply = message.interactive.button_reply;
        console.log("Button Clicked ID:", buttonReply.id);
        
        let replyText = "";
        if (buttonReply.id === 'confirm_order') {
          replyText = `Dhanyavad ${name}! 🙏 Tamaro order confirm thai gayo che. Ame jaldi thi delivery chalu karishu.`;
        } else if (buttonReply.id === 'cancel_order') {
          replyText = `Koi vandho nahi ${name}. Tamaro order cancel kari didho che. Jo biju kai joiye to amne janavjo. 😊`;
        }

        if (replyText && phoneNumberId) {
          await sendWhatsAppMessage(phoneNumberId, phone, replyText);
        }
        return NextResponse.json({ status: 'ok' });
      }

      // 2. Normal Message (Solar Inquiry ke Ghee inquiry mate)
      if (message.type === 'text') {
        // Database ma Save karo
        await prisma.customer.upsert({
          where: { phone: phone },
          update: { name: name },
          create: { phone: phone, name: name },
        });

        console.log(`Database Success: Saved customer ${phone}`);

        if (phoneNumberId) {
          const welcomeMsg = `Namaste ${name}! 🙏 Tamari inquiry amne mali gai che. Ame tamne jaldi call karishu.`;
          await sendWhatsAppMessage(phoneNumberId, phone, welcomeMsg);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("Webhook Logic Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// WhatsApp Message moklavva mate nu Debugging valu function
async function sendWhatsAppMessage(phoneNumberId: string, to: string, text: string) {
  console.log(`Attempting to send WhatsApp to: ${to} using ID: ${phoneNumberId}`);
  
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      }),
    });

    const result = await response.json();
    console.log("WhatsApp API Response Detail:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error("WhatsApp API Final Error Status:", response.status);
    } else {
      console.log("Message Sent Successfully!");
    }
  } catch (err) {
    console.error("Fetch Error in sendWhatsAppMessage:", err);
  }
}
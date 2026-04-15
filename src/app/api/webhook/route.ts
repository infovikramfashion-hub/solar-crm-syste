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
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (message) {
      const phone = message.from;
      const name = value.contacts?.[0]?.profile?.name || "Customer";
      const phoneNumberId = value.metadata?.phone_number_id; // Aa automatic madse Meta mathi

      // 1. Database ma Save karo
      await prisma.customer.upsert({
        where: { phone: phone },
        update: { name: name },
        create: { phone: phone, name: name },
      });

      console.log(`Saved customer: ${phone}`);

      // 2. WhatsApp Reply Moklo
      if (phoneNumberId) {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: `Namaste ${name}! Tamari solar inquiry amne mali gai che. Ame tamne jaldi call karishu. 🙏` },
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error("WhatsApp Send Error:", result);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
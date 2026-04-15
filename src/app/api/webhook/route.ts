import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify Token (Je tame .env ma nakhsho)
  if (mode && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Verification failed', { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const phone = message.from;
      const name = body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || "Customer";

      // Database ma Save karo
      await prisma.customer.upsert({
        where: { phone: phone },
        update: { name: name },
        create: { phone: phone, name: name },
      });

      console.log(`Saved customer: ${phone}`);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
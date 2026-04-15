import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Shopify mathi details kadho
    const customerName = body.customer?.first_name || "Customer";
    const phone = body.customer?.phone || body.billing_address?.phone;
    const orderNumber = body.name; // e.g. #1001
    const totalAmount = body.total_price;

    if (phone) {
      // Phone number format thik karo (Remove '+' if exists)
      const cleanPhone = phone.replace(/\D/g, '');

      // WhatsApp Reply moklo
      await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { 
            body: `Namaste ${customerName}! 🙏\n\nTamaro shuddh ghee no order (${orderNumber}) confirm thai gayo che. \nTotal Amount: ₹${totalAmount}\n\nAme jaldi thi packing kari ne tamne dispatch ni jan kariishu. Dhanyavad!` 
          },
        }),
      });
      
      console.log(`Shopify Order Notification Sent to: ${cleanPhone}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error("Shopify Webhook Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
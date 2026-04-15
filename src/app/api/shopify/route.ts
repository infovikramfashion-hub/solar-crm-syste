import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Shopify mathi data kadho
    const customerName = body.customer?.first_name || "Customer";
    const rawPhone = body.customer?.phone || body.billing_address?.phone || body.shipping_address?.phone;
    const orderNumber = body.name;
    const totalAmount = body.total_price;
    
    // 2. Check karo ke aa COD order che ke nahi
    const isCOD = body.gateway === "manual" || (body.payment_gateway_names && body.payment_gateway_names.includes("Cash on Delivery (COD)"));

    if (rawPhone) {
      // --- PHONE NUMBER CLEANING LOGIC ---
      // Badha non-numeric characters (+, spaces, dashes) kadhi nakho
      let cleanPhone = rawPhone.replace(/\D/g, '');

      // Jo number 0 thi sharu thato hoy (jem ke 09876...), to 0 kadhi nakho
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }

      // Jo number khali 10 akda no hoy (9876543210), to aagal 91 umero
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      }
      
      // Jo customer e 9191... umeriyu hoy (bhul thi), to ene 12 akda ma fix karo
      if (cleanPhone.length > 12 && cleanPhone.startsWith('9191')) {
        cleanPhone = cleanPhone.substring(2);
      }
      
      console.log(`Original: ${rawPhone} | Cleaned: ${cleanPhone}`);

      let whatsappPayload;

      if (isCOD) {
        // --- COD ORDER MATE BUTTONS VALO MESSAGE ---
        whatsappPayload = {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: `Namaste ${customerName}! 🙏\n\nTamaro Ghee no order (${orderNumber}) amne mali gayo che.\n\nTotal: ₹${totalAmount}\nPayment: Cash on Delivery (COD)\n\nSu tame aa order confirm karva mangsho?`
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "confirm_order", title: "✅ Confirm Order" }
                },
                {
                  type: "reply",
                  reply: { id: "cancel_order", title: "❌ Cancel Order" }
                }
              ]
            }
          }
        };
      } else {
        // --- PREPAID ORDER MATE SADHO MESSAGE ---
        whatsappPayload = {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { 
            body: `Namaste ${customerName}! 🙏\n\nTamaro order (${orderNumber}) confirm thai gayo che. \nAmount: ₹${totalAmount} (Paid Online)\n\nAme jaldi thi dispatch kariishu. Dhanyavad!` 
          }
        };
      }

      // 3. WhatsApp API ne Request moklo
      const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappPayload),
      });

      const resData = await res.json();
      console.log("WhatsApp API Response:", JSON.stringify(resData));
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("Shopify Webhook Error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
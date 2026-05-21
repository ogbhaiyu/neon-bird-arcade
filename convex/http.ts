import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/gumroad",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const contentType = request.headers.get("content-type") || "";
      let email = "";
      let saleId = "";

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const bodyText = await request.text();
        const params = new URLSearchParams(bodyText);
        email = params.get("email") || "";
        // Gumroad sends sale_id, but we'll accept id or license_key as fallback
        saleId = params.get("sale_id") || params.get("id") || "";
      } else {
        const body = await request.json();
        email = body.email || "";
        saleId = body.sale_id || body.id || "";
      }

      if (!email || !saleId) {
        return new Response("Missing email or sale_id", { status: 400 });
      }

      // Record ticket via mutation (give 3 plays per $5 purchase)
      await ctx.runMutation(api.tickets.createTicketFromWebhook, {
        email: email.trim().toLowerCase(),
        purchaseId: saleId,
        plays: 3,
      });

      return new Response("OK", { status: 200 });
    } catch (err) {
      const error = err as Error;
      console.error("Gumroad Webhook processing error:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }),
});

export default http;

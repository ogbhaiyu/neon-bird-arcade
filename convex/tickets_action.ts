import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

type VerifyResult = {
  success: boolean;
  message: string;
  ticketId: Id<"tickets">;
};

export const verifyAndRedeemLicense = action({
  args: {
    email: v.string(),
    licenseKey: v.string(),
    productId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VerifyResult> => {
    const email = args.email.trim().toLowerCase();
    const licenseKey = args.licenseKey.trim().toUpperCase();



    // 2. Resolve product ID (prioritize argument, then env variable)
    const productId = args.productId || process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_ID;
    if (!productId) {
      throw new Error("Gumroad Product ID is not configured.");
    }

    // 3. First verify without incrementing uses count
    const verifyUrl = "https://api.gumroad.com/v2/licenses/verify";
    
    const checkParams = new URLSearchParams();
    checkParams.append("product_id", productId);
    checkParams.append("license_key", licenseKey);
    checkParams.append("increment_uses_count", "false");

    let checkResponse;
    try {
      checkResponse = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: checkParams.toString(),
      });
    } catch (err) {
      console.error("Gumroad fetch error:", err);
      throw new Error("Failed to connect to Gumroad license verification server.");
    }

    if (!checkResponse.ok) {
      const errText = await checkResponse.text();
      console.error("Gumroad verification error status:", checkResponse.status, errText);
      let message = "Invalid license key or product configuration.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson && errJson.message) {
          message = errJson.message;
        }
      } catch (e) {}
      throw new Error(message);
    }

    const checkData = await checkResponse.json();
    if (!checkData.success) {
      throw new Error(checkData.message || "License key verification failed.");
    }

    const purchase = checkData.purchase;
    if (!purchase) {
      throw new Error("Gumroad verification returned no purchase details.");
    }

    // Verify email matches
    if (purchase.email.toLowerCase() !== email) {
      throw new Error(`This license key belongs to ${purchase.email}, not ${email}.`);
    }

    // Check for refund or chargeback
    if (purchase.refunded) {
      throw new Error("This license key cannot be used because the purchase was refunded.");
    }
    if (purchase.chargebacked) {
      throw new Error("This license key cannot be used due to a chargeback dispute.");
    }

    // 4. Increment uses count on Gumroad to claim the license
    const claimParams = new URLSearchParams();
    claimParams.append("product_id", productId);
    claimParams.append("license_key", licenseKey);
    claimParams.append("increment_uses_count", "true");

    let claimResponse;
    try {
      claimResponse = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: claimParams.toString(),
      });
    } catch (err) {
      console.error("Gumroad claim fetch error:", err);
      throw new Error("Gumroad verification failed during claim process.");
    }

    if (!claimResponse.ok) {
      const errText = await claimResponse.text();
      console.error("Gumroad claim error status:", claimResponse.status, errText);
      let message = "Failed to claim license key on Gumroad.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson && errJson.message) {
          message = errJson.message;
        }
      } catch (e) {}
      throw new Error(message);
    }

    const claimData = await claimResponse.json();
    if (!claimData.success) {
      throw new Error(claimData.message || "Failed to claim license key.");
    }

    // 5. Call mutation to store in database
    const ticketId: Id<"tickets"> = await ctx.runMutation(api.tickets.createTicketFromLicense, {
      email,
      purchaseId: purchase.sale_id || purchase.id || "gumroad_purchase",
      licenseKey,
      plays: 3,
    });

    return { success: true, message: "License successfully verified and claimed!", ticketId };
  },
});

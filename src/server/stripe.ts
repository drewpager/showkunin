import Stripe from "stripe";
import "~/dotenv-config";

export const stripe = !!process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
    })
  : null;

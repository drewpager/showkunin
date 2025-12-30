import { useState } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid";
import Tooltip from "~/components/Tooltip";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { usePostHog } from "posthog-js/react";

export default function Pricing() {
  const [billedAnnually, setBilledAnnually] = useState<boolean>(true);
  const posthog = usePostHog();

  const toggleBillingCycle = () => {
    setBilledAnnually(!billedAnnually);
    posthog?.capture("change billing cycle");
  };

  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-custom-orange">Pricing</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-custom-black sm:text-5xl">
            Choose the plan that fits your needs.
          </p>
        </div>

        <div className="mt-16 flex justify-center">
          <div
            className="relative flex rounded-full border border-[#b0b0b0] bg-gray-200/70 cursor-pointer"
            onClick={toggleBillingCycle}
          >
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition focus:outline-none sm:w-auto ${!billedAnnually ? "bg-white" : ""
                }`}
            >
              Monthly
            </button>
            <button
              className={`ml-0.5 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition duration-150 focus:outline-none sm:w-auto ${billedAnnually ? "bg-white" : ""
                }`}
            >
              Annually
              <span className="ml-2 rounded-lg bg-custom-green/80 text-white px-1.5 py-0.5 text-xs font-normal">
                -33%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "Free",
              price: { monthly: "$0", annual: "$0" },
              features: [
                {
                  feature: "10 Tasks Automated",
                  description: "Automate up to 10 tasks for free.",
                  included: true,
                },
                {
                  feature: "Limited Data Retention",
                  description: "Recordings stored for 5 days. Resolutions stored until deleted.",
                  included: true,
                },
                {
                  feature: "Early Access to New Features",
                  description: "Aggressive product roadmap releasing for Pro subscriptions and above.",
                  included: false,
                },
              ],
            },
            {
              name: "Pro",
              price: { monthly: "$30", annual: "$20" },
              features: [
                {
                  feature: "100 Tasks Per Month",
                  description: "Automate and store up to 100 tasks per month.",
                  included: true,
                },
                {
                  feature: "Share Workflows",
                  description: "Share your workflows with team members or consultancy.",
                  included: true,
                },
                {
                  feature: "Early Access to New Features",
                  description: "Aggressive product roadmap releasing for Pro subscriptions and above.",
                  included: true,
                },
              ],
            },
            {
              name: "Enterprise",
              price: { monthly: "Custom", annual: "Custom" },
              isEnterprise: true,
              features: [
                {
                  feature: "Unlimited Tasks",
                  description: "No limits on how many tasks you can automate.",
                  included: true,
                },
                {
                  feature: "Custom Onboarding",
                  description: "Dedicated support to get your team up and running.",
                  included: true,
                },
                {
                  feature: "SSO & Security",
                  description: "Advanced security features for your organization.",
                  included: true,
                }
              ]
            }
          ].map(({ name, price, features, isEnterprise }) => (
            <div
              key={name}
              className={`relative flex flex-col rounded-3xl border bg-white p-8 shadow-sm transition-all hover:shadow-md ${name === "Pro" ? "ring-2 ring-custom-orange" : ""
                }`}
            >
              {name === "Pro" && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-custom-orange px-4 py-1 text-xs font-bold text-white">
                  Recommended
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-lg font-semibold leading-8 text-custom-black">{name}</h3>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-4xl font-bold tracking-tight text-custom-black">
                    {billedAnnually ? price.annual : price.monthly}
                  </span>
                  {price.monthly !== "Custom" && (
                    <span className="text-sm font-semibold leading-6 text-custom-dark">/mo</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-custom-dark">
                  {price.monthly === "Custom" ? "Contact us for custom pricing." : (billedAnnually ? "billed annually" : "billed monthly")}
                </p>
              </div>

              <ul className="flex-1 space-y-4 text-sm leading-6 text-custom-dark">
                {features.map(({ feature, description, included }) => (
                  <li key={feature} className="flex gap-x-3">
                    {included ? (
                      <CheckIcon className="h-6 w-5 flex-none text-custom-orange" aria-hidden="true" />
                    ) : (
                      <XMarkIcon className="h-6 w-5 flex-none text-gray-300" aria-hidden="true" />
                    )}
                    <Tooltip title={description}>
                      <span className="cursor-help border-b border-dashed border-gray-300 underline-offset-4">{feature}</span>
                    </Tooltip>
                  </li>
                ))}
              </ul>

              {isEnterprise ? (
                <Link
                  href="mailto:drew@greadings.com"
                  onClick={() => posthog?.capture("clicked contact enterprise plan")}
                  className="mt-8 block rounded-md bg-custom-black px-3 py-2 text-center text-sm font-semibold leading-6 text-white shadow-sm hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-custom-black"
                >
                  Contact sales
                </Link>
              ) : (
                <button
                  onClick={() => void signIn()}
                  className={`mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${name === "Pro"
                      ? "bg-custom-orange text-white hover:bg-opacity-90 focus-visible:outline-custom-orange"
                      : "bg-custom-black text-white hover:bg-opacity-90 focus-visible:outline-custom-black"
                    }`}
                >
                  {name === "Free" ? "Get started free" : "Get started"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

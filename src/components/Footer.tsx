import Link from "next/link";
import Image from "next/image";
import logo from "~/assets/logo.png";
import { useSession } from "next-auth/react";

export default function Footer() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto w-full max-w-[1048px] px-6 md:px-0">
      <footer className="flex flex-col justify-between py-12 md:flex-row md:gap-8">
        {/* Logo Section */}
        <div className="mb-8 md:mb-0">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={logo}
              alt="Greadings Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-custom-black">Greadings</span>
          </Link>
          <p className="mt-4 text-sm text-custom-dark">
            © {new Date().getFullYear()} Greadings, Inc.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
          {/* Resources Column */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-custom-black">Resources</h3>
            <div className="flex flex-col gap-3">
              <Link
                href="/examples"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Examples
              </Link>
              {session ? (
                <Link
                  href="/tasks"
                  className="text-sm text-custom-dark hover:text-custom-black"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="text-sm text-custom-dark hover:text-custom-black"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </div>
          {/* Solutions Column */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-custom-black">Solutions</h3>
            <div className="flex flex-col gap-3">
              <Link
                href="/solutions/vibe-automation"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Vibe Automation
              </Link>
              <Link
                href="/examples"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Examples
              </Link>
              <span className="cursor-default text-sm text-custom-dark opacity-50">
                Sales & Marketing
              </span>
              <span className="cursor-default text-sm text-custom-dark opacity-50">
                Operations & HR
              </span>
              <span className="cursor-default text-sm text-custom-dark opacity-50">
                Finance & Accounting
              </span>
            </div>
          </div>

          {/* Company Column */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-custom-black">Company</h3>
            <div className="flex flex-col gap-3">
              <Link
                href="/legal/privacy-policy"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/terms"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Terms and Conditions
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-custom-dark hover:text-custom-black"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import logo from "~/assets/logo.png";
import Image from "next/image";
import { useSession } from "next-auth/react";

const navigation = [
  { name: "Overview", href: "/" },
  { name: "Pricing", href: "/pricing" },
];

export default function Header() {
  const [attop, setAtTop] = useState(true);
  const [navbarOpen, setNavbarOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const closeNav = () => {
    setNavbarOpen(false);
  };
  useEffect(() => {
    document.addEventListener("scroll", () => {
      setAtTop(window.scrollY <= 1);
    });
  }, []);

  return (
    <div
      style={{ borderColor: attop ? "#5d594b" : "#5d594b" }}
      className="header sticky top-0 z-10 flex h-[64px] border-b bg-custom-white"
    >
      <div className="m-auto flex w-[1048px] items-center justify-between px-[24px]">
        <div className="flex flex-start items-center">
          <Link href="/" className="flex items-center">
            <Image
              className="cursor-pointer p-2"
              src={logo}
              alt="logo"
              width={42}
              height={42}
              unoptimized
            />
            <p className="text-xl font-bold text-custom-black">Greadings</p>
          </Link>
        </div>

        <div className="hidden md:block">
          {navigation.map(({ href, name }) => (
            <Link key={name} href={href}>
              <span
                className={`mx-[6px] cursor-pointer rounded-full p-2 text-sm text-custom-dark hover:text-custom-black ${router.asPath === href ? "bg-custom-black bg-opacity-10" : ""
                  }`}
              >
                {name}
              </span>
            </Link>
          ))}
        </div>

        {session ? (
          <Link
            href="/videos"
            className="hidden text-sm font-semibold leading-6 text-custom-black md:block"
          >
            Dashboard <span aria-hidden="true">&rarr;</span>
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="hidden text-sm font-semibold leading-6 text-custom-black md:block"
          >
            Log in <span aria-hidden="true">&rarr;</span>
          </Link>
        )}

        <div className="flex flex-row items-center md:hidden">
          {session ? (
            <Link
              href="/videos"
              className="text-sm font-semibold leading-6 text-custom-black"
            >
              Dashboard <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="text-sm font-semibold leading-6 text-custom-black"
            >
              Log in <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
          <div
            className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center"
            onClick={() => setNavbarOpen(!navbarOpen)}
          >
            <Bars3Icon className="h-6 w-6" />
          </div>
        </div>

        <div
          style={{
            transition: "all 0.2s cubic-bezier(.17,.27,0,.99)",
            height: navbarOpen ? "calc(100vh - 64px)" : "calc(100vh - 80px)",
            opacity: 0,
          }}
          className={`absolute left-0 right-0 bg-custom-white px-6 pt-6 opacity-0 ${navbarOpen
            ? "visible top-[64px] block !opacity-100"
            : "invisible top-[80px]"
            }`}
        >
          {navigation.map(({ href, name }) => (
            <Link key={name} href={href} onClick={closeNav}>
              <div className="flex h-[48px] cursor-pointer items-center border-b border-custom-dark border-opacity-30 text-[16px] hover:bg-custom-white hover:bg-opacity-50">
                {name}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { useState } from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import logo from "~/assets/logo.png";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";

// const navigation = [
//   { name: "Overview", href: "/" },
//   { name: "Pricing", href: "/pricing" },
// ];

const useCases = [
  { name: "Vibe Automation", href: "/solutions/vibe-automation" },
];

export default function Header() {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const closeNav = () => {
    setNavbarOpen(false);
  };

  return (
    <div
      className="header sticky top-0 z-10 flex h-[64px] border-b border-custom-border bg-custom-white/80 backdrop-blur-md"
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
            />
            <p className="text-xl font-bold text-custom-black">Greadings</p>
          </Link>
        </div>

        <div className="hidden md:ml-6 md:flex md:items-center md:space-x-1">
          <Link href="/">
            <span
              className={`mx-[6px] cursor-pointer rounded-full p-2 text-sm text-custom-dark hover:text-custom-black ${router.asPath === "/" ? "bg-custom-black bg-opacity-10" : ""
                }`}
            >
              Overview
            </span>
          </Link>

          <Link href="/pricing">
            <span
              className={`mx-[6px] cursor-pointer rounded-full p-2 text-sm text-custom-dark hover:text-custom-black ${router.asPath === "/pricing" ? "bg-custom-black bg-opacity-10" : ""
                }`}
            >
              Pricing
            </span>
          </Link>

          <Menu as="div" className="relative inline-block text-left">
            <div>
              <MenuButton className="inline-flex items-center mx-[6px] cursor-pointer rounded-full px-2 py-0 text-sm text-custom-dark hover:text-custom-black focus:outline-none">
                Use Cases
                <ChevronDownIcon className="ml-1 h-4 w-4" aria-hidden="true" />
              </MenuButton>
            </div>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <MenuItems className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                <div className="py-1">
                  {useCases.map((item) => (
                    <MenuItem key={item.name}>
                      {({ active }) => (
                        <Link
                          href={item.href}
                          className={`
                            block px-4 py-2 text-sm text-gray-700
                            ${active ? "bg-gray-100 text-gray-900" : ""}
                          `}
                        >
                          {item.name}
                        </Link>
                      )}
                    </MenuItem>
                  ))}
                </div>
              </MenuItems>
            </Transition>
          </Menu>
        </div>

        {session ? (
          <Link
            href="/tasks"
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
              href="/tasks"
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
          <Link href="/" onClick={closeNav}>
            <div className="flex h-[48px] cursor-pointer items-center border-b border-custom-dark border-opacity-30 text-[16px] hover:bg-custom-white hover:bg-opacity-50">
              Overview
            </div>
          </Link>
          <Link href="/pricing" onClick={closeNav}>
            <div className="flex h-[48px] cursor-pointer items-center border-b border-custom-dark border-opacity-30 text-[16px] hover:bg-custom-white hover:bg-opacity-50">
              Pricing
            </div>
          </Link>
          <div className="border-b border-custom-dark border-opacity-30 py-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-custom-dark">
              Use Cases
            </div>
            {useCases.map((item) => (
              <Link key={item.name} href={item.href} onClick={closeNav}>
                <div className="flex h-[40px] cursor-pointer items-center pl-4 text-[15px] hover:bg-custom-white hover:bg-opacity-50">
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

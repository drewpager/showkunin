import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import SignIn from "../src/pages/sign-in";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  getProviders: vi.fn(),
  signIn: vi.fn(),
}));

// Mock next/head
vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) =>
    React.createElement("img", { alt }),
}));

describe("SignIn Page", () => {
  const mockProviders = {
    google: {
      id: "google",
      name: "Google",
      type: "oauth",
      signinUrl: "/api/auth/signin/google",
      callbackUrl: "/api/auth/callback/google",
    },
    github: {
      id: "github",
      name: "GitHub",
      type: "oauth",
      signinUrl: "/api/auth/signin/github",
      callbackUrl: "/api/auth/callback/github",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Google and GitHub auth provider buttons", () => {
    render(React.createElement(SignIn, { providers: mockProviders as any }));

    expect(screen.getByText("Continue with Google")).toBeDefined();
    expect(screen.getByText("Continue with GitHub")).toBeDefined();
  });

  it("shows Confirm Password field when Sign up is clicked", async () => {
    render(React.createElement(SignIn, { providers: mockProviders as any }));

    // Initially, Confirm Password should not be visible
    expect(screen.queryByLabelText("Confirm Password")).toBeNull();

    // Click the "Sign up" link/button to switch to sign up mode
    const signUpButtons = screen.getAllByText("Sign up");
    fireEvent.click(signUpButtons[0]!);

    // Now Confirm Password should be visible
    expect(screen.getByLabelText("Confirm Password")).toBeDefined();
    expect(screen.getByText("Confirm Password")).toBeDefined();
  });
});

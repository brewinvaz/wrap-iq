import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("defaults to type=button", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("allows type=submit override", () => {
    render(<Button type="submit">Test</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-gradient-to-r");
    expect(btn.className).toContain("from-[var(--accent-primary)]");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border");
    expect(btn.className).toContain("text-[var(--text-secondary)]");
  });

  it("applies danger variant classes", () => {
    render(<Button variant="danger">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-[var(--danger-text)]");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toContain("border");
    expect(btn.className).toContain("text-[var(--text-secondary)]");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-3");
    expect(btn.className).toContain("text-xs");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-5");
  });

  it("applies icon size classes", () => {
    render(<Button size="icon">X</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("p-2");
  });

  it("merges custom className", () => {
    render(<Button className="mt-4">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("mt-4");
    expect(btn.className).toContain("bg-gradient-to-r");
  });

  it("passes through HTML attributes", () => {
    render(<Button data-testid="my-btn" aria-label="custom">Test</Button>);
    expect(screen.getByTestId("my-btn")).toBeInTheDocument();
    expect(screen.getByLabelText("custom")).toBeInTheDocument();
  });

  it("applies disabled styles", () => {
    render(<Button disabled>Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("disabled:opacity-50");
  });

  it("disables button and shows spinner when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).toBeInTheDocument();
    expect(btn.querySelector(".invisible")).toBeInTheDocument();
  });

  it("calls onClick handler", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Test</Button>);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

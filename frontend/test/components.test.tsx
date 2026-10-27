import { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "@/components/search-bar";
import { Pagination } from "@/components/pagination";
import { Modal } from "@/components/modal";

describe("SearchBar", () => {
  it("emits the last input after 300 ms and ignores callback identity changes", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const view = render(<SearchBar value="" onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pi" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pikachu" } });
    view.rerender(<SearchBar value="" onSearch={(q) => onSearch(q)} />);
    act(() => vi.advanceTimersByTime(299));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("pikachu");
  });

  it("cancels pending input when browser navigation changes the value", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const view = render(<SearchBar value="old" onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "draft" } });
    view.rerender(<SearchBar value="restored" onSearch={onSearch} />);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("searchbox")).toHaveValue("restored");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("cancels the debounce on unmount", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const view = render(<SearchBar value="" onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pikachu" } });
    view.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe("Pagination", () => {
  it.each([0, 1, 20])("hides controls for %i results", (total) => {
    render(<Pagination total={total} page={1} pageSize={20} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the page count and prevents navigation past either boundary", async () => {
    const onPageChange = vi.fn();
    const actor = userEvent.setup();
    const view = render(<Pagination total={41} page={1} pageSize={20} onPageChange={onPageChange} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await actor.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    view.rerender(<Pagination total={41} page={3} pageSize={20} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await actor.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });
});

function ModalExample() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} onClick={() => setOpen(true)}>Open details</button>
    <Modal open={open} onOpenChange={setOpen} title="Pokémon details" description="Read the selected Pokémon." finalFocus={trigger}>
      <p>Pikachu</p>
    </Modal>
  </>;
}

describe("Modal", () => {
  it("shows its accessible title, closes on Escape, and restores focus", async () => {
    const actor = userEvent.setup();
    render(<ModalExample />);
    const trigger = screen.getByRole("button", { name: "Open details" });
    await actor.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Pokémon details" })).toHaveAccessibleDescription("Read the selected Pokémon.");
    await actor.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on a backdrop click and with the close button", async () => {
    const actor = userEvent.setup();
    const { baseElement } = render(<ModalExample />);
    await actor.click(screen.getByRole("button", { name: "Open details" }));
    await screen.findByRole("dialog");
    await actor.click(baseElement.querySelector('[data-slot="dialog-overlay"]')!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await actor.click(screen.getByRole("button", { name: "Open details" }));
    await actor.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

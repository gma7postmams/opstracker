"use client";

import { useEffect, useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";

type MasterKind = "LOCATION" | "SHIFT" | "SHOW_GROUP" | "CATEGORY" | "ACTIVITY_TYPE";

interface Props {
  kind: MasterKind;
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  allowEmpty?: boolean;
  onChange: (value: string) => void;
  onCreated: (kind: MasterKind, value: string) => void;
}

export default function SearchableMasterField({
  kind,
  label,
  placeholder,
  options,
  value,
  allowEmpty = false,
  onChange,
  onCreated,
}: Props) {
  const id = useId();
  const [localOptions, setLocalOptions] = useState(options);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalOptions((current) => Array.from(new Set([...options, ...current])));
  }, [options]);

  const filtered = localOptions.filter((option) =>
    option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  const visibleOptions = [
    ...(allowEmpty && !query.trim() ? [{ label: "— none —", value: "" }] : []),
    ...filtered.map((option) => ({ label: option, value: option })),
  ];

  function choose(option: string) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  async function createValue() {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    setError("");
    let response: Response;
    try {
      response = await fetch("/api/masterdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value: trimmed }),
      });
    } catch {
      setError("Could not add value");
      return;
    }
    const result = await response.json();
    if (!response.ok) {
      setError(result.fields?.value ?? result.error ?? "Could not add value");
      return;
    }

    const createdValue = result.value as string;
    setLocalOptions((current) => Array.from(new Set([...current, createdValue])));
    onCreated(kind, createdValue);
    onChange(createdValue);
    setAdding(false);
    setNewValue("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && open && visibleOptions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp" && open && visibleOptions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + visibleOptions.length) % visibleOptions.length);
    } else if (event.key === "Enter" && open && visibleOptions.length) {
      event.preventDefault();
      choose(visibleOptions[activeIndex]?.value ?? visibleOptions[0].value);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <span className="master-field-control">
      <span className="master-combobox-row">
        <span className="master-combobox">
          <input
            role="combobox"
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-options`}
            aria-activedescendant={open && visibleOptions.length ? `${id}-option-${activeIndex}` : undefined}
            value={open ? query : value}
            placeholder={placeholder}
            onFocus={() => { setQuery(""); setOpen(true); setActiveIndex(0); }}
            onBlur={() => { setOpen(false); setQuery(""); }}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          {open && (
            <span className="master-combobox-options" id={`${id}-options`} role="listbox" aria-label={`${label} options`}>
              {visibleOptions.length ? visibleOptions.map((option, index) => (
                <span
                  key={option.value || "empty"}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={value === option.value}
                  className={index === activeIndex ? "master-combobox-option active" : "master-combobox-option"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                  {value === option.value && <Check size={14} aria-hidden="true" />}
                </span>
              )) : <span className="master-combobox-empty">No matching values</span>}
            </span>
          )}
        </span>
        <button
          type="button"
          className="master-add-toggle"
          aria-label={`Add ${label}`}
          title={`Add ${label}`}
          onClick={() => { setAdding((current) => !current); setError(""); }}
        >
          {adding ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
        </button>
      </span>
      {adding && (
        <span className="master-add-row">
          <input
            autoFocus
            aria-label={`New ${label}`}
            placeholder={`New ${label.toLocaleLowerCase()}`}
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createValue();
              }
            }}
          />
          <button type="button" className="secondary" disabled={!newValue.trim()} onClick={() => void createValue()}>Add</button>
        </span>
      )}
      {error && <span className="fielderr" role="alert">{error}</span>}
    </span>
  );
}
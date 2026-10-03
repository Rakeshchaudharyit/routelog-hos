import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Check, LoaderCircle, MapPin, Search } from "lucide-react";
import {
  searchLocations,
  type LocationSuggestion,
} from "../../services/locations";
import { isValidLocation, type LocationValue } from "../../types/location";
export function AddressAutocomplete({
  label,
  value,
  onChange,
  icon: Icon,
  index,
  showValidation,
  disabled,
}: {
  label: string;
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  icon: ComponentType<{ size?: number; className?: string }>;
  index: number;
  showValidation: boolean;
  disabled: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState(value?.address || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  function cancel() {
    version.current++;
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
  }
  useEffect(() => {
    if (value) setQuery(value.address);
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
      version.current++;
    },
    [],
  );
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (open && active >= 0)
      root.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  function search() {
    if (query.trim().length < 3 || disabled) return;
    cancel();
    onChange(null);
    const current = version.current;
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setLoading(true);
    setError("");
    setResults([]);
    setActive(-1);
    setSearched(false);
    // Public Nominatim forbids type-ahead requests. Debounce explicit Search/Enter actions only.
    timer.current = setTimeout(() => {
      void searchLocations(query, controller.signal)
        .then((items) => {
          if (current !== version.current) return;
          setResults(items);
          setSearched(true);
        })
        .catch((failure) => {
          if (current === version.current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Address search is unavailable.",
            );
        })
        .finally(() => {
          if (current === version.current) setLoading(false);
        });
    }, 350);
  }
  function select(item: LocationSuggestion) {
    cancel();
    onChange({ address: item.address, lat: item.lat, lng: item.lng });
    setQuery(item.address);
    setOpen(false);
    setLoading(false);
    setResults([]);
    input.current?.focus();
  }
  const selected = isValidLocation(value);
  const showHint = !selected && query.trim().length >= 3 && !loading;
  const dropdown =
    open &&
    !value &&
    query.trim().length >= 3 &&
    (loading || searched || Boolean(error));
  const invalid = showValidation && !isValidLocation(value);
  return (
    <div className="address-field" ref={root}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <Icon size={17} className={`location-icon location-${index}`} />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={dropdown}
          aria-controls={dropdown ? `${id}-list` : undefined}
          aria-activedescendant={
            dropdown && active >= 0 ? `${id}-option-${active}` : undefined
          }
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          disabled={disabled}
          autoComplete="off"
          value={query}
          placeholder={`Search ${label.toLowerCase()}...`}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            if (!root.current?.contains(e.relatedTarget as Node))
              setOpen(false);
          }}
          onChange={(e) => {
            cancel();
            onChange(null);
            setQuery(e.target.value);
            setOpen(true);
            setResults([]);
            setActive(-1);
            setLoading(false);
            setError("");
            setSearched(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancel();
              setOpen(false);
              setLoading(false);
              return;
            }
            if (["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              setOpen(true);
              if (results.length)
                setActive((n) =>
                  n < 0
                    ? e.key === "ArrowDown"
                      ? 0
                      : results.length - 1
                    : (n + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                      results.length,
                );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (dropdown && active >= 0 && results[active])
                select(results[active]);
              else search();
            }
          }}
        />
        <button
          type="button"
          className={`address-search-button${selected ? " selected" : ""}`}
          aria-label={`Search ${label.toLowerCase()}`}
          title={
            selected ? "Location selected · Search again" : "Search locations"
          }
          disabled={disabled || loading || query.trim().length < 3}
          onClick={search}
        >
          {loading ? (
            <LoaderCircle size={15} className="spin" />
          ) : selected ? (
            <Check size={15} />
          ) : (
            <Search size={15} />
          )}
        </button>
      </div>
      <div id={`${id}-hint`}>
        {showHint && (
          <p className="address-search-hint">Press Enter to search locations</p>
        )}
        {invalid && (
          <p className="address-error">
            Please select a location from the suggestions.
          </p>
        )}
      </div>
      {dropdown && (
        <div className="address-dropdown">
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={`${label} suggestions`}
          >
            {results.map((item, i) => {
              const split = item.address.indexOf(",");
              return (
                <li
                  key={`${item.address}-${item.lat}-${item.lng}`}
                  role="option"
                  id={`${id}-option-${i}`}
                  aria-selected={i === active}
                  className={i === active ? "highlighted" : ""}
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => select(item)}
                >
                  <MapPin size={16} />
                  <div>
                    <strong>
                      {split > 0 ? item.address.slice(0, split) : item.address}
                    </strong>
                    {split > 0 && (
                      <span>{item.address.slice(split + 1).trim()}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {loading ? (
            <p role="status">Searching locations...</p>
          ) : error ? (
            <p role="alert">
              {error}
              <button
                type="button"
                className="text-button search-retry"
                onClick={search}
              >
                Try again
              </button>
            </p>
          ) : searched && !results.length ? (
            <p role="status">
              No locations found. Try a city or a more specific address.
            </p>
          ) : !searched ? (
            <p>Press Enter or use Search to find locations.</p>
          ) : null}
          {results.length > 0 && (
            <div className="location-attribution">
              ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

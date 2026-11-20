import { useEffect, useState } from "react";
import { searchPlaces } from "../lib/api.js";
import useMediaQuery from "../hooks/useMediaQuery.js";
import { IconCalc, IconLocate } from "./Icons.jsx";

export default function LocationBar({ locating, onLocate, onPick, onCalc, calcOpen }) {
  const isDesktop = useMediaQuery("(min-width: 60rem)");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, controller.signal);
        setResults(found);
        setSearchError(found.length ? null : "Aucune commune trouvée.");
      } catch (err) {
        if (err.name !== "AbortError") {
          setResults([]);
          setSearchError("La recherche de ville est indisponible pour le moment.");
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (place) => {
    onPick(place);
    setQuery("");
    setResults([]);
    setSearchError(null);
  };

  return (
    <form
      className="where"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (results[0]) choose(results[0]);
      }}
    >
      <div className="where__field">
        <label className="sr-only" htmlFor="place-search">
          Ville ou code postal
        </label>
        <input
          id="place-search"
          className="where__input"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={isDesktop ? "Ville ou code postal" : "Ville ou CP"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(results.length > 0 || searchError) && (
          <ul className="where__results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" className="where__result" onClick={() => choose(r)}>
                  <span className="where__result-name">{r.label}</span>
                  <span className="where__result-detail">{r.detail}</span>
                </button>
              </li>
            ))}
            {searchError && <li className="where__note">{searchError}</li>}
          </ul>
        )}
      </div>
      <button type="button" className="where__locate" onClick={onLocate} disabled={locating}>
        <IconLocate />
        <span className="where__locate-text">{locating ? "Recherche…" : "Autour de moi"}</span>
      </button>
      <button
        type="button"
        className="where__iconbtn"
        onClick={onCalc}
        aria-expanded={calcOpen}
        aria-label="Calculateur de plein"
        title="Calculateur de plein"
      >
        <IconCalc />
      </button>
    </form>
  );
}

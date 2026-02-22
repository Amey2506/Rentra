import { useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import "./searchBar.scss";

const types = ["buy", "rent"];

function SearchBar() {
  const [query, setQuery] = useState({
    type: "buy",
    city: "",
    minPrice: "",
    maxPrice: "",
  });

  const switchType = (val) => {
    setQuery((prev) => ({ ...prev, type: val }));
  };

  const handleChange = (e) => {
    setQuery((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="searchBar">
      {/* === Buy / Rent Toggle === */}
      <div className="type">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className={query.type === type ? "active" : ""}
            onClick={() => switchType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* === Search Form === */}
      <form>
        <input
          type="text"
          name="city"
          placeholder="Enter city"
          value={query.city}
          onChange={handleChange}
        />

        <input
          type="number"
          name="minPrice"
          min={0}
          placeholder="Min Price"
          value={query.minPrice}
          onChange={handleChange}
        />

        <input
          type="number"
          name="maxPrice"
          min={0}
          placeholder="Max Price"
          value={query.maxPrice}
          onChange={handleChange}
        />

        <Link
          to={`/list?type=${query.type}&city=${query.city}&minPrice=${query.minPrice}&maxPrice=${query.maxPrice}`}
        >
          <button type="button" aria-label="Search properties">
            <FaSearch />
          </button>
        </Link>
      </form>
    </div>
  );
}

export default SearchBar;

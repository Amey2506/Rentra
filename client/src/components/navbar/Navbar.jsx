import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import "./navbar.scss";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentUser } = useContext(AuthContext);

  return (
    <nav className="navbar">
      {/* LEFT: Logo + Links */}
      <div className="nav-left">
        <Link to="/" className="logo">
          <img src="/logo.png" alt="Logo" />
          <span>Rentra</span>
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          {currentUser && <Link to="/chatbot">Legal Assistant</Link>}
        </div>
      </div>

      {/* RIGHT: Auth / User */}
      <div className="nav-right">
        {!currentUser ? (
          <>
            <Link to="/login" className="btn sign-in">Sign In</Link>
            <Link to="/register" className="btn sign-up">Sign Up</Link>
          </>
        ) : (
          <Link to="/profile" className="user">
            <img src={currentUser.avatar || "/noavatar.jpg"} alt="Avatar" />
            <span>{currentUser.username}</span>
          </Link>
        )}

        {/* Mobile Hamburger */}
        <div className="menu-icon" onClick={() => setMenuOpen(prev => !prev)}>
          <img src="/menu.png" alt="Menu" />
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu">
          <Link to="/">Home</Link>
          {currentUser && <Link to="/chatbot">Legal Assistant</Link>}
          {!currentUser && <Link to="/login">Sign In</Link>}
          {!currentUser && <Link to="/register">Sign Up</Link>}
          {currentUser && <Link to="/profile">Profile</Link>}
        </div>
      )}
    </nav>
  );
}

export default Navbar;

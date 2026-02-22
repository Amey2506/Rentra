import { Link } from "react-router-dom";
import "./card.scss";
import { FaBed, FaBath } from "react-icons/fa"; // Bedroom/Bathroom
import { MdLocationOn, MdDeleteForever } from "react-icons/md"; // Pin & Delete

function Card({ item, deleteAction }) {
  return (
    <div className="card">
      {/* Image */}
      <Link to={`/${item.id}`} className="imageContainer">
        <img src={item.images[0]} alt="" />
      </Link>

      {/* Text & Info */}
      <div className="textContainer">
        <h2 className="title">
          <Link to={`/${item.id}`}>{item.title}</Link>
        </h2>

        {/* Address */}
        <p className="address">
          <MdLocationOn className="icon-svg" />
          <span>{item.address}</span>
        </p>

        {/* Price */}
        <p className="price">₹{item.price}</p>

        {/* Bottom section: features + icons */}
        <div className="bottom">
          <div className="features">
            <div className="feature">
              <FaBed className="icon-svg" />
              <span>{item.bedroom} bedroom</span>
            </div>
            <div className="feature">
              <FaBath className="icon-svg" />
              <span>{item.bathroom} bathroom</span>
            </div>
          </div>

          {/* Delete button (if provided) */}
          <div className="icons">
            {deleteAction && (
              <div
                className="icon delete-icon"
                onClick={() => deleteAction(item.id)}
              >
                <MdDeleteForever className="icon-svg" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Card;

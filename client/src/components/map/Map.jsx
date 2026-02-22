import { MapContainer, TileLayer } from "react-leaflet";
import "./map.scss";
import "leaflet/dist/leaflet.css";
import Pin from "../pin/Pin";

// Constants
const DEFAULT_ZOOM = 7;
const CITY_ZOOM = 13; // Zoom level to clearly see properties in Mumbai

function Map({ items }) {
    
    // Find the first item with valid coordinates
    const firstValidItem = items.find(i => i.latitude && i.longitude);

    // FIX 1: Set the center to the first valid item, otherwise default to Mumbai
    const centerCoordinate = firstValidItem 
        ? [parseFloat(firstValidItem.latitude), parseFloat(firstValidItem.longitude)] 
        : [19.0760, 72.8777]; // Mumbai Fallback

    // FIX 2: If we have at least one valid item, zoom to city level
    const zoomLevel = firstValidItem ? CITY_ZOOM : DEFAULT_ZOOM;

    // Filter items to ensure we only render Pins for valid coordinates
    const pins = items.map((item) => {
        const lat = parseFloat(item.latitude);
        const lng = parseFloat(item.longitude);
        
        // Use database field names: latitude and longitude
        if (!isNaN(lat) && !isNaN(lng)) {
            return <Pin item={item} key={item.id} position={[lat, lng]} />;
        }
        return null;
    }).filter(p => p !== null);

    return (
        <MapContainer
            center={centerCoordinate} // Apply the calculated center
            zoom={zoomLevel} 
            scrollWheelZoom={false}
            className="map"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pins}
        </MapContainer>
    );
}

export default Map;
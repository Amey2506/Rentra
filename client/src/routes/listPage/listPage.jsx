import "./listPage.scss";
import Filter from "../../components/filter/Filter";
import Card from "../../components/card/Card";
import Map from "../../components/map/Map";
import { Await, useLoaderData } from "react-router-dom";
import { Suspense } from "react";

// --- NEW COORDINATE LOOKUP TABLE ---
const CITY_COORDINATES = {
    MUMBAI: [19.0760, 72.8777],
    DELHI: [28.6139, 77.2090], 
    BANGALORE: [12.9716, 77.5946],
    GOA: [15.2993, 74.1240], 
    INDIA: [20.5937, 78.9629]
};

function ListPage() {
    const data = useLoaderData();
    // Get the city query from the URL (e.g., "Delhi" from ?city=Delhi)
    const query = new URLSearchParams(window.location.search);
    const searchCity = query.get('city')?.toUpperCase();


    return (
        <div className="listPage">
            <div className="listContainer">
                <div className="wrapper">
                    <Filter />
                    <Suspense fallback={<p>Loading properties...</p>}>
                        <Await
                            resolve={data.postResponse}
                            errorElement={<p>Error loading posts!</p>}
                        >
                            {(postResponse) =>
                                postResponse.data.length > 0 ? (
                                    postResponse.data.map((post) => (
                                        <Card key={post.id} item={post} />
                                    ))
                                ) : (
                                    <p>No properties found for this city.</p>
                                )
                            }
                        </Await>
                    </Suspense>
                </div>
            </div>

            <div className="mapContainer">
                <Suspense fallback={<p>Loading map...</p>}>
                    <Await
                        resolve={data.postResponse}
                        errorElement={<p>Error loading map!</p>}
                    >
                        {(postResponse) => {
                            const items = postResponse.data;
                            
                            // 1. Find the first valid item
                            const firstValidItem = items.find(i => i.latitude && i.longitude);
                            
                            // 2. Determine the center: 
                            let mapCenter;
                            if (firstValidItem) {
                                // Fallback 1: Center on the first item found
                                mapCenter = [parseFloat(firstValidItem.latitude), parseFloat(firstValidItem.longitude)];
                            } else if (searchCity && CITY_COORDINATES[searchCity]) {
                                // Fallback 2: Center on the searched city's default coordinate
                                mapCenter = CITY_COORDINATES[searchCity];
                            } else {
                                // Final Fallback: Center of India
                                mapCenter = CITY_COORDINATES.INDIA;
                            }


                            return (
                                <Map 
                                    items={items} 
                                    initialCenter={mapCenter} 
                                />
                            );
                        }}
                    </Await>
                </Suspense>
            </div>
        </div>
    );
}

export default ListPage;
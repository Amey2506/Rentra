import HomePage from "./routes/homePage/homePage";
// ----------------------------------------------------------------------
import { createBrowserRouter, RouterProvider, useParams } from "react-router-dom"; // <-- ADDED useParams
// ----------------------------------------------------------------------
import ListPage from "./routes/listPage/listPage";
import { Layout, RequireAuth } from "./routes/layout/layout";
import SinglePage from "./routes/singlePage/singlePage";
import ProfilePage from "./routes/profilePage/profilePage";
import Login from "./routes/login/login";
import Register from "./routes/register/register";
import ProfileUpdatePage from "./routes/profileUpdatePage/profileUpdatePage";
import NewPostPage from "./routes/newPostPage/newPostPage";
import ChatbotPage from "./routes/chatbotPage/chatbotPage";
// ----------------------------------------------------------------------
import ChatPage from "./routes/chatPage/ChatPage"; 
// ----------------------------------------------------------------------
import {
  listPageLoader,
  profilePageLoader,
  singlePageLoader,
} from "./lib/loaders";

// ----------------------------------------------------------------------
// FIX: New Wrapper Component to Force Remount (Key Prop)
// This component reads the dynamic ID and passes it as a key to ChatPage
const ChatPageWrapper = () => {
    const { id } = useParams();
    // Setting the key to the dynamic part of the URL forces React to destroy 
    // the old component instance and create a new one when the ID changes.
    return <ChatPage key={id} />; 
};
// ----------------------------------------------------------------------


function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        // Public Routes under the main layout
        { path: "/", element: <HomePage /> },
        { path: "/list", element: <ListPage />, loader: listPageLoader },
        // This matches post detail pages
        { path: "/:id", element: <SinglePage />, loader: singlePageLoader }, 
        { path: "/login", element: <Login /> },
        { path: "/register", element: <Register /> },
      ],
    },

    // ----------------------------------------------------------------------
    // FIX: ISOLATED CHAT ROUTE BLOCK
    // This dedicated block ensures React Router sees the navigation to /chat/:id 
    // as a distinct change, not a sub-route of the main layout, which helps 
    // the key prop work correctly.
    {
        path: "/chat/:id",
        element: <RequireAuth />, // Chat requires authentication
        children: [
            { 
                path: "", // This matches the exact path "/chat/:id"
                element: <ChatPageWrapper />, // Use the wrapper with the key prop
            },
        ],
    },
    // ----------------------------------------------------------------------
    
    {
      path: "/",
      element: <RequireAuth />,
      children: [
        // Other Authenticated Routes (Profile, Add Post, Chatbot)
        { path: "/profile", element: <ProfilePage />, loader: profilePageLoader },
        { path: "/profile/update", element: <ProfileUpdatePage /> },
        { path: "/add", element: <NewPostPage /> },
        { path: "/chatbot", element: <ChatbotPage /> },
        // The old chat route is now REMOVED from this array.
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
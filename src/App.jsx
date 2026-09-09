import * as Sentry from "@sentry/react";
import { Suspense } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PushNotificationBootstrap from "./components/PushNotificationBootstrap.jsx";
import AuthBootstrap from "./components/AuthBootstrap.jsx";
import VerifiedBadgeSync from "./components/VerifiedBadgeSync.jsx";
import ProfileCompletionReminder from "./components/ProfileCompletionReminder.jsx";
import JobseekerHiringProcessReminder from "./components/JobseekerHiringProcessReminder.jsx";
import FeatureTour from "./components/FeatureTour.jsx";
import PageLoader from "./components/PageLoader.jsx";
import AppRoutes from "./app/routes/AppRoutes.jsx";

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          Something went wrong. Please refresh the page or contact support.
        </div>
      }
    >
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Router>
          <AuthBootstrap>
            <VerifiedBadgeSync />
            <PushNotificationBootstrap />
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
            <FeatureTour />
            <ProfileCompletionReminder />
            <JobseekerHiringProcessReminder />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </AuthBootstrap>
        </Router>
      </GoogleOAuthProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;

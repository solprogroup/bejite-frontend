import { Route } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import {
  PaymentPage,
  PaymentType,
  AddCard,
  PaymentProcessing,
  PaymentSuccess,
  ASEPricingPage,
  ASEPaymentCallback,
  ASESubscriptionDashboard,
  SubscriptionRetentionPage,
  SubscriptionCancelConfirmPage,
} from "../lazyPages.js";

export const paymentRoutes = (
  <>
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/payment-type" element={<PaymentType />} />
      <Route path="/add-card" element={<AddCard />} />
      <Route path="/payment-processing" element={<PaymentProcessing />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route
        path="/subscription-pricing"
        element={
          <ProtectedRoute redirectMessage="Please log in to view subscription plans.">
            <ASEPricingPage />
          </ProtectedRoute>
        }
      />
      <Route path="/ase/payment-callback" element={<ASEPaymentCallback />} />
      <Route path="/ase/subscription-callback" element={<ASEPaymentCallback />} />
      <Route path="/ase/topup-callback" element={<ASEPaymentCallback />} />
      <Route
        path="/subscription-dashboard"
        element={
          <ProtectedRoute redirectMessage="Please log in to view your subscription dashboard.">
            <ASESubscriptionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription/cancel"
        element={
          <ProtectedRoute redirectMessage="Please log in to manage your subscription.">
            <SubscriptionRetentionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription/cancel-confirm"
        element={
          <ProtectedRoute redirectMessage="Please log in to manage your subscription.">
            <SubscriptionCancelConfirmPage />
          </ProtectedRoute>
        }
      />
  </>
);

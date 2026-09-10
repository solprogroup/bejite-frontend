import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  Lock,
  Eye,
  EyeOff,
  LogOut,
  UserX,
  Bell,
  Globe,
  Smartphone,
  ChevronRight,
  Shield,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NewsFeedLayout from "../components/layout/NewsFeedLayout";
import {
  ChangeEmailModal,
  ChangePasswordModal,
  ConfirmModal,
  ProfileVisibilityModal,
  TwoFactorModal,
} from "../components/modal/confirmBadgeModal";
import { SettingRow } from "../components/SettingsRow";
import {
  getUser,
  mergeAuthUsers,
  pickProfilePhotoPath,
} from "../utils/tokenManager";
import {
  profileAvatarSrc,
  PROFILE_PHOTO_PLACEHOLDER,
} from "../utils/profilePhotoUrl";
import { formatDisplayPersonName } from "../utils/personDisplayName";
import DisplayNameWithBadge from "../components/DisplayNameWithBadge";
import useSyncProfilePhoto from "../hooks/useSyncProfilePhoto";
import useAuth from "../hooks/useAuth";
import {
  getNotificationPreferences,
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  updateNotificationPreferences,
} from "../services/pushNotificationService";
import { getTwoFactorStatus } from "../services/twoFactorApi";
import { getProfileVisibilitySetting } from "../services/profileVisibilityApi";

export default function AccountSettings() {
  useSyncProfilePhoto();
  const { logout } = useAuth();
  const reduxUser = useSelector((state) => state.auth?.user);

  const user = useMemo(() => {
    const localUser = getUser();
    return mergeAuthUsers(localUser || {}, reduxUser || localUser || {});
  }, [reduxUser]);

  const displayName = formatDisplayPersonName(user, "User");
  const email = user?.email?.trim() || "";
  const profilePhoto = profileAvatarSrc(
    pickProfilePhotoPath(user) || user?.image || user?.profilePhoto,
  );
  const showPhoto =
    profilePhoto && profilePhoto !== PROFILE_PHOTO_PLACEHOLDER;
  const nameInitial = (displayName || "U").charAt(0).toUpperCase();

  const [modal, setModal] = useState(null);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: true,
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState("Public");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPrefs = async () => {
      try {
        const prefs = await getNotificationPreferences();
        if (!cancelled) {
          setNotifications({
            email: prefs.email_enabled !== false,
            push: prefs.push_enabled !== false,
            sms: prefs.sms_enabled !== false,
          });
        }
      } catch (error) {
        console.warn("Failed to load notification preferences:", error?.message);
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    };

    loadPrefs();
    getProfileVisibilitySetting()
      .then((data) => {
        if (!cancelled && data?.label) setProfileVisibility(data.label);
      })
      .catch((error) => {
        console.warn(
          "Failed to load profile visibility:",
          error?.response?.data?.error || error?.message,
        );
      });
    getTwoFactorStatus()
      .then((data) => {
        if (!cancelled) setTwoFactorEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChannelToggle = async (channel) => {
    if (prefsLoading || channelLoading) return;

    const fieldMap = {
      email: "email_enabled",
      sms: "sms_enabled",
    };
    const field = fieldMap[channel];
    if (!field) return;

    const nextValue = !notifications[channel];
    setChannelLoading(channel);

    try {
      await updateNotificationPreferences({ [field]: nextValue });
      setNotifications((n) => ({ ...n, [channel]: nextValue }));
      showToast(
        `${channel === "email" ? "Email" : "SMS"} notifications ${nextValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      showToast(error?.message || "Could not update notification preference");
    } finally {
      setChannelLoading(null);
    }
  };

  const handlePushToggle = async () => {
    if (pushLoading || prefsLoading) return;

    const enabling = !notifications.push;
    setPushLoading(true);

    try {
      if (enabling) {
        if (!isPushSupported()) {
          showToast("Push notifications are not supported in this browser");
          return;
        }
        await subscribeToPushNotifications();
        setNotifications((n) => ({ ...n, push: true }));
        showToast("Push notifications enabled");
      } else {
        await unsubscribeFromPushNotifications();
        setNotifications((n) => ({ ...n, push: false }));
        showToast("Push notifications disabled");
      }
    } catch (error) {
      showToast(error?.message || "Could not update push notifications");
    } finally {
      setPushLoading(false);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleConfirmAction = (action) => {
    setModal(null);
    showToast(`${action} successful`);
  };

  const handleLogout = () => {
    setModal(null);
    logout();
  };

  const sections = [
    {
      title: "Security",
      rows: [
        {
          icon: Lock,
          iconBg: "bg-[#1A3E32]/10",
          label: "Change Password",
          sublabel: "Update your login password",
          onClick: () => setModal("password"),
        },
        // {
        //   icon: Mail,
        //   iconBg: "bg-blue-50",
        //   label: "Change Email",
        //   sublabel: "Your current email: abel@bejite.com",
        //   onClick: () => setModal("email"),
        // },
        {
          icon: Smartphone,
          iconBg: "bg-purple-50",
          label: "2FA Authentication",
          sublabel: twoFactorEnabled
            ? "Enabled — extra login protection is on"
            : "Add an extra layer of security to your account",
          onClick: () => setModal("2fa"),
        },
      ],
    },
    {
      title: "Notifications",
      rows: [
        {
          icon: Bell,
          iconBg: "bg-amber-50",
          label: "Email Notifications",
          sublabel: "All Bejite emails on or off",
          action: (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleChannelToggle("email");
              }}
              disabled={prefsLoading || channelLoading === "email"}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${notifications.email ? "bg-[#1A3E32]" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifications.email ? "left-6" : "left-1"}`}
              />
            </button>
          ),
        },
        {
          icon: Bell,
          iconBg: "bg-amber-50",
          label: "Push Notifications",
          sublabel: isPushSupported()
            ? "Browser alerts when connections post"
            : "Not supported in this browser",
          action: (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePushToggle();
              }}
              disabled={pushLoading || prefsLoading || !isPushSupported()}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${notifications.push ? "bg-[#1A3E32]" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifications.push ? "left-6" : "left-1"}`}
              />
            </button>
          ),
        },
        // {
        //   icon: Smartphone,
        //   iconBg: "bg-amber-50",
        //   label: "SMS Notifications",
        //   sublabel: "Get alerts on your phone",
        //   action: (
        //     <button
        //       onClick={(e) => {
        //         e.stopPropagation();
        //         handleChannelToggle("sms");
        //       }}
        //       disabled={prefsLoading || channelLoading === "sms"}
        //       className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${notifications.sms ? "bg-[#1A3E32]" : "bg-gray-200"}`}
        //     >
        //       <span
        //         className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifications.sms ? "left-6" : "left-1"}`}
        //       />
        //     </button>
        //   ),
        // },
      ],
    },
    {
      title: "Privacy",
      rows: [
        {
          icon: Globe,
          iconBg: "bg-sky-50",
          label: "Profile Visibility",
          sublabel: `Currently: ${profileVisibility}`,
          onClick: () => setModal("visibility"),
        },
      ],
    },
    {
      title: "Account",
      rows: [
        {
          icon: LogOut,
          iconBg: "bg-orange-50",
          label: "Log Out",
          sublabel: "Sign out of your account",
          onClick: () => setModal("logout"),
        },
        {
          icon: UserX,
          iconBg: "bg-red-50",
          label: "Deactivate Account",
          sublabel: "Temporarily hide your profile",
          danger: true,
          onClick: () => setModal("deactivate"),
        },
        {
          icon: AlertTriangle,
          iconBg: "bg-red-50",
          label: "Delete Account",
          sublabel: "Permanently remove your account & data",
          danger: true,
          onClick: () => setModal("delete"),
        },
      ],
    },
  ];

  return (
    <NewsFeedLayout classes={false} showSidebars={false}>
      <div className="h-full min-h-0 w-full max-w-screen-xl mx-auto flex flex-col">
        {/* Header */}
        <div className="bg-[#1A3E32] px-6 py-4 flex-shrink-0">
          <h1 className="text-white font-bold text-xl">Account Settings</h1>
          <p className="text-green-200 text-sm mt-0.5">
            Manage your account preferences
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto nfl-scroll scroll-smooth">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            {/* Profile preview */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
              {showPhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayName}
                  className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-[#1A3E32]/20"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PROFILE_PHOTO_PLACEHOLDER;
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1A3E32] to-[#2d6a54] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {nameInitial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base">
                  <DisplayNameWithBadge user={user} fallback={displayName} badgeSize="xs" />
                </p>
                <p className="text-sm text-gray-400 truncate">
                  {email || "No email on file"}
                </p>
              </div>
            </div>

            {/* Settings sections */}
            {sections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
                  {section.title}
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                  {section.rows.map((row, i) => (
                    <SettingRow key={i} {...row} />
                  ))}
                </div>
              </div>
            ))}

            <p className="text-center text-xs text-gray-300 pb-6">
              Bejite v2.6.0 · © 2026 Bejite Inc.
            </p>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-green-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal === "password" && (
          <ChangePasswordModal
            key="pw"
            onClose={() => setModal(null)}
            onUpdated={() => showToast("Password updated")}
          />
        )}
        {modal === "email" && (
          <ChangeEmailModal
            key="email"
            onClose={() => {
              setModal(null);
              showToast("Email updated successfully");
            }}
          />
        )}
        {modal === "2fa" && (
          <TwoFactorModal
            key="2fa"
            onClose={() => setModal(null)}
            onEnabled={() => {
              setTwoFactorEnabled(true);
              showToast("Two-factor authentication enabled");
            }}
            onDisabled={() => {
              setTwoFactorEnabled(false);
              showToast("Two-factor authentication disabled");
            }}
          />
        )}
        {modal === "visibility" && (
          <ProfileVisibilityModal
            key="visibility"
            currentVisibility={profileVisibility}
            onUpdate={(visibility) => {
              setProfileVisibility(visibility);
              showToast(`Profile visibility changed to ${visibility}`);
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "logout" && (
          <ConfirmModal
            key="logout"
            title="Log Out"
            description="Are you sure you want to log out of your Bejite account?"
            confirmLabel="Log Out"
            onClose={() => setModal(null)}
            onConfirm={handleLogout}
          />
        )}
        {modal === "deactivate" && (
          <ConfirmModal
            key="deactivate"
            title="Deactivate Account"
            description="Your profile will be hidden from other users. You can reactivate at any time by logging back in."
            confirmLabel="Deactivate"
            danger
            onClose={() => setModal(null)}
            onConfirm={() => handleConfirmAction("Account deactivated")}
          />
        )}
        {modal === "delete" && (
          <ConfirmModal
            key="delete"
            title="Delete Account"
            description="This action is permanent and cannot be undone. All your data, posts, and connections will be removed."
            confirmLabel="Delete Forever"
            danger
            onClose={() => setModal(null)}
            onConfirm={() => handleConfirmAction("Account deleted")}
          />
        )}
      </AnimatePresence>
    </NewsFeedLayout>
  );
}

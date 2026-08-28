import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const ProfileContext = createContext(null);

const DEFAULT_PROFILE = {
  userName: "You",
  userAbout: "",
  userPhoto: "",
  aiName: "OffyAI",
  aiAbout: "",
  aiPhoto: "",
  includeUserContext: false,
};

const isValidSettings = (settings) =>
  settings &&
  typeof settings === "object" &&
  !Array.isArray(settings);

export const useProfile = () => {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }

  return context;
};

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  const loadProfile = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && typeof window.electronAPI?.getSettings === "function") {
        const settings = await window.electronAPI.getSettings();
        if (isValidSettings(settings)) {
          setProfile({ ...DEFAULT_PROFILE, ...(settings.profile || {}) });
        }
      }
    } catch (error) {
      console.warn("Unable to load profile settings:", error);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const handleSettingsSaved = () => {
      loadProfile();
    };

    window.addEventListener("offyai-settings-saved", handleSettingsSaved);
    return () => window.removeEventListener("offyai-settings-saved", handleSettingsSaved);
  }, [loadProfile]);

  return (
    <ProfileContext.Provider value={{ profile, refreshProfile: loadProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export default ProfileContext;

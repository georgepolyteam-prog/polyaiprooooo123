import { useState, useEffect, useCallback } from "react";

interface Settings {
  notifications: boolean;
  autoRefresh: boolean;
}

const defaultSettings: Settings = {
  notifications: true,
  autoRefresh: true,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem("poly-settings");
    return stored ? JSON.parse(stored) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem("poly-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
};

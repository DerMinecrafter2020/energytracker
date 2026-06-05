import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchTranslations } from '../services/api';

const translations = {
  de: {
    home: 'Home',
    discover: 'Entdecken',
    history: 'Verlauf',
    profile: 'Profil',
    settings: 'Einstellungen',
    language: 'Sprache',
    theme: 'Erscheinungsbild',
    dailyLimit: 'TÃ¤gliches Koffein-Limit',
    whoRecommendation: 'WHO-Empfehlung: 400mg pro Tag',
    notifications: 'Benachrichtigungen',
    limitExceeded: 'Limit Ã¼berschritten',
    limitWarningDesc: 'Warnung wenn Koffein Limit erreicht wird',
    lateCaffeine: 'SpÃ¤tes Koffein',
    lateWarningDesc: 'Warnung nach 18:00 Uhr',
    rapidSequence: 'Schnelle Folge',
    rapidWarningDesc: 'Warnung bei 3+ GetrÃ¤nken in 2h',
    alsoDiscord: 'Auch per Discord senden',
    save: 'Speichern',
    saving: 'Speichern...',
    saved: 'Einstellungen gespeichert',
    saveError: 'Fehler beim Speichern',
    editProfile: 'Profil bearbeiten',
    name: 'Name',
    email: 'E-Mail',
    newPasswordOptional: 'Neues Passwort (optional)',
    newPasswordPlaceholder: 'Leer lassen um es nicht zu Ã¤ndern',
    currentPasswordReq: 'Aktuelles Passwort (erforderlich)',
    updateProfile: 'Profil aktualisieren',
    security: 'Sicherheit (2FA)',
    adminPanel: 'Admin',
    logout: 'Abmelden',
    connecting: 'Verbindeâ€¦',
    searchDrinkPlaceholder: 'GetrÃ¤nk suchen...',
    addDrink: 'HinzufÃ¼gen',
    customDrinksTitle: 'Eigene GetrÃ¤nke',
    todayCaffeine: 'Heute getrunken',
    remaining: 'Ãœbrig',
    cancel: 'Abbrechen',
    delete: 'LÃ¶schen',
    drinkHistory: 'Trinkverlauf',
    noDrinksToday: 'Noch keine GetrÃ¤nke heute eingetragen.',
    login: 'Anmelden',
    register: 'Registrieren',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢',
    loginButton: 'Einloggen',
    noAccount: 'Noch keinen Account?',
    registerHere: 'Hier registrieren',
    registerButton: 'Account erstellen',
    alreadyHaveAccount: 'Bereits einen Account?',
    loginHere: 'Hier anmelden',
    adminDashboard: 'Admin Dashboard',
    users: 'Benutzer',
    systemSettings: 'Systemeinstellungen',
    serverHost: 'Server-Host',
    port: 'Port',
    username: 'Benutzername',
    passwordToken: 'Passwort / App-Token',
    senderName: 'Absender-Name',
    senderEmail: 'Absender-E-Mail',
    appUrl: 'App-URL',
    saveSettings: 'Einstellungen speichern',
    manualEntry: 'Manueller Eintrag',
    presetDrinks: 'StandardgetrÃ¤nke',
    addCustomDrink: 'Neues GetrÃ¤nk erstellen',
    drinkName: 'GetrÃ¤nkename',
    sizeMl: 'GrÃ¶ÃŸe (ml)',
    caffeineMg: 'Koffein (mg)',
    stats: 'Statistiken',
    weeklyOverview: 'WochenÃ¼bersicht',
    dailyAverage: 'Tagesdurchschnitt',
    totalCaffeine: 'Gesamtes Koffein',
    reminders: 'Erinnerungen',
    notificationsEnabled: 'Benachrichtigungen aktiviert',
    remindAfterTime: 'Erinnere nach Zeit',
    scanBarcode: 'Barcode scannen',
    aiAssistant: 'KI-Assistent',
    searchOnline: 'Online suchen',
    demoLogin: 'Demo Login',
    back: 'ZurÃ¼ck',
    add: 'HinzufÃ¼gen',
    edit: 'Bearbeiten',
    success: 'Erfolgreich',
    error: 'Fehler',
    size: 'GrÃ¶ÃŸe',
    caffeine: 'Koffein',
    confirmPassword: 'Passwort bestÃ¤tigen',
    namePlaceholder: 'Max Mustermann',
    welcome: 'Willkommen!',
    welcomeBack: 'Willkommen zurÃ¼ck',
  },
  en: {
    home: 'Home',
    discover: 'Discover',
    history: 'History',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    theme: 'Appearance',
    dailyLimit: 'Daily Caffeine Limit',
    whoRecommendation: 'WHO recommendation: 400mg per day',
    notifications: 'Notifications',
    limitExceeded: 'Limit exceeded',
    limitWarningDesc: 'Warning when caffeine limit is reached',
    lateCaffeine: 'Late caffeine',
    lateWarningDesc: 'Warning after 6:00 PM',
    rapidSequence: 'Rapid sequence',
    rapidWarningDesc: 'Warning on 3+ drinks in 2h',
    alsoDiscord: 'Also send via Discord',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Settings saved',
    saveError: 'Error saving settings',
    editProfile: 'Edit Profile',
    name: 'Name',
    email: 'Email',
    newPasswordOptional: 'New password (optional)',
    newPasswordPlaceholder: 'Leave empty to keep current',
    currentPasswordReq: 'Current password (required)',
    updateProfile: 'Update Profile',
    security: 'Security (2FA)',
    adminPanel: 'Admin',
    logout: 'Logout',
    connecting: 'Connectingâ€¦',
    searchDrinkPlaceholder: 'Search drink...',
    addDrink: 'Add',
    customDrinksTitle: 'Custom Drinks',
    todayCaffeine: 'Consumed today',
    remaining: 'Remaining',
    cancel: 'Cancel',
    delete: 'Delete',
    drinkHistory: 'Drink History',
    noDrinksToday: 'No drinks logged today yet.',
    login: 'Login',
    register: 'Register',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢',
    loginButton: 'Sign In',
    noAccount: 'No account yet?',
    registerHere: 'Register here',
    registerButton: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    loginHere: 'Login here',
    adminDashboard: 'Admin Dashboard',
    users: 'Users',
    systemSettings: 'System Settings',
    serverHost: 'Server Host',
    port: 'Port',
    username: 'Username',
    passwordToken: 'Password / App Token',
    senderName: 'Sender Name',
    senderEmail: 'Sender Email',
    appUrl: 'App URL',
    saveSettings: 'Save Settings',
    manualEntry: 'Manual Entry',
    presetDrinks: 'Preset Drinks',
    addCustomDrink: 'Create New Drink',
    drinkName: 'Drink Name',
    sizeMl: 'Size (ml)',
    caffeineMg: 'Caffeine (mg)',
    stats: 'Statistics',
    weeklyOverview: 'Weekly Overview',
    dailyAverage: 'Daily Average',
    totalCaffeine: 'Total Caffeine',
    reminders: 'Reminders',
    notificationsEnabled: 'Notifications Enabled',
    remindAfterTime: 'Remind after time',
    scanBarcode: 'Scan Barcode',
    aiAssistant: 'AI Assistant',
    searchOnline: 'Search Online',
    demoLogin: 'Demo Login',
    back: 'Back',
    add: 'Add',
    edit: 'Edit',
    success: 'Success',
    error: 'Error',
    size: 'Size',
    caffeine: 'Caffeine',
    confirmPassword: 'Confirm Password',
    namePlaceholder: 'John Doe',
    welcome: 'Welcome!',
    welcomeBack: 'Welcome back',
  }
};

const LanguageContext = createContext({ language: 'de', customTranslations: null });

export const LanguageProvider = ({ language: initialLanguage, children }) => {
  const [language, setLanguage] = useState(initialLanguage || 'de');
  const [customTranslations, setCustomTranslations] = useState(null);

  useEffect(() => {
    fetchTranslations().then(data => {
      if(data && Object.keys(data).length > 0) setCustomTranslations(data);
    }).catch(err => console.error("Failed to load translations:", err));
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, customTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  // fallback if context is just a string (should not happen with new provider)
  const language = typeof context === 'string' ? context : (context.language || 'de');
  const customTranslations = typeof context === 'string' ? null : context.customTranslations;
  
  const t = (key) => {
    const customActive = customTranslations?.[language];
    const customDefault = customTranslations?.['de'];
    const hardcodedActive = translations[language];
    const hardcodedDefault = translations['de'];
    
    return customActive?.[key] || hardcodedActive?.[key] || customDefault?.[key] || hardcodedDefault?.[key] || key;
  };

  const setLanguage = typeof context === 'string' ? () => {} : context.setLanguage;
  return { t, language, setLanguage };
};



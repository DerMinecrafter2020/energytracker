import React, { createContext, useContext } from 'react';

const translations = {
  de: {
    home: 'Home',
    discover: 'Entdecken',
    history: 'Verlauf',
    profile: 'Profil',
    settings: 'Einstellungen',
    language: 'Sprache',
    theme: 'Erscheinungsbild',
    dailyLimit: 'Tägliches Koffein-Limit',
    whoRecommendation: 'WHO-Empfehlung: 400mg pro Tag',
    notifications: 'Benachrichtigungen',
    limitExceeded: 'Limit überschritten',
    limitWarningDesc: 'Warnung wenn Koffein Limit erreicht wird',
    lateCaffeine: 'Spätes Koffein',
    lateWarningDesc: 'Warnung nach 18:00 Uhr',
    rapidSequence: 'Schnelle Folge',
    rapidWarningDesc: 'Warnung bei 3+ Getränken in 2h',
    alsoDiscord: 'Auch per Discord senden',
    save: 'Speichern',
    saving: 'Speichern...',
    saved: 'Einstellungen gespeichert',
    saveError: 'Fehler beim Speichern',
    editProfile: 'Profil bearbeiten',
    name: 'Name',
    email: 'E-Mail',
    newPasswordOptional: 'Neues Passwort (optional)',
    newPasswordPlaceholder: 'Leer lassen um es nicht zu ändern',
    currentPasswordReq: 'Aktuelles Passwort (erforderlich)',
    updateProfile: 'Profil aktualisieren',
    security: 'Sicherheit (2FA)',
    adminPanel: 'Admin',
    logout: 'Abmelden',
    connecting: 'Verbinde…',
    searchDrinkPlaceholder: 'Getränk suchen...',
    addDrink: 'Hinzufügen',
    customDrinksTitle: 'Eigene Getränke',
    todayCaffeine: 'Heute getrunken',
    remaining: 'Übrig',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    drinkHistory: 'Trinkverlauf',
    noDrinksToday: 'Noch keine Getränke heute eingetragen.',
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
    connecting: 'Connecting…',
    searchDrinkPlaceholder: 'Search drink...',
    addDrink: 'Add',
    customDrinksTitle: 'Custom Drinks',
    todayCaffeine: 'Consumed today',
    remaining: 'Remaining',
    cancel: 'Cancel',
    delete: 'Delete',
    drinkHistory: 'Drink History',
    noDrinksToday: 'No drinks logged today yet.',
  }
};

const LanguageContext = createContext('de');

export const LanguageProvider = ({ language, children }) => {
  return (
    <LanguageContext.Provider value={language || 'de'}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const language = useContext(LanguageContext);
  
  const t = (key) => {
    return translations[language]?.[key] || translations['de'][key] || key;
  };

  return { t, language };
};

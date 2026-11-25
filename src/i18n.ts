import { useSyncExternalStore } from "react";
import { createInstance } from "i18next";

export const languages = [
  { id: "en", label: "English", locale: "en-IN" },
  { id: "ta", label: "தமிழ்", locale: "ta-IN" },
  { id: "ml", label: "മലയാളം", locale: "ml-IN" },
] as const;
type Language = (typeof languages)[number]["id"];
const storageKey = "locaiz-language";
const words: Record<string, [string, string]> = {
  Language: ["மொழி", "ഭാഷ"],
  Shop: ["கடை", "കട"],
  Nearby: ["அருகில்", "സമീപത്ത്"],
  "Global Atlas": ["உலக அட்லஸ்", "ആഗോള അറ്റ്ലസ്"],
  Together: ["கூட்டாக வாங்குதல்", "കൂട്ടായി വാങ്ങൽ"],
  Care: ["சேவைகள்", "സേവനങ്ങൾ"],
  Connect: ["தொடர்பு", "ബന്ധപ്പെടുക"],
  Business: ["வணிகம்", "ബിസിനസ്"],
  Account: ["கணக்கு", "അക്കൗണ്ട്"],
  Explore: ["ஆராய்க", "പര്യവേക്ഷണം"],
  Saved: ["சேமித்தவை", "സേവ് ചെയ്തവ"],
  Cart: ["வண்டி", "കാർട്ട്"],
  Messages: ["செய்திகள்", "സന്ദേശങ്ങൾ"],
  Notifications: ["அறிவிப்புகள்", "അറിയിപ്പുകൾ"],
  Orders: ["ஆர்டர்கள்", "ഓർഡറുകൾ"],
  Help: ["உதவி", "സഹായം"],
  "Help Centre": ["உதவி மையம்", "സഹായ കേന്ദ്രം"],
  Settings: ["அமைப்புகள்", "ക്രമീകരണങ്ങൾ"],
  "Seller Studio": ["விற்பனையாளர் ஸ்டுடியோ", "വിൽപ്പനക്കാരുടെ സ്റ്റുഡിയോ"],
  "Quote comparison": ["விலைமதிப்பீட்டு ஒப்பீடு", "വിലപ്പട്ടിക താരതമ്യം"],
  "Quotation comparison": ["விலைமதிப்பீட்டு ஒப்பீடு", "വിലപ്പട്ടിക താരതമ്യം"],
  "Compare products": ["பொருட்களை ஒப்பிடுக", "ഉൽപ്പന്നങ്ങൾ താരതമ്യം ചെയ്യുക"],
  "Check Nearby Stock": [
    "அருகிலுள்ள இருப்பைச் சரிபார்க்கவும்",
    "അടുത്തുള്ള സ്റ്റോക്ക് പരിശോധിക്കുക",
  ],
  "My Stock Requests": ["எனது இருப்புக் கோரிக்கைகள்", "എന്റെ സ്റ്റോക്ക് അഭ്യർത്ഥനകൾ"],
  "Stock Requests": ["இருப்புக் கோரிக்கைகள்", "സ്റ്റോക്ക് അഭ്യർത്ഥനകൾ"],
  "Stock notifications": ["இருப்பு அறிவிப்புகள்", "സ്റ്റോക്ക് അറിയിപ്പുകൾ"],
  "Buying options": ["வாங்கும் வழிகள்", "വാങ്ങാനുള്ള മാർഗങ്ങൾ"],
  "Find It Your Way": [
    "உங்களுக்கு ஏற்ற வழியில் தேடுங்கள்",
    "നിങ്ങൾക്ക് അനുയോജ്യമായ രീതിയിൽ കണ്ടെത്തുക",
  ],
  "Search the marketplace": ["சந்தையில் தேடுங்கள்", "മാർക്കറ്റ്‌പ്ലേസിൽ തിരയുക"],
  "Search marketplace": ["சந்தையில் தேடுங்கள்", "മാർക്കറ്റ്‌പ്ലേസിൽ തിരയുക"],
  "Search products, shops & services": [
    "பொருட்கள், கடைகள், சேவைகளைத் தேடுங்கள்",
    "ഉൽപ്പന്നങ്ങൾ, കടകൾ, സേവനങ്ങൾ തിരയുക",
  ],
  "Submit marketplace search": ["தேடலைத் தொடங்குக", "തിരയൽ ആരംഭിക്കുക"],
  "Marketplace search suggestions": ["தேடல் பரிந்துரைகள்", "തിരയൽ നിർദ്ദേശങ്ങൾ"],
  "Search products": ["பொருட்களைத் தேடுங்கள்", "ഉൽപ്പന്നങ്ങൾ തിരയുക"],
  "Search by product name": [
    "பொருளின் பெயரில் தேடுங்கள்",
    "ഉൽപ്പന്നത്തിന്റെ പേര് ഉപയോഗിച്ച് തിരയുക",
  ],
  "Search by image": ["படம் மூலம் தேடுங்கள்", "ചിത്രം ഉപയോഗിച്ച് തിരയുക"],
  "Post your requirement": [
    "உங்கள் தேவையைப் பதிவு செய்யுங்கள்",
    "നിങ്ങളുടെ ആവശ്യം പോസ്റ്റ് ചെയ്യുക",
  ],
  "Requirement title": ["தேவையின் தலைப்பு", "ആവശ്യത്തിന്റെ തലക്കെട്ട്"],
  "What are you looking for?": [
    "நீங்கள் எதைத் தேடுகிறீர்கள்?",
    "നിങ്ങൾ എന്താണ് തിരയുന്നത്?",
  ],
  "Back to requirements": ["தேவைகளுக்குத் திரும்புக", "ആവശ്യങ്ങളിലേക്ക് മടങ്ങുക"],
  "Set comparison details": [
    "ஒப்பீட்டு விவரங்களை அமைக்கவும்",
    "താരതമ്യ വിവരങ്ങൾ ക്രമീകരിക്കുക",
  ],
  "Requested quantity": ["கோரிய அளவு", "ആവശ്യപ്പെട്ട അളവ്"],
  "Delivery destination": ["விநியோக இடம்", "ഡെലിവറി ലക്ഷ്യസ്ഥാനം"],
  Budget: ["செலவுத்திட்டம்", "ബജറ്റ്"],
  "Your cart is empty.": ["உங்கள் வண்டி காலியாக உள்ளது.", "നിങ്ങളുടെ കാർട്ട് ശൂന്യമാണ്."],
  "Continue shopping": ["தொடர்ந்து வாங்குங்கள்", "ഷോപ്പിംഗ് തുടരുക"],
  Quantity: ["அளவு", "അളവ്"],
  Destination: ["சேரும் இடம்", "ലക്ഷ്യസ്ഥാനം"],
  Specifications: ["விவரக்குறிப்புகள்", "സവിശേഷതകൾ"],
  "Language preferences": ["மொழி விருப்பங்கள்", "ഭാഷാ മുൻഗണനകൾ"],
  "Skip to content": ["உள்ளடக்கத்திற்குச் செல்லுங்கள்", "ഉള്ളടക്കത്തിലേക്ക് പോകുക"],
  "Toggle marketplace menu": [
    "சந்தைப் பட்டியலைத் திறக்கவும் அல்லது மூடவும்",
    "മാർക്കറ്റ്‌പ്ലേസ് മെനു തുറക്കുക അല്ലെങ്കിൽ അടയ്ക്കുക",
  ],
  Marketplace: ["சந்தை", "മാർക്കറ്റ്‌പ്ലേസ്"],
  "Quick navigation": ["விரைவு வழிசெலுத்தல்", "ദ്രുത നാവിഗേഷൻ"],
  "Trending finds": ["பிரபலமான பொருட்கள்", "ജനപ്രിയ ഉൽപ്പന്നങ്ങൾ"],
  "Shop by category": ["வகை வாரியாக வாங்குங்கள்", "വിഭാഗം അനുസരിച്ച് വാങ്ങുക"],
  "View all products": ["அனைத்துப் பொருட்களையும் காண்க", "എല്ലാ ഉൽപ്പന്നങ്ങളും കാണുക"],
  "Explore marketplace": ["சந்தையை ஆராயுங்கள்", "മാർക്കറ്റ്‌പ്ലേസ് പര്യവേക്ഷണം ചെയ്യുക"],
  "Find it near.": ["அருகில் தேடுங்கள்.", "അടുത്ത് കണ്ടെത്തുക."],
  "Source it far.": ["தொலைவிலிருந்தும் வாங்குங்கள்.", "ദൂരത്തുനിന്നും വാങ്ങുക."],
  Category: ["வகை", "വിഭാഗം"],
  "All categories": ["அனைத்து வகைகள்", "എല്ലാ വിഭാഗങ്ങളും"],
  Sort: ["வரிசைப்படுத்து", "ക്രമീകരിക്കുക"],
  Filters: ["வடிப்பான்கள்", "ഫിൽട്ടറുകൾ"],
  "Clear filters": ["வடிப்பான்களை நீக்கு", "ഫിൽട്ടറുകൾ നീക്കുക"],
  "Maximum price (₹)": ["அதிகபட்ச விலை (₹)", "പരമാവധി വില (₹)"],
  Previous: ["முந்தையது", "മുമ്പത്തേത്"],
  Next: ["அடுத்தது", "അടുത്തത്"],
  "Add to Cart": ["வண்டியில் சேர்க்க", "കാർട്ടിലേക്ക് ചേർക്കുക"],
  "Quick view": ["விரைவுப் பார்வை", "ദ്രുത കാഴ്ച"],
  "My Buying Journey": ["எனது கொள்முதல் பயணம்", "എന്റെ വാങ്ങൽ യാത്ര"],
  "Send stock request": ["இருப்புக் கோரிக்கையை அனுப்பு", "സ്റ്റോക്ക് അഭ്യർത്ഥന അയയ്ക്കുക"],
  "Stock navigation": ["இருப்பு வழிசெலுத்தல்", "സ്റ്റോക്ക് നാവിഗേഷൻ"],
  "Orders and delivery": ["ஆர்டர்கள் மற்றும் விநியோகம்", "ഓർഡറുകളും ഡെലിവറിയും"],
  "Delivery and pickup": [
    "விநியோகம் மற்றும் நேரடி பெற்றுக்கொள்ளல்",
    "ഡെലിവറിയും പിക്കപ്പും",
  ],
};

const initial = () => {
  try {
    return (
      languages.find((item) => item.id === localStorage.getItem(storageKey))
        ?.id ?? "en"
    );
  } catch {
    return "en";
  }
};
const translator = createInstance();
void translator.init({
  lng: initial(),
  fallbackLng: "en",
  supportedLngs: languages.map((item) => item.id),
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: {} },
    ta: {
      translation: Object.fromEntries(
        Object.entries(words).map(([key, pair]) => [key, pair[0]]),
      ),
    },
    ml: {
      translation: Object.fromEntries(
        Object.entries(words).map(([key, pair]) => [key, pair[1]]),
      ),
    },
  },
});
const subscribe = (listener: () => void) => {
  translator.on("languageChanged", listener);
  return () => translator.off("languageChanged", listener);
};
const snapshot = () =>
  languages.find((item) => item.id === translator.language) ?? languages[0];
export function useLocale() {
  const language = useSyncExternalStore(
    subscribe,
    snapshot,
    () => languages[0],
  );
  return {
    language,
    t: (key: string) => translator.t(key, { defaultValue: key }),
  };
}
export function commerceLocale() {
  return snapshot().locale;
}
export function setLanguage(language: string) {
  const next = languages.find((item) => item.id === language);
  if (!next) return;
  try {
    localStorage.setItem(storageKey, next.id);
  } catch {
    /* Language applies to this tab. */
  }
  document.documentElement.lang = next.id;
  void translator.changeLanguage(next.id satisfies Language);
}
if (typeof document !== "undefined")
  document.documentElement.lang = snapshot().id;

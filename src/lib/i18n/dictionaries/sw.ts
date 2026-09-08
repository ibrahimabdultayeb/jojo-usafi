import type { Dictionary } from "./en";

/**
 * Kiswahili customer-facing copy.
 *
 * Agreed terminology:
 *   Cart      → Kikapu
 *   Checkout  → Kamilisha Agizo
 *   Order     → Agizo
 *
 * Catalogue content is NOT translated here. Product names, brand names, pack
 * sizes and category names come from the Product Master in English and fall
 * back to English on this side of the site. Translating them would mean
 * inventing catalogue data the master does not hold.
 */

export const sw: Dictionary = {
  meta: {
    siteTitle: "Jojo Usafi — Bidhaa za nyumbani, zinaletwa Dar",
    siteDescription:
      "Bidhaa za usafi na utunzaji wa mwili zinaletwa katika maeneo teule ya Dar es Salaam. Agiza mtandaoni, lipa zinapowasili.",
    shopTitle: "Bidhaa zote",
    shopDescription:
      "Vinjari kila bidhaa ya nyumbani ya Jojo Usafi, zinaletwa Dar es Salaam.",
    cartTitle: "Kikapu chako",
    checkoutTitle: "Kamilisha Agizo",
    trackTitle: "Fuatilia agizo lako",
    contactTitle: "Wasiliana nasi",
    contactDescription:
      "Wasiliana na timu ya Jojo Usafi kuhusu agizo, eneo la usafirishaji au bidhaa.",
    notFoundTitle: "Ukurasa haukupatikana",
  },

  nav: {
    home: "Mwanzo",
    shop: "Bidhaa Zote",
    track: "Fuatilia Agizo",
    contact: "Wasiliana",
  },

  header: {
    searchPlaceholder: "Tafuta bidhaa…",
    searchLabel: "Tafuta bidhaa",
    cart: "KIKAPU",
    openMenu: "Fungua menyu",
    closeMenu: "Funga menyu",
    homeLabel: "Mwanzo wa Jojo Usafi",
    menuTitle: "Menyu",
    shopByCategory: "Nunua kwa aina",
    chatWithSupport: "Ongea na huduma kwa wateja",
  },

  announcements: [
    "Tunafikisha katika maeneo teule ya Dar es Salaam",
    "Lipa ukipokea — lipa agizo lako linapowasili",
    "Agiza mtandaoni kwa dakika moja",
  ],

  hero: {
    badge: "Bidhaa za nyumbani, zinaletwa",
    titleTop: "Nyumba safi zaidi.",
    titleBottom: "Bila safari.",
    proofGenuine: "Bidhaa halisi",
    proofDelivered: "Zinaletwa Dar",
    proofPay: "Lipa unapopokea",
    body: "Kuanzia sabuni ya kuoga hadi dumu la lita 20 la sabuni, Jojo Usafi inaleta bidhaa za nyumbani mlangoni kwako katika {area}.",
    ctaShop: "Nunua bidhaa zote",
    ctaTrack: "Fuatilia agizo langu",
    scrollToShop: "Nenda kwenye bidhaa",
  },

  categories: {
    title: "Nunua kwa aina",
    viewAll: "Ona zote",
    productCount: "Bidhaa {count}",
  },

  home: {
    bestSellers: "Zinazouzwa zaidi",
    thisMonth: "Mwezi huu",
    shopAll: "Nunua zote",
    viewAll: "Ona zote",
    deliveryEyebrow: "Tunapofikisha",
    deliveryTitle: "Tunafikisha katika {area}.",
    deliveryBody:
      "Tuambie eneo lako unapokamilisha agizo, nasi tutathibitisha muda wa kufikisha kabla ya kuondoka. Huna uhakika kama tunafika kwako? Tuulize.",
    deliveryCta: "Angalia eneo langu",
  },

  trust: {
    title: "Kiwango cha Jojo Usafi.",
    subtitle: "Kwa nini nyumba za Dar es Salaam zinajaza tena nasi.",
    pillarPriceTitle: "Bei za haki",
    pillarPriceBody:
      "Tunanunua moja kwa moja kutoka kiwandani, hivyo unalipa bei ya duka bila nyongeza ya duka.",
    pillarSafeTitle: "Salama kwa familia",
    pillarSafeBody:
      "Zina nguvu dhidi ya uchafu, zimetengenezwa kwa matumizi ya kila siku nyumbani karibu na watoto na wanyama.",
    pillarHeavyTitle: "Tunabeba nzito",
    pillarHeavyBody:
      "Dumu la lita 20 si jambo la kupanda nalo daladala. Tunalileta mlangoni kwako badala yake.",
  },

  brands: {
    eyebrow: "Kwenye rafu zetu",
    title: "Chapa tunazouza.",
    body: "Kwa sasa tunauza bidhaa za EcoPlus, na tunaendelea kuongeza chapa kadri nyumba za Dar es Salaam zinavyoomba.",
  },

  how: {
    title: "Jinsi ya kuagiza.",
    subtitle: "Hakuna akaunti. Hakuna malipo ya awali. Zinaletwa katika {area}.",
    step: "Hatua {n}",
    step1Title: "Ongeza unachohitaji",
    step1Body:
      "Vinjari bidhaa, chagua ukubwa, kisha weka agizo mtandaoni. Huhitaji akaunti.",
    step2Title: "Tunathibitisha usafirishaji",
    step2Body:
      "Timu yetu inathibitisha agizo lako na muda wa kufikisha katika eneo lako Dar es Salaam.",
    step3Title: "Lipa linapowasili",
    step3Body:
      "Lipa ukipokea — lipa kwa fedha taslimu au kwa simu agizo lako likiwa mikononi mwako.",
    ctaStart: "Anza agizo",
    ctaAsk: "Uliza swali",
    note: "WhatsApp ipo kwa msaada — huhitaji kuitumia kuweka agizo.",
  },

  footer: {
    blurb:
      "Bidhaa za usafi wa nyumbani na utunzaji wa mwili, zinaletwa katika {area}. Agiza mtandaoni, lipa zinapowasili.",
    whatsappCta: "Ongea kwenye WhatsApp",
    shop: "Nunua",
    categories: "Aina",
    company: "Jojo Usafi",
    allProducts: "Bidhaa Zote",
    trackOrder: "Fuatilia Agizo Lako",
    contactUs: "Wasiliana Nasi",
    ordersAnytime: "Agiza mtandaoni, wakati wowote.",
    rights: "© {year} Jojo Usafi. Haki zote zimehifadhiwa.",
    pricesIn: "Bei ni kwa",
    delivering: "Tunafikisha katika {area}",
  },

  shop: {
    breadcrumbHome: "Mwanzo",
    breadcrumbShop: "Bidhaa",
    allProducts: "Bidhaa zote",
    allBlurb: "Kila bidhaa ya nyumbani tunayofikisha Dar es Salaam.",
    brandBlurb: "Kila ukubwa wa {brand} tunaouza.",
    filterAll: "Bidhaa zote",
    sortLabel: "Panga bidhaa",
    sortFeatured: "Maarufu kwanza",
    sortPriceAsc: "Bei: chini kwenda juu",
    sortPriceDesc: "Bei: juu kwenda chini",
    sortName: "Kialfabeti (A–Z)",
    countOne: "Bidhaa {count}",
    countMany: "Bidhaa {count}",
    matching: "zinazolingana na",
    emptyTitle: "Hakuna kitu hapa bado",
    emptyBody:
      "Hatukupata bidhaa kwa hilo. Jaribu utafutaji mwingine, au vinjari rafu nzima.",
    emptyCta: "Vinjari bidhaa zote",
  },

  product: {
    chooseSize: "Chagua ukubwa",
    itemCode: "Namba ya bidhaa",
    packSize: "Ukubwa",
    category: "Aina",
    suppliedBy: "Imeletwa na",
    goesWith: "Huenda pamoja na",
    viewAll: "Ona zote",
    addToCart: "Weka kikapuni",
    outOfStock: "Haipatikani",
    soldOut: "Imeisha",
    viewCart: "Ona kikapu",
    addAria: "Weka {name} kikapuni",
    increaseAria: "Ongeza idadi ya {name}",
    reduceAria: "Punguza idadi ya {name}",
    removeAria: "Ondoa {name} kikapuni",
    promiseDelivery: "Inafikishwa katika {area}",
    promisePay: "Lipa ukipokea — lipa inapowasili",
    promiseGenuine: "Bidhaa halisi, zimefungwa kutoka kiwandani",
    photoAlt: "{name}, {size}",
  },

  cart: {
    title: "Kikapu chako",
    subtitle:
      "Gharama ya usafirishaji inaongezwa unapokamilisha agizo, tukishajua eneo lako Dar es Salaam.",
    loading: "Inapakia kikapu chako",
    emptyTitle: "Kikapu chako ni kitupu",
    emptyBody: "Ongeza bidhaa chache nazo zitaonekana hapa.",
    startShopping: "Anza kununua",
    continueShopping: "Endelea kununua",
    subtotal: "Jumla ndogo",
    deliveryNote:
      "Gharama ya usafirishaji inahesabiwa unapokamilisha agizo, kulingana na eneo lako Dar es Salaam.",
    checkout: "Kamilisha Agizo",
    viewFullCart: "Ona kikapu kizima",
    payOnDelivery: "Lipa agizo lako linapowasili · {area}",
    closeCart: "Funga kikapu",
    itemsOne: "Bidhaa {count}",
    itemsMany: "Bidhaa {count}",
    viewCartWithCount: "Ona kikapu · {items}",
    orderSummary: "Muhtasari wa agizo",
    subtotalWithCount: "Jumla ndogo ({items})",
    deliveryRow: "Usafirishaji",
    deliveryCalculated: "Itahesabiwa unapokamilisha agizo",
    totalSoFar: "Jumla hadi sasa",
    each: "kila moja",
    payNoteFull: "Lipa ukipokea — lipa agizo lako linapokufikia, popote katika {area}.",
  },

  checkout: {
    breadcrumbCart: "Kikapu",
    breadcrumbCheckout: "Kamilisha Agizo",
    title: "Kamilisha Agizo",
    subtitle: "Tuambie tufikishe wapi. Unalipa agizo lako linapowasili.",
    yourDetails: "Taarifa zako",
    fullName: "Jina kamili",
    fullNamePlaceholder: "Jina lako",
    phone: "Namba ya simu",
    phonePlaceholder: "07XX XXX XXX",
    phoneHelp:
      "Tunapiga simu au kutuma ujumbe kwenye namba hii kuthibitisha usafirishaji wako.",
    delivery: "Usafirishaji",
    area: "Eneo Dar es Salaam",
    areaPlaceholder: "mf. Mikocheni, Mbezi Beach",
    directions: "Mtaa na maelekezo",
    directionsPlaceholder: "Mtaa, jengo, alama iliyo karibu nawe",
    placeOrder: "Weka agizo",
    notConnected:
      "Kukamilisha agizo bado hakujaunganishwa — huu ni muonekano wa awali. Hakuna agizo lililotengenezwa wala kitu kilichotumwa.",
    orderSummary: "Muhtasari wa agizo",
    emptyCart: "Kikapu chako ni kitupu.",
    addSomething: "Ongeza kitu kwanza",
    subtotal: "Jumla ndogo",
    deliveryRow: "Usafirishaji",
    deliveryValue: "Itathibitishwa na eneo lako",
    payNote:
      "Lipa ukipokea — lipa kwa fedha taslimu au kwa simu agizo lako linapokufikia katika {area}.",
  },

  track: {
    eyebrow: "Ufuatiliaji wa agizo",
    title: "Fuatilia agizo lako",
    subtitle: "Weka namba ya agizo na namba ya simu uliyotumia kuagiza.",
    orderNumber: "Namba ya agizo",
    orderNumberPlaceholder: "JU-10428",
    phone: "Namba ya simu",
    phonePlaceholder: "07XX XXX XXX",
    phoneHelp: "Namba ile ile uliyotumia ulipoweka agizo.",
    submit: "Fuatilia agizo",
    notConnected:
      "Ufuatiliaji wa agizo bado haujaunganishwa — huu ni muonekano wa awali. Maagizo yakianza, hali yako itaonekana hapa hapa.",
    stagesTitle: "Maana ya kila hatua",
    stage1: "Agizo limepokelewa",
    stage1Note: "Tumepokea agizo lako na eneo lako la usafirishaji.",
    stage2: "Linaandaliwa",
    stage2Note: "Bidhaa zako zinachukuliwa na kufungashwa.",
    stage3: "Linasafirishwa",
    stage3Note: "Linakuja kwako pamoja na muda wake wa kufika.",
    stage4: "Limefikishwa na kulipwa",
    stage4Note: "Lipa kwa fedha taslimu au kwa simu linapowasili.",
    helpText: "Huipati namba ya agizo lako? Timu yetu inaweza kukutafutia.",
    helpCta: "Uliza kwenye WhatsApp",
    backToShopping: "Rudi kununua",
  },

  contact: {
    title: "Ongea nasi",
    subtitle:
      "Maswali kuhusu bidhaa, eneo la usafirishaji au agizo lililo njiani — tupo {hours}.",
    whatsappTitle: "WhatsApp",
    whatsappBody: "Njia ya haraka zaidi kutufikia kuhusu agizo au eneo la usafirishaji.",
    whatsappCta: "Fungua WhatsApp",
    callTitle: "Tupigie simu",
    emailTitle: "Barua pepe",
    emailBody: "Kwa ankara, maagizo makubwa na chochote kinachohitaji kumbukumbu.",
    areaTitle: "Tunapofikisha",
    areaBody:
      "Jojo Usafi inafikisha katika {area}. Kama huna uhakika kama tunafika mtaani kwako, tutumie eneo lako nasi tutakuambia mara moja — na tutakujulisha tutakapofika.",
  },

  notFound: {
    title: "Ukurasa haukupatikana",
    body: "Ukurasa huo umehamishwa au haujawahi kuwepo. Lakini rafu bado ipo.",
    cta: "Vinjari bidhaa zote",
  },

  support: {
    ariaLabel: "Ongea na huduma kwa wateja ya Jojo Usafi kwenye WhatsApp",
    message: "Habari Jojo Usafi, ninahitaji msaada.",
    questionMessage: "Habari Jojo Usafi, nina swali.",
    orderHelpMessage: "Habari Jojo Usafi, ninahitaji msaada kuhusu agizo.",
    trackHelpMessage: "Habari Jojo Usafi, ninahitaji msaada kufuatilia agizo langu.",
  },

  language: {
    switchLabel: "Badilisha lugha",
    chooserTitle: "Chagua lugha yako",
    chooserBody: "Karibu Jojo Usafi. Chagua lugha unayotaka kununulia.",
    chooserNote: "Unaweza kubadilisha hii wakati wowote kwenye menyu.",
    continueEnglish: "Continue in English",
    continueSwahili: "Endelea kwa Kiswahili",
    current: "Lugha",
  },

  skipToContent: "Rukia kwenda kwenye maudhui",
};

/**
 * Product identity in one place. Change APP_NAME here and it changes
 * everywhere: page titles, the sidebar, the manifest, terms and privacy.
 */
export const APP_NAME = 'Kiln';

/** Domain used in metadata and legal copy. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'kiln.adityamer.dev';

export const APP_URL = `https://${APP_DOMAIN}`;

export const SUPPORT_EMAIL = `support@${APP_DOMAIN}`;

export const APP_TAGLINE = 'Chat that makes real things';

export const APP_DESCRIPTION =
    'Ask in plain language and get back working pages, documents, spreadsheets and slide decks, with live web search and your choice of model.';

// Default DOM selectors for de.aipass.net, kept isolated so they can be
// swapped without touching UI logic. If the site changes its markup, the
// content script also uses generic heuristics (see content.js) so the
// features degrade gracefully instead of breaking outright.
//
// A future server-driven update can overwrite window.__VARO_SELECTORS__ via
// chrome.storage (cached by the service worker) without a store re-review.

(function () {
  const DEFAULTS = {
    // Containers that hold a single LLM answer (for the inline action bar).
    answerBlock: [
      "[data-message-author-role='assistant']",
      ".assistant-message",
      ".message.assistant",
      ".markdown.prose",
      ".chat-message-ai"
    ],
    // Images rendered by AiPASS (for the hover overlay badge).
    contentImage: [
      "img[src*='aipass']",
      ".chat-message img",
      ".message img",
      "article img"
    ],
    // The native action toolbar under an AiPASS answer (Copy/Like/Dislike…)
    // — where the Varo icon gets embedded. Verified 2026-09-01.
    answerActions: [
      "div.flex.items-center.gap-1.flex-row",
      "[data-message-actions]",
      ".message-actions"
    ],
    // ChatGPT-specific selectors
    chatgpt: {
      // The action bar below each image answer
      answerActions: ['div[aria-label="Response actions"]'],
      // Container that wraps each agent turn (holds image + actions)
      turnContainer: ['div[data-conversation-screenshot-content]'],
      // Image container inside a turn
      imageContainer: ['div.group\/imagegen-image'],
    },
    // Gemini-specific selectors
    gemini: {
      // The action bar footer (thumb_up, thumb_down, refresh, share, more)
      answerActions: ['message-actions .buttons-container-v2'],
      // Container that wraps the full response (image + footer)
      responseContainer: ['div.response-container.response-container-with-gpi'],
      // The generated image element
      imageSelector: ['generated-image single-image img.image'],
    },
    // Pinterest-specific selectors
    pinterest: {
      // Closeup detail page action bar (React, Comments, Share, More)
      closeupActionBar: ['div[data-test-id="closeup-action-bar"]'],
      // Feed pin hover overlay
      feedHoverOverlay: ['div[data-test-id="pin-card-hover-overlay"]'],
      // Pin image element (both feed and closeup)
      imageSelector: ['img.iFOUS5'],
    },
    // The main chat scroll region (for observing new answers).
    chatRoot: ["main", "#__next", "#app", "body"]
  };

  // Merge any cached override provided by the service worker.
  try {
    chrome.storage?.local.get("varo_selectors_cache", (data) => {
      const override = data && data.varo_selectors_cache;
      window.__VARO_SELECTORS__ = Object.assign({}, DEFAULTS, override || {});
    });
  } catch {
    /* storage unavailable — use defaults */
  }

  window.__VARO_SELECTORS__ = window.__VARO_SELECTORS__ || DEFAULTS;
})();

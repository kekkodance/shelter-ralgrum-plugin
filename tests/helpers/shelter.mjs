import assert from "node:assert/strict";
import { Window } from "happy-dom";

// A same-document Shelter host, not a replacement for any plugin behavior.
// Settings rendering is out of scope; Solid templates still initialize normally.
export function createShelter(t, bundle, initialStore = {}) {
  const requests = [];
  const errors = [];
  const blockRequest = ({ request }) => {
    requests.push(request.url);
    throw new Error(`Unexpected network request: ${request.url}`);
  };
  const window = new Window({
    url: "https://discord.com/channels/@me",
    settings: {
      enableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      enableImageFileLoading: false,
      navigation: {
        disableMainFrameNavigation: true,
        disableChildFrameNavigation: true,
        disableChildPageNavigation: true,
        disableFallbackToSetURL: true,
      },
      fetch: {
        interceptor: {
          beforeAsyncRequest: blockRequest,
          beforeSyncRequest: blockRequest,
        },
      },
    },
  });
  const { document } = window;
  const store = { ...initialStore };
  const handoffs = [];
  const toasts = [];
  const sinkEvents = new WeakMap();
  const observations = new Set();
  let instance;
  let scope;
  let batches = 0;

  window.addEventListener("error", (event) => {
    errors.push(event.error ?? new Error(event.message));
    event.preventDefault();
  });

  // The final bubbling sink records the real navigation anchor, then cancels
  // only the browser's default action. Plugin capture listeners run first.
  window.addEventListener("click", (event) => {
    const anchor = event.target instanceof window.Element ? event.target.closest("a[href]") : null;
    sinkEvents.set(event, { defaultPrevented: event.defaultPrevented });
    if (anchor?.protocol === "ralgrum:" && !event.defaultPrevented) {
      handoffs.push(anchor.href);
    }
    event.preventDefault();
  });

  const isElement = (node) =>
    node instanceof window.HTMLElement || node instanceof window.SVGElement;
  const observer = new window.MutationObserver((records) => {
    // Fail a self-triggering observer deterministically rather than hanging the
    // runner in an infinite microtask chain. Normal batches remain unmodified.
    if (++batches > 100) {
      observer.disconnect();
      errors.push(new Error("DOM mutations failed to settle after 100 observer batches"));
      return;
    }
    const changed = new Set();
    for (const record of records) {
      if (isElement(record.target)) changed.add(record.target);
      for (const node of record.removedNodes) {
        if (isElement(node)) changed.add(node);
      }
    }
    // Shelter matches the record target and removed elements, plus descendants;
    // added descendants are visited through their changed parent.
    for (const node of changed) {
      for (const entry of observations) {
        if (node.matches(entry.selector)) entry.callback(node);
        node.querySelectorAll(entry.selector).forEach((child) => {
          if (!entry.cancelled && isElement(child)) entry.callback(child);
        });
      }
    }
  });

  function createScope() {
    const disposes = [];
    return {
      onDispose(callback) {
        disposes.push(callback);
      },
      disposeAllNow() {
        for (const dispose of disposes.splice(0)) {
          try {
            dispose();
          } catch (error) {
            errors.push(error);
          }
        }
      },
      observeDom(selector, callback) {
        if (observations.size === 0) {
          observer.observe(document.body, { subtree: true, childList: true, attributes: true });
        }
        const entry = { selector, callback, cancelled: false };
        observations.add(entry);
        const unobserve = () => {
          observations.delete(entry);
          if (observations.size === 0) observer.disconnect();
        };
        unobserve.now = () => {
          entry.cancelled = true;
          unobserve();
        };
        disposes.push(unobserve);
        return unobserve;
      },
      ui: {
        injectCss(css) {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.append(style);
          const dispose = () => style.remove();
          disposes.push(dispose);
          return dispose;
        },
      },
    };
  }

  function load() {
    assert.equal(scope, undefined, "Unload the previous plugin instance before loading again");
    scope = createScope();
    window.shelter = {
      plugin: { store, scoped: scope },
      ui: {
        ToastColors: { INFO: "info", SUCCESS: "success", WARNING: "warning", CRITICAL: "critical" },
        showToast(toast) {
          toasts.push(toast);
        },
      },
      util: { log() {} },
      solidWeb: {
        template(html, _isCE, isSVG) {
          const template = document.createElement("template");
          template.innerHTML = isSVG ? `<svg>${html}</svg>` : html;
          const node = isSVG ? template.content.firstChild.firstChild : template.content.firstChild;
          return () => node.cloneNode(true);
        },
      },
    };
    instance = window.eval(bundle);
    instance.onLoad();
  }

  function unload() {
    try {
      instance?.onUnload();
    } finally {
      instance = undefined;
      scope?.disposeAllNow();
      scope = undefined;
    }
  }

  async function flush() {
    batches = 0;
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(requests, [], "Clicks must never fetch or resolve links in the renderer");
    if (errors.length) throw new AggregateError(errors, "Shelter fixture encountered an error");
  }

  t.after(async () => {
    try {
      unload();
    } finally {
      observer.disconnect();
      observations.clear();
      await window.happyDOM.close();
    }
    assert.deepEqual(requests, [], "The fixture must not attempt network access");
    if (errors.length) throw new AggregateError(errors, "Shelter fixture encountered an error");
  });

  function link(href, { parent = document.body, title, text = "Open this link" } = {}) {
    const anchor = document.createElement("a");
    if (href !== null) anchor.setAttribute("href", href);
    if (title !== undefined) anchor.setAttribute("title", title);
    anchor.textContent = text;
    parent.append(anchor);
    return anchor;
  }

  function click(target, { prevented = false, ...init } = {}) {
    const event = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    });
    if (prevented) event.preventDefault();
    const start = handoffs.length;
    target.dispatchEvent(event);
    const sink = sinkEvents.get(event);
    return {
      defaultPrevented: sink ? sink.defaultPrevented : event.defaultPrevented,
      reachedSink: Boolean(sink),
      handoffs: handoffs.slice(start),
    };
  }

  return { window, document, store, toasts, link, click, load, unload, flush };
}

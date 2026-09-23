/**
 * FlowForge embed loader — drop onto any site (no extra CSS or markup required):
 *
 *   <script
 *     async
 *     src="https://your-host/flowforge/embed.js"
 *     data-flowforge-org="acme"
 *     data-flowforge-slug="support"
 *   ></script>
 *
 * Optional attributes on the script tag (or inline mount node):
 *   data-flowforge-org             organisation (instance) slug — required for scoped bots
 *   data-flowforge-slug            (required) public chatbot slug
 *   data-flowforge-env               production (default) or staging
 *   data-flowforge-base              override app base path (default inferred from script URL)
 *   data-flowforge-api               override API base (default: <app-base>/api)
 *   data-flowforge-title             iframe title (default "Chat")
 *   data-flowforge-position          bottom-right (default) or bottom-left
 *   data-flowforge-header-color      optional #rrggbb launcher colour
 *   data-flowforge-accent            optional #rrggbb accent / ping colour
 *   data-flowforge-logo              optional logo URL for the launcher
 *   data-flowforge-logo-icon         optional built-in icon id (when no logo URL)
 *
 * API: FlowForgeEmbed.open() | .close() | .toggle() | .reload()
 *
 * Inline embed (legacy — iframe rendered inside your own container):
 *   <div data-flowforge-org="acme" data-flowforge-slug="my-bot" data-flowforge-mode="inline" data-flowforge-height="560"></div>
 *   <script async src="https://your-host/flowforge/embed.js"></script>
 */
;(function () {
  var SOURCE = 'flowforge.embed'
  var STYLE_ID = 'flowforge-embed-styles'
  /** Bump when shipping embed/chat UI fixes so host pages pick up a fresh iframe document. */
  var EMBED_BUILD = '20260923-tables'
  var widgets = Object.create(null)

  function scriptBase() {
    var scripts = document.getElementsByTagName('script')
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || ''
      if (/embed\.js(\?|$)/i.test(src)) {
        return src.replace(/\/embed\.js(\?.*)?$/i, '')
      }
    }
    return ''
  }

  function widgetKey(opts) {
    var slug = (opts && opts.slug) || ''
    var org = (opts && opts.org) || ''
    if (!slug) return ''
    return org ? org + '/' + slug : slug
  }

  function readOpts(el) {
    return {
      org: (el.getAttribute('data-flowforge-org') || '').trim(),
      slug: (el.getAttribute('data-flowforge-slug') || '').trim(),
      base: (el.getAttribute('data-flowforge-base') || scriptBase() || '').replace(/\/$/, ''),
      api: (el.getAttribute('data-flowforge-api') || '').replace(/\/$/, ''),
      env: (el.getAttribute('data-flowforge-env') || 'production').trim().toLowerCase(),
      height: el.getAttribute('data-flowforge-height') || '480',
      width: el.getAttribute('data-flowforge-width') || '100%',
      title: el.getAttribute('data-flowforge-title') || 'Chat',
      panelTitle: el.getAttribute('data-flowforge-panel-title') || 'Chat',
      panelSubtitle: el.getAttribute('data-flowforge-panel-subtitle') || '',
      position: (el.getAttribute('data-flowforge-position') || 'bottom-right').trim().toLowerCase(),
      headerColor: (el.getAttribute('data-flowforge-header-color') || '').trim(),
      accentColor: (el.getAttribute('data-flowforge-accent') || '').trim(),
      logoUrl: (el.getAttribute('data-flowforge-logo') || '').trim(),
      logoIcon: (el.getAttribute('data-flowforge-logo-icon') || '').trim(),
    }
  }

  function apiBase(opts) {
    if (opts.api) return opts.api
    if (!opts.base) return ''
    return opts.base + '/api'
  }

  function normalizeHex(value) {
    var raw = String(value || '').trim()
    if (!raw) return ''
    if (raw.charAt(0) !== '#') raw = '#' + raw
    if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return ''
    return raw.toLowerCase()
  }

  function mixHex(hex, towardWhite, amount) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!m) return hex
    var n = parseInt(m[1], 16)
    var r = (n >> 16) & 255
    var g = (n >> 8) & 255
    var b = n & 255
    var t = towardWhite ? 255 : 0
    function ch(c) {
      return Math.min(255, Math.max(0, Math.round(c + (t - c) * amount)))
        .toString(16)
        .padStart(2, '0')
    }
    return '#' + ch(r) + ch(g) + ch(b)
  }

  function applyWidgetBranding(widget, branding) {
    if (!widget || !branding) return
    var prev = widget.branding || {}
    var header = normalizeHex(branding.headerColor || branding.header_color)
    var accent = normalizeHex(branding.accentColor || branding.accent_color) || header
    var hasLogoKey =
      Object.prototype.hasOwnProperty.call(branding, 'logoUrl') ||
      Object.prototype.hasOwnProperty.call(branding, 'logo_url') ||
      Object.prototype.hasOwnProperty.call(branding, 'logoIcon') ||
      Object.prototype.hasOwnProperty.call(branding, 'logo_icon')
    var logo = String(branding.logoUrl || branding.logo_url || '').trim()
    var logoIcon = String(branding.logoIcon || branding.logo_icon || '').trim()
    if (!header && !accent && !hasLogoKey) return
    if (logo) logoIcon = ''
    widget.branding = {
      headerColor: header || prev.headerColor || '',
      accentColor: accent || prev.accentColor || '',
      logoUrl: hasLogoKey ? logo : prev.logoUrl || '',
      logoIcon: hasLogoKey ? logoIcon : prev.logoIcon || '',
    }
    widget.launcher.innerHTML = launcherMarkup(
      widget.open,
      widget.branding.logoUrl,
      widget.branding.logoIcon,
    )
    paintLauncher(widget)
  }

  function fetchAppearance(opts, widget) {
    var base = apiBase(opts)
    if (!base || !opts.slug || typeof fetch !== 'function') return
    var qs = 'slug=' + encodeURIComponent(opts.slug)
    if (opts.org) qs += '&org=' + encodeURIComponent(opts.org)
    fetch(base + '/chat/appearance?' + qs, {
      method: 'GET',
      credentials: 'omit',
    })
      .then(function (res) {
        return res.ok ? res.json() : null
      })
      .then(function (data) {
        if (!data || !data.ok) return
        applyWidgetBranding(widget, data)
      })
      .catch(function () {})
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    var style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent =
      '.ff-embed-widget{position:fixed;z-index:2147483646;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.4;box-sizing:border-box}' +
      '.ff-embed-widget *,.ff-embed-widget *::before,.ff-embed-widget *::after{box-sizing:border-box}' +
      '.ff-embed-widget--br{bottom:1rem;right:1rem}' +
      '.ff-embed-widget--bl{bottom:1rem;left:1rem}' +
      '@media(min-width:640px){.ff-embed-widget--br{bottom:1.25rem;right:1.25rem}.ff-embed-widget--bl{bottom:1.25rem;left:1.25rem}}' +
      '.ff-embed-launcher{position:relative;display:grid;place-items:center;width:3.5rem;height:3.5rem;border:0;border-radius:1.35rem;color:#fff;cursor:pointer;background:linear-gradient(to bottom right,#14b8a6,#0891b2);box-shadow:0 16px 40px -12px rgba(15,23,42,.45);transition:transform .3s ease,box-shadow .3s ease,background .3s ease}' +
      '.ff-embed-launcher:hover{transform:scale(1.05)}' +
      '.ff-embed-launcher:active{transform:scale(.95)}' +
      '.ff-embed-launcher--open{background:#0f172a!important;box-shadow:0 16px 40px -12px rgba(15,23,42,.45)!important}' +
      '.ff-embed-launcher__shine{pointer-events:none;position:absolute;inset:0;border-radius:1.35rem;background:rgba(255,255,255,.1);opacity:0;transition:opacity .2s ease}' +
      '.ff-embed-launcher:hover .ff-embed-launcher__shine{opacity:1}' +
      '.ff-embed-launcher__glow{pointer-events:none;position:absolute;inset:-4px;border-radius:1.55rem;background:var(--ff-embed-glow,#2dd4bf);opacity:.4;filter:blur(8px);animation:ff-embed-pulse-soft 2.4s ease-in-out infinite}' +
      '.ff-embed-launcher--open .ff-embed-launcher__glow{opacity:0;animation:none}' +
      '.ff-embed-launcher svg,.ff-embed-launcher img.ff-embed-launcher__icon{position:relative;z-index:1;width:1.5rem;height:1.5rem;display:block}' +
      '.ff-embed-launcher svg.ff-embed-launcher__icon--sm{width:1.25rem;height:1.25rem}' +
      '@keyframes ff-embed-pulse-soft{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.7;transform:scale(1.05)}}' +
      '@keyframes ff-embed-ping{0%{transform:scale(1);opacity:.6}75%,100%{transform:scale(1.8);opacity:0}}' +
      '.ff-embed-panel{position:absolute;bottom:5.25rem;display:flex;flex-direction:column;width:min(100vw - 2rem,400px);height:min(640px,calc(100dvh - 6.5rem));min-height:480px;overflow:hidden;border:1px solid rgba(226,232,240,.85);border-radius:1rem;background:#fff;box-shadow:0 24px 48px -12px rgba(15,23,42,.22);opacity:0;transform:translateY(12px) scale(.95);pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(.34,1.56,.64,1)}' +
      '.ff-embed-widget--bl .ff-embed-panel{left:0;right:auto}' +
      '.ff-embed-widget--br .ff-embed-panel{right:0;left:auto}' +
      '@media(min-width:640px){.ff-embed-panel{bottom:5.5rem}}' +
      '.ff-embed-panel--open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}' +
      '.ff-embed-reload{position:absolute;top:.625rem;right:.625rem;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border:0;border-radius:.5rem;color:#64748b;background:rgba(255,255,255,.92);box-shadow:0 1px 3px rgba(15,23,42,.12);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease,background .15s ease,color .15s ease}' +
      '.ff-embed-reload:hover{background:#f1f5f9;color:#0f172a}' +
      '.ff-embed-reload svg{width:1rem;height:1rem;display:block}' +
      '.ff-embed-panel--open .ff-embed-reload{opacity:1;pointer-events:auto}' +
      '.ff-embed-panel__body{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;overflow:hidden;background:#fff;border-radius:1rem}' +
      '.ff-embed-mount{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;width:100%}' +
      '.ff-embed-panel__body iframe{display:block!important;border:0!important;width:100%!important;height:100%!important;min-height:100%!important;max-width:100%!important;border-radius:0!important;background:#fff;flex:1;min-height:0}' +
      '.ff-embed-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}'
    document.head.appendChild(style)
  }

  var ICON_CHAT =
    '<svg class="ff-embed-launcher__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>'
  var ICON_MINIMIZE =
    '<svg class="ff-embed-launcher__icon ff-embed-launcher__icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
  var ICON_RELOAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>'

  var LOGO_ICON_PATHS = {
    sparkles:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'messages-square':
      '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
    bot:
      '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    headset:
      '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
    'life-buoy':
      '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
    'help-circle':
      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    heart:
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    star:
      '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    zap:
      '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'user-round': '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    store:
      '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M10 22V12h4v10"/><path d="M15 7a3 3 0 1 0-6 0"/><path d="M2 7h20"/>',
    'shopping-bag':
      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'building-2':
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    leaf:
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    coffee:
      '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  }

  function logoIconMarkup(iconId) {
    var paths = LOGO_ICON_PATHS[String(iconId || '').trim()]
    if (!paths) return ICON_CHAT
    return (
      '<svg class="ff-embed-launcher__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    )
  }

  function launcherMarkup(open, logoUrl, logoIcon) {
    var shine = '<span class="ff-embed-launcher__shine" aria-hidden="true"></span>'
    var glow = '<span class="ff-embed-launcher__glow" aria-hidden="true"></span>'
    if (open) {
      return (
        shine +
        glow +
        '<span class="ff-embed-sr-only">Close chat</span>' +
        ICON_MINIMIZE
      )
    }
    var icon = ICON_CHAT
    if (logoUrl) {
      icon =
        '<img class="ff-embed-launcher__icon" src="' +
        String(logoUrl).replace(/"/g, '&quot;') +
        '" alt="" width="24" height="24" style="border-radius:9999px;object-fit:cover">'
    } else if (logoIcon) {
      icon = logoIconMarkup(logoIcon)
    }
    return shine + glow + '<span class="ff-embed-sr-only">Open chat</span>' + icon
  }

  function paintLauncher(widget) {
    if (!widget || !widget.launcher) return
    var b = widget.branding || {}
    var header = normalizeHex(b.headerColor) || '#14b8a6'
    var accent = normalizeHex(b.accentColor) || mixHex(header, true, 0.35)
    var header2 = mixHex(header, true, 0.22)
    widget.launcher.style.setProperty('--ff-embed-glow', accent)
    if (!widget.open) {
      widget.launcher.style.background =
        'linear-gradient(to bottom right,' + header + ',' + header2 + ')'
      widget.launcher.style.color = '#ffffff'
      widget.launcher.style.boxShadow = '0 16px 40px -12px rgba(15,23,42,.45)'
    } else {
      widget.launcher.style.background = '#0f172a'
      widget.launcher.style.color = '#ffffff'
      widget.launcher.style.boxShadow = '0 16px 40px -12px rgba(15,23,42,.45)'
    }
  }

  function embedIframeSrc(opts) {
    var params = []
    if (opts.env === 'staging') params.push('env=staging')
    params.push('eb=' + encodeURIComponent(EMBED_BUILD))
    params.push('_=' + String(Date.now()))
    var path = opts.org
      ? '/o/' + encodeURIComponent(opts.org) + '/embed/' + encodeURIComponent(opts.slug)
      : '/embed/' + encodeURIComponent(opts.slug)
    return opts.base + path + '?' + params.join('&')
  }

  function createIframe(opts) {
    var iframe = document.createElement('iframe')
    var key = widgetKey(opts)
    iframe.src = embedIframeSrc(opts)
    iframe.title = opts.title
    iframe.loading = 'lazy'
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.allow = 'clipboard-write'
    iframe.setAttribute('data-flowforge-iframe', key)
    return iframe
  }

  function applyInlineIframeStyle(iframe, opts) {
    var height = opts.height
    iframe.style.cssText =
      'display:block;border:0;width:' +
      opts.width +
      ';height:' +
      (String(height).match(/^\d+$/) ? height + 'px' : height) +
      ';max-width:100%;background:#fff;border-radius:16px;'
  }

  function applyWidgetIframeStyle(iframe) {
    iframe.style.cssText =
      'display:block;border:0;width:100%;height:100%;min-height:100%;max-width:100%;background:#fff;'
  }

  function handleResize(event, iframe) {
    var data = event.data
    if (!data || data.source !== SOURCE) return
    if (event.source !== iframe.contentWindow) return
    if (iframe.closest('.ff-embed-panel__body')) return
    if (data.type === 'resize' && typeof data.height === 'number' && data.height > 0) {
      iframe.style.height = Math.max(320, Math.ceil(data.height)) + 'px'
    }
  }

  function mountInline(el) {
    if (el.getAttribute('data-flowforge-mounted') === '1') return
    var opts = readOpts(el)
    if (!opts.slug) return

    var iframe = createIframe(opts)
    var inWidget = !!el.closest('.ff-embed-panel__body')
    if (inWidget) {
      el.className = 'ff-embed-mount'
      applyWidgetIframeStyle(iframe)
    } else {
      applyInlineIframeStyle(iframe, opts)
    }

    el.setAttribute('data-flowforge-mounted', '1')
    el.appendChild(iframe)
  }

  function setWidgetOpen(widget, open) {
    widget.open = open
    widget.panel.classList.toggle('ff-embed-panel--open', open)
    widget.panel.setAttribute('aria-hidden', open ? 'false' : 'true')
    widget.launcher.classList.toggle('ff-embed-launcher--open', open)
    widget.launcher.setAttribute('aria-expanded', open ? 'true' : 'false')
    widget.launcher.innerHTML = launcherMarkup(
      open,
      widget.branding && widget.branding.logoUrl,
      widget.branding && widget.branding.logoIcon,
    )
    paintLauncher(widget)

    if (open && !widget.loaded) {
      widget.loaded = true
      mountInline(widget.mount)
    }
  }

  function reloadWidget(widget) {
    if (!widget || !widget.loaded) return
    var iframe = widget.mount.querySelector('iframe')
    if (!iframe) return
    var opts = readOpts(widget.mount)
    var src = embedIframeSrc(opts)
    var bust = (src.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now()
    iframe.src = src + bust
  }

  function mountWidgetFromOpts(opts, sourceEl) {
    var key = widgetKey(opts)
    if (!opts.slug || !key || widgets[key]) return widgets[key]

    injectStyles()

    var posClass = opts.position === 'bottom-left' ? 'ff-embed-widget--bl' : 'ff-embed-widget--br'
    var root = document.createElement('div')
    root.className = 'ff-embed-widget ' + posClass
    root.setAttribute('data-flowforge-widget', key)

    var panel = document.createElement('div')
    panel.className = 'ff-embed-panel'
    panel.id = 'flowforge-panel-' + key.replace(/[^a-zA-Z0-9_-]/g, '-')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', opts.title || opts.panelTitle || 'Chat')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-hidden', 'true')

    var body = document.createElement('div')
    body.className = 'ff-embed-panel__body'

    var mount = document.createElement('div')
    mount.className = 'ff-embed-mount'
    if (opts.org) mount.setAttribute('data-flowforge-org', opts.org)
    mount.setAttribute('data-flowforge-slug', opts.slug)
    mount.setAttribute('data-flowforge-base', opts.base)
    mount.setAttribute('data-flowforge-env', opts.env)
    mount.setAttribute('data-flowforge-height', '100%')
    mount.setAttribute('data-flowforge-width', '100%')
    mount.setAttribute('data-flowforge-title', opts.title)

    body.appendChild(mount)
    panel.appendChild(body)

    var reloadBtn = document.createElement('button')
    reloadBtn.type = 'button'
    reloadBtn.className = 'ff-embed-reload'
    reloadBtn.setAttribute('aria-label', 'Restart chat')
    reloadBtn.title = 'Restart chat'
    reloadBtn.innerHTML = ICON_RELOAD
    panel.appendChild(reloadBtn)

    var launcher = document.createElement('button')
    launcher.type = 'button'
    launcher.className = 'ff-embed-launcher'
    launcher.setAttribute('aria-controls', panel.id)
    launcher.setAttribute('aria-expanded', 'false')
    launcher.innerHTML = launcherMarkup(false, opts.logoUrl, opts.logoIcon)

    root.appendChild(panel)
    root.appendChild(launcher)
    document.body.appendChild(root)

    var widget = {
      key: key,
      org: opts.org || '',
      slug: opts.slug,
      root: root,
      panel: panel,
      launcher: launcher,
      reloadBtn: reloadBtn,
      mount: mount,
      open: false,
      loaded: false,
      branding: {
        headerColor: opts.headerColor || '',
        accentColor: opts.accentColor || '',
        logoUrl: opts.logoUrl || '',
        logoIcon: opts.logoIcon || '',
      },
    }
    widgets[key] = widget
    paintLauncher(widget)
    fetchAppearance(opts, widget)

    launcher.addEventListener('click', function () {
      setWidgetOpen(widget, !widget.open)
    })
    reloadBtn.addEventListener('click', function (event) {
      event.stopPropagation()
      reloadWidget(widget)
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && widget.open) setWidgetOpen(widget, false)
    })

    if (sourceEl) sourceEl.setAttribute('data-flowforge-mounted', '1')
    return widget
  }

  function mountWidget(sourceEl) {
    return mountWidgetFromOpts(readOpts(sourceEl), sourceEl)
  }

  function initWidget(config) {
    if (!config || !config.slug) return null
    var opts = {
      org: String(config.org || '').trim(),
      slug: String(config.slug).trim(),
      base: (config.base || scriptBase() || '').replace(/\/$/, ''),
      api: (config.api || '').replace(/\/$/, ''),
      env: (config.env || 'production').trim().toLowerCase(),
      height: config.height || '480',
      width: config.width || '100%',
      title: config.title || 'Chat',
      panelTitle: config.panelTitle || 'Chat',
      panelSubtitle: config.panelSubtitle || '',
      position: (config.position || 'bottom-right').trim().toLowerCase(),
      headerColor: config.headerColor || '',
      accentColor: config.accentColor || '',
      logoUrl: config.logoUrl || '',
      logoIcon: config.logoIcon || '',
    }
    return mountWidgetFromOpts(opts, null)
  }

  function boot() {
    var current = document.currentScript
    if (current && current.getAttribute && current.getAttribute('data-flowforge-slug')) {
      mountWidget(current)
    }

    var scripts = document.querySelectorAll('script[src*="embed.js"][data-flowforge-slug]')
    for (var i = 0; i < scripts.length; i++) {
      mountWidget(scripts[i])
    }

    var nodes = document.querySelectorAll('[data-flowforge-slug]')
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j]
      if (el.tagName === 'SCRIPT') continue
      if (el.closest('.ff-embed-widget')) continue
      if (el.getAttribute('data-flowforge-mounted') === '1') continue

      var mode = (el.getAttribute('data-flowforge-mode') || '').trim().toLowerCase()
      if (mode === 'widget' || el.getAttribute('data-flowforge-widget') === '1') {
        mountWidget(el)
      } else if (mode === 'inline' || el.hasAttribute('data-flowforge-height')) {
        mountInline(el)
      }
    }
  }

  var tableDialog = null
  function openTableOverlay(event, data) {
    var frames = document.querySelectorAll('iframe[data-flowforge-iframe]')
    var trusted = false
    for (var i = 0; i < frames.length; i++) {
      if (event.source === frames[i].contentWindow && event.origin === new URL(frames[i].src).origin) trusted = true
    }
    if (!trusted) return
    var table = data.table
    if (!table || !Array.isArray(table.columns) || table.columns.length > 100 || !table.columns.every(function (c) { return typeof c === 'string' }) || !Array.isArray(table.rows) || table.rows.length > 1000 || !table.rows.every(function (r) { return Array.isArray(r) && r.length === table.columns.length && r.every(function (c) { return typeof c === 'string' }) }) || JSON.stringify(table).length > 1000000) return
    if (tableDialog) tableDialog.close()
    var previousFocus = document.activeElement
    var dialog = document.createElement('dialog')
    tableDialog = dialog
    dialog.setAttribute('aria-label', 'Expanded chatbot table')
    dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:min(1100px,94vw);max-height:88vh;box-sizing:border-box;padding:24px;border:1px solid #cbd5e1;border-radius:18px;background:#fff;color:#172033;box-shadow:0 24px 90px #0008;z-index:2147483647;font:14px system-ui;'
    var close = document.createElement('button')
    close.textContent = 'Close table'
    close.style.cssText = 'float:right;padding:10px 16px;border-radius:8px;background:#172033;color:#fff;border:0;cursor:pointer;margin-bottom:16px'
    close.onclick = function () { dialog.close() }
    dialog.appendChild(close)
    var heading = document.createElement('h2')
    heading.textContent = 'Table ? ' + table.rows.length + ' records'
    heading.style.cssText = 'font:600 18px system-ui;margin:8px 0 20px'
    dialog.appendChild(heading)
    var scroll = document.createElement('div')
    scroll.style.cssText = 'clear:both;overflow:auto;max-height:65vh'
    var grid = document.createElement('table')
    grid.style.cssText = 'width:100%;border-collapse:collapse;text-align:left;font:14px system-ui;color:#172033'
    var head = document.createElement('thead')
    var body = document.createElement('tbody')
    function addRow(values, parent, header) {
      var row = document.createElement('tr')
      values.forEach(function (value) {
        var cell = document.createElement(header ? 'th' : 'td')
        cell.textContent = value
        cell.style.cssText = 'padding:12px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;overflow-wrap:anywhere;max-width:320px;' + (header ? 'position:sticky;top:0;background:#f1f5f9;font-weight:600' : '')
        if (header) cell.scope = 'col'
        row.appendChild(cell)
      })
      parent.appendChild(row)
    }
    addRow(table.columns, head, true)
    table.rows.forEach(function (row) { addRow(row, body, false) })
    grid.appendChild(head); grid.appendChild(body); scroll.appendChild(grid); dialog.appendChild(scroll)
    dialog.addEventListener('close', function () {
      dialog.remove()
      if (tableDialog === dialog) tableDialog = null
      if (previousFocus && previousFocus.isConnected) previousFocus.focus()
    })
    document.body.appendChild(dialog)
    dialog.showModal()
    close.focus()
    event.source.postMessage({ source: SOURCE, type: 'table-opened', requestId: data.requestId }, event.origin)
  }

  window.addEventListener('message', function (event) {
    var data = event.data
    if (!data || data.source !== SOURCE) return
    if (data.type === 'table-open') { openTableOverlay(event, data); return }
    if (data.type === 'branding') {
      var widget = data.slug ? widgets[data.slug] : null
      if (!widget) {
        var keys = Object.keys(widgets)
        for (var k = 0; k < keys.length; k++) {
          var candidate = widgets[keys[k]]
          var iframe = candidate.mount && candidate.mount.querySelector('iframe')
          if (iframe && event.source === iframe.contentWindow) {
            widget = candidate
            break
          }
        }
      }
      if (widget) applyWidgetBranding(widget, data)
      return
    }
    if (data.type !== 'resize') return
    var iframes = document.querySelectorAll('iframe[data-flowforge-iframe]')
    for (var i = 0; i < iframes.length; i++) {
      if (event.source === iframes[i].contentWindow) {
        handleResize(event, iframes[i])
        break
      }
    }
  })

  function firstWidget() {
    var keys = Object.keys(widgets)
    return keys.length ? widgets[keys[0]] : null
  }

  function destroyWidget(key) {
    var keys = key ? [key] : Object.keys(widgets)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var widget = widgets[k]
      if (!widget) continue
      if (widget.root && widget.root.parentNode) widget.root.parentNode.removeChild(widget.root)
      delete widgets[k]
    }
  }

  function resolveWidget(key) {
    if (!key) return firstWidget()
    if (widgets[key]) return widgets[key]
    // Allow callers to pass bare slug when only one widget matches.
    var matches = []
    var all = Object.keys(widgets)
    for (var i = 0; i < all.length; i++) {
      var w = widgets[all[i]]
      if (w && (w.key === key || w.slug === key)) matches.push(w)
    }
    return matches.length === 1 ? matches[0] : null
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  window.FlowForgeEmbed = {
    init: initWidget,
    refresh: boot,
    mount: mountInline,
    destroy: destroyWidget,
    open: function (key) {
      var widget = resolveWidget(key)
      if (widget) setWidgetOpen(widget, true)
    },
    close: function (key) {
      var widget = resolveWidget(key)
      if (widget) setWidgetOpen(widget, false)
    },
    toggle: function (key) {
      var widget = resolveWidget(key)
      if (widget) setWidgetOpen(widget, !widget.open)
    },
    reload: function (key) {
      var widget = resolveWidget(key)
      reloadWidget(widget)
    },
  }
})()

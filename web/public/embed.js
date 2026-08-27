/**
 * FlowForge embed loader — drop onto any site:
 *
 *   <div data-flowforge-slug="my-bot"></div>
 *   <script async src="https://your-host/flowforge/embed.js"></script>
 *
 * Optional attributes on the mount node:
 *   data-flowforge-slug   (required) public chatbot slug
 *   data-flowforge-env    production (default) or staging
 *   data-flowforge-height initial iframe height (default 560)
 *   data-flowforge-width  iframe width (default 100%)
 *   data-flowforge-title  iframe title (default "Chat")
 *   data-flowforge-base   override app base path (default inferred from this script URL)
 */
;(function () {
  var SOURCE = 'flowforge.embed'

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

  function mountOne(el) {
    if (el.getAttribute('data-flowforge-mounted') === '1') return
    var slug = (el.getAttribute('data-flowforge-slug') || '').trim()
    if (!slug) return

    var base = (el.getAttribute('data-flowforge-base') || scriptBase() || '').replace(/\/$/, '')
    var height = el.getAttribute('data-flowforge-height') || '560'
    var width = el.getAttribute('data-flowforge-width') || '100%'
    var title = el.getAttribute('data-flowforge-title') || 'Chat'
    var env = (el.getAttribute('data-flowforge-env') || 'production').trim().toLowerCase()

    var iframe = document.createElement('iframe')
    iframe.src =
      base +
      '/embed/' +
      encodeURIComponent(slug) +
      (env === 'staging' ? '?env=staging' : '')
    iframe.title = title
    iframe.loading = 'lazy'
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.allow = 'clipboard-write'
    iframe.style.cssText =
      'display:block;border:0;width:' +
      width +
      ';height:' +
      (String(height).match(/^\d+$/) ? height + 'px' : height) +
      ';max-width:100%;background:#fff;border-radius:16px;'
    iframe.setAttribute('data-flowforge-iframe', slug)

    el.setAttribute('data-flowforge-mounted', '1')
    el.appendChild(iframe)

    window.addEventListener('message', function (event) {
      var data = event.data
      if (!data || data.source !== SOURCE) return
      if (event.source !== iframe.contentWindow) return
      if (data.type === 'resize' && typeof data.height === 'number' && data.height > 0) {
        iframe.style.height = Math.max(320, Math.ceil(data.height)) + 'px'
      }
    })
  }

  function boot() {
    var nodes = document.querySelectorAll('[data-flowforge-slug]')
    for (var i = 0; i < nodes.length; i++) mountOne(nodes[i])
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()

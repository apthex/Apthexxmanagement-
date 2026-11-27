(function () {
  'use strict';
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var storage = {
      get: function (type, key) {
        try {
          return (type === 'session' ? window.sessionStorage : window.localStorage).getItem(key);
        } catch (e) {
          return null;
        }
      },
      set: function (type, key, val) {
        try {
          (type === 'session' ? window.sessionStorage : window.localStorage).setItem(key, val);
        } catch (e) { }
      }
    };

    if (storage.get('local', 'apthex_ignore') === '1') return;
    if (/bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent)) return;

    function getUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }

    var VID_KEY = 'apthex_vid';
    var SID_KEY = 'apthex_sid';
    var vid = storage.get('local', VID_KEY);
    if (!vid) {
      vid = 'v_' + getUUID();
      storage.set('local', VID_KEY, vid);
    }

    var sid = storage.get('session', SID_KEY);
    if (!sid) {
      sid = 's_' + getUUID();
      storage.set('session', SID_KEY, sid);
    }

    var startTime = Date.now();
    var referrer = document.referrer || '';

    function getCurrentPage() {
      var p = window.location.pathname || '/';
      var h = window.location.hash || '';
      if (h && h.length > 1) {
        return (p === '/' ? '' : p) + h;
      }
      return p;
    }

    function send(data) {
      try {
        var payload = JSON.stringify(Object.assign({
          visit_id: sid,
          visitor_id: vid,
          page: (data && data.page) || getCurrentPage(),
          referrer: referrer
        }, data));

        var endpoint = 'https://apt-root.apthex.com/api/c';

        if (typeof fetch === 'function') {
          fetch(endpoint, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            keepalive: true
          }).catch(function () {
            if (navigator.sendBeacon) {
              var blob = new Blob([payload], { type: 'text/plain' });
              navigator.sendBeacon(endpoint, blob);
            }
          });
        } else if (navigator.sendBeacon) {
          var blob = new Blob([payload], { type: 'text/plain' });
          navigator.sendBeacon(endpoint, blob);
        }
      } catch (e) { }
    }

    // 1. Initial pageview beacon
    send({ type: 'pageview', page: getCurrentPage() });

    // 2. Track URL hash navigation (e.g. #services, #team)
    window.addEventListener('hashchange', function () {
      send({ type: 'pageview', page: getCurrentPage() });
    });

    // 3. Heartbeat to capture active time on page every 15s
    setInterval(function () {
      var duration = Math.round((Date.now() - startTime) / 1000);
      send({ type: 'heartbeat', duration: duration, page: getCurrentPage() });
    }, 15000);

    function onLeave() {
      var duration = Math.round((Date.now() - startTime) / 1000);
      send({ type: 'heartbeat', duration: duration, page: getCurrentPage() });
    }
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') onLeave();
    });
    window.addEventListener('beforeunload', onLeave);

    // 4. Section Observer to automatically register section dwell time
    if (typeof IntersectionObserver !== 'undefined') {
      var sections = document.querySelectorAll('section[id]');
      var activeSection = '';
      var timer = null;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
            var id = entry.target.id;
            if (id && id !== activeSection) {
              clearTimeout(timer);
              timer = setTimeout(function () {
                activeSection = id;
                var p = (window.location.pathname === '/' ? '' : window.location.pathname) + '/#' + id;
                send({ type: 'pageview', page: p });
              }, 1200);
            }
          }
        });
      }, { threshold: [0.45] });
      sections.forEach(function (sec) { observer.observe(sec); });
    }

    // 5. Track contact form submissions
    document.addEventListener('submit', function (e) {
      try {
        var target = e.target;
        if (target && (target.id === 'form' || target.classList.contains('modal__form') || target.closest('#form'))) {
          send({ type: 'contact_form_submit', page: getCurrentPage() });
        }
      } catch (err) { }
    }, true);

    // 6. Track apply button clicks
    document.addEventListener('click', function (e) {
      try {
        var link = e.target && e.target.closest ? e.target.closest('a.apply, [data-apply]') : null;
        if (link) {
          var article = link.closest('article');
          var role = article && article.querySelector('h2') ? article.querySelector('h2').textContent.trim() : '';
          send({ type: 'apply_click', role: role || 'Open Role', page: getCurrentPage() });
        }
      } catch (err) { }
    }, true);

    // 7. Track "Request security assessment" clicks
    document.addEventListener('click', function (e) {
      try {
        var target = e.target;
        var btn = target && target.closest ? target.closest('[data-open], button.pill__cta, a[href*="assessment"], .link--red') : null;
        if (btn) {
          var text = (btn.textContent || '').trim().toLowerCase();
          var isDataOpen = btn.hasAttribute('data-open');
          if (isDataOpen || text.indexOf('assessment') !== -1 || text.indexOf('request') !== -1) {
            send({ type: 'assessment_click', page: getCurrentPage() });
          }
        }
      } catch (err) { }
    }, true);

    // 8. Track anchor clicks (e.g. links to #services, #team)
    document.addEventListener('click', function (e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (a) {
          var href = a.getAttribute('href');
          if (href && href.length > 1) {
            var p = (window.location.pathname === '/' ? '' : window.location.pathname) + href;
            send({ type: 'pageview', page: p });
          }
        }
      } catch (err) { }
    }, true);

  } catch (err) { }
})();
